import requests
import os
import numpy as np
import pandas as pd
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from sklearn.metrics.pairwise import cosine_similarity
from pydantic import BaseModel
import models, schemas, auth
from database import engine, get_db
from datetime import datetime
from google import genai 
from google.genai import types
import warnings
from fastapi.security import OAuth2PasswordBearer

from brain import ekko_brain 

load_dotenv()

warnings.filterwarnings("ignore", category=UserWarning, module='sklearn')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init Database Tables
    print("   Initializing User Database...", end=" ")
    models.Base.metadata.create_all(bind=engine)
    print(" Tables Ready.")

    # DB MIGRATION
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT svd_preferences FROM users LIMIT 1"))
    except Exception:
        print("  MIGRATION: Adding missing 'svd_preferences' column to Users table...", end=" ")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN svd_preferences BLOB"))
            conn.commit()
        print(" Fixed.")
    
    # Brain Check
    if ekko_brain.metadata is not None:
        print(f"   SYSTEM READY. Serving {len(ekko_brain.metadata)} movies.")
    else:
        print(" SYSTEM WARNING: Brain data is empty.")
        
    yield
    print(" Server Shutting Down...")

app = FastAPI(title="Ekko AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# HEALTH CHECK
@app.get("/")
def health_check():
    return {"status": "online", "brain_size": len(ekko_brain.metadata) if ekko_brain.metadata is not None else 0}

# AUTH ROUTES
@app.post("/signup", response_model=schemas.Token)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = auth.create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    access_token = auth.create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_email: str = Depends(auth.get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ONBOARDING
@app.get("/onboarding/movies", response_model=List[schemas.MovieCard])
def get_onboarding_movies(limit: int = 50):
    if ekko_brain.metadata is None:
        raise HTTPException(status_code=503, detail="Brain not loaded")
    
    top_movies = ekko_brain.metadata[ekko_brain.metadata['numVotes'] > 10000] \
        .sort_values(by='numVotes', ascending=False).head(limit)
    
    results = []
    for _, row in top_movies.iterrows():
        results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes']),
            "score": None 
        })
    return results

@app.post("/onboarding/submit")
def submit_onboarding(selected_tconsts: List[str], current_user: str = Depends(auth.get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ai_vectors = []
    svd_vectors = []

    for tconst in selected_tconsts:
        if tconst in ekko_brain.tconst_map:
            idx = ekko_brain.tconst_map[tconst]
            
            # Collect AI Vector
            ai_vec = ekko_brain.ai_embeddings[idx]
            ai_vectors.append(ai_vec)

            # Collect SVD Vector (If available)
            if ekko_brain.svd_factors is not None:
                svd_vec = ekko_brain.svd_factors[idx]
                svd_vectors.append(svd_vec)
        
        new_rating = models.Rating(user_id=user.id, tconst=tconst, score=10.0)
        db.add(new_rating)
    
    if not ai_vectors:
        raise HTTPException(status_code=400, detail="Invalid movies selected")
    
    # Calculate Mean Vectors
    mean_ai = np.mean(ai_vectors, axis=0).astype(np.float32)
    user.preferences_vector = mean_ai.tobytes()
    
    if svd_vectors:
        mean_svd = np.mean(svd_vectors, axis=0).astype(np.float32)
        user.svd_preferences = mean_svd.tobytes()

    user.ratings_count = len(ai_vectors)
    db.commit()
    return {"status": "success", "message": "Vibe calculated"}

@app.get("/feed", response_model=List[schemas.MovieCard])
def get_feed(current_email: str = Depends(auth.get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    # COLD START
    if not user or not user.preferences_vector:
        return get_onboarding_movies(limit=20)
    
    # LOAD USER VECTORS
    # AI Vector (768-dim)
    user_ai_vector = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
    
    # SVD Vector Safety Check
    brain_svd_dim = 32
    if ekko_brain.svd_factors is not None:
        brain_svd_dim = ekko_brain.svd_factors.shape[1]

    if user.svd_preferences:
        user_svd_vector = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
        
        if user_svd_vector.shape[1] != brain_svd_dim:
            print(f" SVD Dimension Mismatch! DB: {user_svd_vector.shape[1]}, Brain: {brain_svd_dim}")
            print("   -> Healing: Resetting SVD vector to zeros.")
            user_svd_vector = np.zeros((1, brain_svd_dim), dtype=np.float32)
    else:
        user_svd_vector = np.zeros((1, brain_svd_dim), dtype=np.float32)

    seen_movies = {r.tconst for r in user.ratings}
    
    # PHASE 1: CANDIDATE GENERATION (Using AI Vector)
    scores_ai = cosine_similarity(user_ai_vector, ekko_brain.ai_embeddings).flatten()
    top_indices = np.argpartition(scores_ai, -10000)[-10000:]
    
    candidates = []
    candidate_indices = []
    
    for idx in top_indices:
        row = ekko_brain.metadata.iloc[idx]
        if row['tconst'] in seen_movies: continue
        if row['numVotes'] < 1000: continue
        
        candidates.append(row)
        candidate_indices.append(idx)

    if not candidates:
        return []

    # PHASE 2: FEATURE ENGINEERING
    cand_sim_ai = scores_ai[candidate_indices]
    
    if ekko_brain.svd_factors is not None:
        cand_svd_vectors = ekko_brain.svd_factors[candidate_indices]
        cand_score_svd = np.dot(user_svd_vector, cand_svd_vectors.T).flatten()
    else:
        cand_score_svd = np.zeros(len(candidates))

    # Features: Shape (N, 2)
    X_pred = np.column_stack((cand_sim_ai, cand_score_svd))
    
    # PHASE 3: THE PREDICTION (LightGBM)
    final_probs = np.zeros(len(candidates))
    
    if ekko_brain.model:
        try:
            # Predict Probability of Class 1 (Like)
            final_probs = ekko_brain.model.predict_proba(X_pred)[:, 1]
            
            #  SUCCESS LOG
            print(f"    LightGBM Success: Ranked {len(candidates)} titles.")
            
        except Exception as e:
            print(f"    LightGBM CRASHED: {e}")
            print(f"      -> Input Shape: {X_pred.shape}")
            final_probs = cand_sim_ai
    else:
        #  MISSING MODEL LOG
        print("    LightGBM Model NOT LOADED. Using simple AI score.")
        final_probs = cand_sim_ai
        
    # RANKING
    final_results = []
    for i, row in enumerate(candidates):
        final_results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes']),
            "score": float(final_probs[i])
        })

    final_results.sort(key=lambda x: x['score'], reverse=True)
    
    return final_results[:20]

class RatingRequest(BaseModel):
    tconst: str
    score: int

@app.post("/rate")
def rate_movie(rating: RatingRequest, current_email: str = Depends(auth.get_current_user_email), db: Session = Depends(get_db)):
    """
    UPDATED: Trains both the AI Brain (Vibe) and the SVD Brain (Quality).
    """
    user = db.query(models.User).filter(models.User.email == current_email).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")

    if rating.tconst not in ekko_brain.tconst_map:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Update/Add Rating in DB
    existing_rating = db.query(models.Rating).filter(models.Rating.user_id == user.id, models.Rating.tconst == rating.tconst).first()
    if existing_rating:
        existing_rating.score = float(rating.score)
    else:
        db.add(models.Rating(user_id=user.id, tconst=rating.tconst, score=float(rating.score)))
        user.ratings_count += 1

    # Get Vectors
    idx = ekko_brain.tconst_map[rating.tconst]
    movie_ai_vector = ekko_brain.ai_embeddings[idx]
    
    if ekko_brain.svd_factors is not None:
        movie_svd_vector = ekko_brain.svd_factors[idx]
    else:
        movie_svd_vector = None

    # Calculate Learning Rate (Nudge Strength)
    score_map = {
        10: 0.15, 9: 0.12, 8: 0.09, 7: 0.05, 6: 0.00,
        5: -0.05, 4: -0.09, 3: -0.12, 2: -0.15, 1: -0.20
    }
    learning_rate = score_map.get(rating.score, 0.05)

    if learning_rate != 0:
        # Update AI Vector (Vibe)
        current_ai = np.frombuffer(user.preferences_vector, dtype=np.float32)
        new_ai = current_ai + (learning_rate * (movie_ai_vector - current_ai))
        user.preferences_vector = new_ai.astype(np.float32).tobytes()
        
        # Update SVD Vector (Quality)
        if movie_svd_vector is not None:
            if user.svd_preferences:
                current_svd = np.frombuffer(user.svd_preferences, dtype=np.float32)
            else:
                current_svd = np.zeros(32, dtype=np.float32)
            
            new_svd = current_svd + (learning_rate * (movie_svd_vector - current_svd))
            user.svd_preferences = new_svd.astype(np.float32).tobytes()

        db.commit()
        print(f" Brain Updated: {learning_rate} shift (AI + SVD)")

    return {"status": "success"}

@app.get("/feed/guest")
def get_guest_feed(
    limit: int = 50, 
    offset: int = 0, 
    db: Session = Depends(get_db)
):
    # Fetch a larger chunk to handle pagination
    # We sort by popularity (numVotes)
    top_content = ekko_brain.metadata.sort_values(by='numVotes', ascending=False).head(offset + limit)
    
    # Slice the specific page
    page_content = top_content.iloc[offset : offset + limit]
    
    results = []
    for _, row in page_content.iterrows():
        results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes']),
            "score": None
        })
    return results

@app.get("/movie/{tconst}/tags")
def get_movie_tags(
    tconst: str, 
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db) 
):
    # Fetch AI Data (Static)
    raw_data = ekko_brain.tag_map.get(tconst)
    
    # Check User History
    user = db.query(models.User).filter(models.User.email == current_email).first()
    existing_rating = db.query(models.Rating).filter(
        models.Rating.user_id == user.id,
        models.Rating.tconst == tconst
    ).first()
    
    user_score = int(existing_rating.score) if existing_rating else 0
    match_score = 0.0
    
    if user and tconst in ekko_brain.tconst_map:
        idx = ekko_brain.tconst_map[tconst]
        
        # Prepare Vectors
        if user.preferences_vector:
            user_ai = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
        else:
            user_ai = np.zeros((1, 768), dtype=np.float32)
            
        if user.svd_preferences:
            user_svd = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
            # Self-heal dim mismatch if needed
            if user_svd.shape[1] != 32: user_svd = np.zeros((1, 32), dtype=np.float32)
        else:
            user_svd = np.zeros((1, 32), dtype=np.float32)

        # Feature Engineering
        movie_ai = ekko_brain.ai_embeddings[idx].reshape(1, -1)
        sim_ai = cosine_similarity(user_ai, movie_ai)[0][0]
        
        score_svd = 0.0
        if ekko_brain.svd_factors is not None:
            movie_svd = ekko_brain.svd_factors[idx].reshape(1, -1)
            score_svd = np.dot(user_svd, movie_svd.T)[0][0]
            
        # Predict
        if ekko_brain.model:
            try:
                features = np.array([[sim_ai, score_svd]])
                model_prob = float(ekko_brain.model.predict_proba(features)[:, 1][0])
                
                # FALLBACK LOGIC FOR TV SHOWS / NEW ITEMS 
                # If SVD is 0 (Unknown item) but Content Match is high (>0.5), trust the Content Match.
                if score_svd == 0.0 and sim_ai > 0.5:
                    match_score = float(sim_ai)
                else:
                    match_score = model_prob
            except:
                match_score = float(sim_ai)
        else:
            match_score = float(sim_ai)

    num_votes = 0
    if tconst in ekko_brain.tconst_map:
        idx = ekko_brain.tconst_map[tconst]
        num_votes = int(ekko_brain.metadata.iloc[idx]['numVotes'])

    # Parse Plot/Tags
    if not raw_data:
        return {
            "tags": ["Analysis Pending"],
            "plot": "Plot summary unavailable.",
            "user_rating": user_score,
            "match_score": match_score,
            "num_votes": num_votes 
        }
    
    ai_insight = raw_data.get('ai_insight', "")
    
    if "|" in ai_insight:
        parts = ai_insight.split("|")
        plot_str = parts[-1].strip()
        raw_tags_string = ",".join(parts[:-1])
        tags_list = [t.strip() for t in raw_tags_string.split(',') if t.strip()]
    else:
        tags_list = ["Uncategorized"]
        plot_str = ai_insight

    return {
        "tags": tags_list, 
        "plot": plot_str,
        "user_rating": user_score,
        "match_score": match_score,
        "num_votes": num_votes 
    }

@app.delete("/rate/{tconst}")
def delete_rating(tconst: str, current_email: str = Depends(auth.get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    rating = db.query(models.Rating).filter(models.Rating.user_id==user.id, models.Rating.tconst==tconst).first()
    
    if rating:
        db.delete(rating)
        user.ratings_count = max(0, user.ratings_count - 1)
        db.commit()
        return {"status": "deleted"}
    return {"status": "not_found"}


@app.get("/search")
def search_omni(q: str, limit: int = 10):
    """
    Omni-Search: Returns Movies AND People.
    Structure: [ { type: 'movie', ... }, { type: 'person', ... } ]
    """
    if not q or len(q) < 2:
        return []
    
    results = []
    q_str = q.lower()

    # SEARCH MOVIES (Title)
    movie_matches = ekko_brain.metadata[
        ekko_brain.metadata['primaryTitle'].str.contains(q, case=False, na=False)
    ].sort_values(by='numVotes', ascending=False).head(5)

    for _, row in movie_matches.iterrows():
        results.append({
            "type": "movie",
            "id": row['tconst'],
            "title": row['primaryTitle'],
            "year": int(row['startYear']),
            "rating": float(row['averageRating']),
            "votes": int(row['numVotes'])
        })

    # SEARCH Persons (Actors & Directors)
    actor_matches = ekko_brain.metadata[
        ekko_brain.metadata['actors'].str.contains(q, case=False, na=False)
    ]
    
    director_matches = ekko_brain.metadata[
        ekko_brain.metadata['directors'].str.contains(q, case=False, na=False)
    ]

    found_people = set()
    
    def extract_names(df, col):
        for raw_str in df[col].head(50): 
            names = [n.strip() for n in str(raw_str).split(',')]
            for name in names:
                if q_str in name.lower():
                    found_people.add(name)
                    if len(found_people) >= 5: return

    extract_names(actor_matches, 'actors')
    if len(found_people) < 5:
        extract_names(director_matches, 'directors')

    for person in list(found_people)[:5]: 
        results.append({
            "type": "person",
            "id": person, 
            "title": person,
            "role": "Actor/Director" 
        })

    return results

@app.get("/users/history")
def get_user_history(
    limit: int = 30,
    offset: int = 0,
    q: Optional[str] = None,
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    query = db.query(models.Rating).filter(models.Rating.user_id == user.id)
    all_ratings = query.order_by(models.Rating.timestamp.desc()).all()
    
    matched_items = []
    search_term = q.lower() if q else None
    
    for r in all_ratings:
        if r.tconst in ekko_brain.tconst_map:
            idx = ekko_brain.tconst_map[r.tconst]
            row = ekko_brain.metadata.iloc[idx]
            title = str(row['primaryTitle'])
            
            if search_term and search_term not in title.lower():
                continue
                
            matched_items.append({
                "tconst": r.tconst,
                "score": r.score,
                "timestamp": r.timestamp,
                "primaryTitle": title,
                "startYear": int(row['startYear']),
                "averageRating": float(row['averageRating']),
                "numVotes": int(row['numVotes'])
            })
            
    total_count = len(matched_items)
    paginated_items = matched_items[offset : offset + limit]
    
    return {
        "items": paginated_items,
        "total": total_count,
        "offset": offset,
        "limit": limit
    }

@app.get("/movie/{tconst}/similar")
def get_similar_movies(
    tconst: str, 
    limit: int = 10,
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    # Validation
    if tconst not in ekko_brain.tconst_map:
        return []
    
    idx = ekko_brain.tconst_map[tconst]
    target_vector = ekko_brain.ai_embeddings[idx].reshape(1, -1)
    
    # Get User Vectors (AI + SVD)
    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    # Default vectors (if user is guest/new)
    user_ai_vector = np.zeros((1, 768), dtype=np.float32)
    user_svd_vector = np.zeros((1, 32), dtype=np.float32)
    
    if user:
        if user.preferences_vector:
            user_ai_vector = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
        if user.svd_preferences:
            v = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
            if v.shape[1] == 32: user_svd_vector = v

    # Candidate Generation (Similarity to TARGET MOVIE)
    # We want movies similar to the one clicked, not similar to the user
    scores = cosine_similarity(target_vector, ekko_brain.ai_embeddings).flatten()
    top_indices = np.argpartition(scores, -(limit+5))[-(limit+5):]
    top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]
    
    candidate_indices = []
    results_meta = []
    
    for i in top_indices:
        if i == idx: continue
        row = ekko_brain.metadata.iloc[i]
        
        # Quality Filter
        if row['averageRating'] < 5.0 or row['numVotes'] < 1000: continue
            
        candidate_indices.append(i)
        results_meta.append({
            "row": row,
            "similarity_to_target": float(scores[i])
        })
        if len(candidate_indices) >= limit: break

    if not candidate_indices:
        return []

    # Calculate features: [User-Candidate AI Sim, User-Candidate SVD Score]
    # Feature 1: AI Similarity (User vs Movie)
    cand_vectors_ai = ekko_brain.ai_embeddings[candidate_indices]
    feat_sim_ai = cosine_similarity(user_ai_vector, cand_vectors_ai).flatten()
    
    # Feature 2: SVD Score (User vs Movie)
    if ekko_brain.svd_factors is not None:
        cand_vectors_svd = ekko_brain.svd_factors[candidate_indices]
        feat_score_svd = np.dot(user_svd_vector, cand_vectors_svd.T).flatten()
    else:
        feat_score_svd = np.zeros(len(candidate_indices))
        
    # Predict
    final_probs = feat_sim_ai # Fallback
    if ekko_brain.model:
        try:
            X_pred = np.column_stack((feat_sim_ai, feat_score_svd))
            final_probs = ekko_brain.model.predict_proba(X_pred)[:, 1]
            
            #  FALLBACK LOGIC 
            # If SVD is 0 (Unknown item) but AI match is high, then we will trust AI signal.
            for k in range(len(final_probs)):
                if feat_score_svd[k] == 0.0 and feat_sim_ai[k] > 0.5:
                    final_probs[k] = feat_sim_ai[k]

        except Exception:
            pass

    # Build Response
    final_response = []
    for k, item in enumerate(results_meta):
        row = item['row']
        final_response.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes']),
            "posterUrl": None,
            "similarity_score": item['similarity_to_target'], # How close to source movie
            "user_probability": float(final_probs[k])         # How much YOU will like it
        })
        
    return final_response

# IMPORTANT: Keep this function ABOVE @app.get("/feed/{genre}")
@app.get("/feed/exploration")
def get_exploration_feed(
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    print(f"🔎 EXPLORATION: Generating for {current_email}")
    
    # Get User & Vectors
    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    # Default vectors
    user_ai_vector = np.zeros((1, 768), dtype=np.float32)
    user_svd_vector = np.zeros((1, 32), dtype=np.float32)
    
    if user:
        if user.preferences_vector:
            user_ai_vector = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
        if user.svd_preferences:
            v = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
            if v.shape[1] == 32: user_svd_vector = v

    # Check Ratings (Score >= 7)
    rated_items = db.query(models.Rating).filter(
        models.Rating.user_id == user.id,
        models.Rating.score >= 7.0
    ).order_by(models.Rating.timestamp.desc()).all()
    
    if not rated_items: return []

    # Find Source Candidates
    candidates = []
    source_ratings = {}
    for r in rated_items:
        if r.tconst in ekko_brain.tconst_map:
            candidates.append(r.tconst)
            source_ratings[r.tconst] = r.score
            if len(candidates) >= 2: break
                
    if not candidates: return []

    # Filter Watched
    all_rated_rows = db.query(models.Rating.tconst).filter(models.Rating.user_id == user.id).all()
    watched_set = {row[0] for row in all_rated_rows}

    results = []
    
    # GENERATE ROWS
    for source_tconst in candidates:
        source_idx = ekko_brain.tconst_map[source_tconst]
        source_row = ekko_brain.metadata.iloc[source_idx]
        source_vector = ekko_brain.ai_embeddings[source_idx].reshape(1, -1)
        
        # Find Similar to SOURCE (The "Because..." logic)
        scores = cosine_similarity(source_vector, ekko_brain.ai_embeddings).flatten()
        top_indices = np.argpartition(scores, -30)[-30:]
        top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]
        
        recs_indices = []
        recs_meta = []
        
        for idx in top_indices:
            if idx == source_idx: continue
            row = ekko_brain.metadata.iloc[idx]
            if row['tconst'] in watched_set: continue
            
            recs_indices.append(idx)
            recs_meta.append(row)
            if len(recs_indices) >= 15: break
        
        if not recs_indices: continue

        # We calculate how much the USER likes these specific recommendations
        cand_vectors_ai = ekko_brain.ai_embeddings[recs_indices]
        feat_sim_ai = cosine_similarity(user_ai_vector, cand_vectors_ai).flatten()
        
        if ekko_brain.svd_factors is not None:
            cand_vectors_svd = ekko_brain.svd_factors[recs_indices]
            feat_score_svd = np.dot(user_svd_vector, cand_vectors_svd.T).flatten()
        else:
            feat_score_svd = np.zeros(len(recs_indices))
            
        final_probs = feat_sim_ai # Fallback
        if ekko_brain.model:
            try:
                X_pred = np.column_stack((feat_sim_ai, feat_score_svd))
                final_probs = ekko_brain.model.predict_proba(X_pred)[:, 1]

                #  FALLBACK LOGIC 
                for k in range(len(final_probs)):
                    if feat_score_svd[k] == 0.0 and feat_sim_ai[k] > 0.5:
                        final_probs[k] = feat_sim_ai[k]

            except Exception:
                pass

        # Format Items
        formatted_items = []
        for k, row in enumerate(recs_meta):
            formatted_items.append({
                "tconst": row['tconst'],
                "primaryTitle": row['primaryTitle'],
                "startYear": int(row['startYear']),
                "averageRating": float(row['averageRating']),
                "score": float(final_probs[k]) 
            })

        results.append({
            "source": {
                "tconst": source_tconst,
                "primaryTitle": source_row['primaryTitle'],
                "score": float(source_ratings[source_tconst])
            },
            "items": formatted_items
        })

    return results

@app.get("/feed/{genre}")
def get_genre_feed(
    genre: str,
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    # Get User & History
    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    # Get list of already rated movies to exclude them
    rated_tconsts = set()
    if user:
        rated_rows = db.query(models.Rating.tconst).filter(models.Rating.user_id == user.id).all()
        rated_tconsts = {r[0] for r in rated_rows}

    # Filter Metadata by Genre
    genre_df = ekko_brain.metadata[
        ekko_brain.metadata['genres'].str.contains(genre, case=False, na=False)
    ]
    
    if rated_tconsts:
        genre_df = genre_df[~genre_df['tconst'].isin(rated_tconsts)]

    if genre_df.empty:
        return []

    # Optimization: Limit to top 2000 unrated popular ones
    genre_df = genre_df.sort_values(by='numVotes', ascending=False).head(2000)
    
    relevant_indices = [ekko_brain.tconst_map[t] for t in genre_df['tconst'] if t in ekko_brain.tconst_map]
    
    if not relevant_indices:
        return []
        
    # If user has no vector yet, return popular unrated ones (Cold Start)
    if not user or not user.preferences_vector:
        return get_popular_genre(genre_df, limit=20)

    # PREPARE VECTORS
    user_ai_vector = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
    
    # SVD Vector
    brain_svd_dim = 32
    if ekko_brain.svd_factors is not None:
        brain_svd_dim = ekko_brain.svd_factors.shape[1]

    if user.svd_preferences:
        user_svd_vector = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
        if user_svd_vector.shape[1] != brain_svd_dim:
            user_svd_vector = np.zeros((1, brain_svd_dim), dtype=np.float32)
    else:
        user_svd_vector = np.zeros((1, brain_svd_dim), dtype=np.float32)

    # AI Scores
    genre_vectors_ai = ekko_brain.ai_embeddings[relevant_indices]
    cand_sim_ai = cosine_similarity(user_ai_vector, genre_vectors_ai).flatten()
    
    # SVD Scores
    if ekko_brain.svd_factors is not None:
        cand_vectors_svd = ekko_brain.svd_factors[relevant_indices]
        cand_score_svd = np.dot(user_svd_vector, cand_vectors_svd.T).flatten()
    else:
        cand_score_svd = np.zeros(len(relevant_indices))

    # LIGHTGBM PREDICTION
    if not ekko_brain.model:
        raise HTTPException(status_code=500, detail="CRITICAL: AI Model not loaded on server.")

    try:
        X_pred = np.column_stack((cand_sim_ai, cand_score_svd))
        final_probs = ekko_brain.model.predict_proba(X_pred)[:, 1]

        for k in range(len(final_probs)):
             if cand_score_svd[k] == 0.0 and cand_sim_ai[k] > 0.5:
                 final_probs[k] = cand_sim_ai[k]

    except Exception as e:
        print(f" LightGBM Genre Prediction Failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI Prediction Engine Error: {str(e)}")

    # RANKING
    # We used argpartition for speed to get top 20
    top_k = min(20, len(final_probs))
    top_local_indices = np.argpartition(final_probs, -top_k)[-top_k:]
    top_local_indices = top_local_indices[np.argsort(final_probs[top_local_indices])[::-1]]
    
    results = []
    for local_idx in top_local_indices:
        global_idx = relevant_indices[local_idx]
        row = ekko_brain.metadata.iloc[global_idx]
        
        results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes']),
            "score": float(final_probs[local_idx]) 
        })
        
    return results

def get_popular_genre(df, limit: int = 20):
    matches = df.sort_values(by='numVotes', ascending=False).head(limit)
    results = []
    for _, row in matches.iterrows():
        results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes'])
        })
    return results

@app.post("/watchlist/{tconst}")
def toggle_watchlist(
    tconst: str,
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    existing = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == user.id,
        models.Watchlist.tconst == tconst
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "removed", "tconst": tconst}
    else:
        new_item = models.Watchlist(user_id=user.id, tconst=tconst)
        db.add(new_item)
        db.commit()
        return {"status": "added", "tconst": tconst}

@app.get("/watchlist")
def get_watchlist(
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    items = db.query(models.Watchlist).filter(models.Watchlist.user_id == user.id) \
              .order_by(models.Watchlist.timestamp.desc()).all()
    
    rated_rows = db.query(models.Rating.tconst).filter(models.Rating.user_id == user.id).all()
    rated_tconsts = {r[0] for r in rated_rows}

    results = []
    for item in items:
        meta = ekko_brain.metadata[ekko_brain.metadata['tconst'] == item.tconst]
        
        if not meta.empty:
            row = meta.iloc[0]
            has_seen = item.tconst in rated_tconsts
            
            results.append({
                "tconst": row['tconst'],
                "primaryTitle": row['primaryTitle'],
                "startYear": int(row['startYear']),
                "averageRating": float(row['averageRating']),
                "posterUrl": None,
                "isWatched": has_seen 
            })
            
    return results

@app.get("/watchlist/{tconst}/check")
def check_watchlist(
    tconst: str,
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == current_email).first()
    exists = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == user.id,
        models.Watchlist.tconst == tconst
    ).first()
    
    return {"in_watchlist": exists is not None}

class BatchRatingItem(BaseModel):
    tconst: str
    score: float
    date_rated: Optional[str] = None 

class BatchRatingRequest(BaseModel):
    ratings: List[BatchRatingItem]

@app.post("/rate/batch")
def batch_rate_movies(
    payload: BatchRatingRequest,
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)
):
    print(f" Received Batch: {len(payload.ratings)} items") 

    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    # Dimensions Check
    if ekko_brain.ai_embeddings is not None and len(ekko_brain.ai_embeddings) > 0:
        ai_dim = ekko_brain.ai_embeddings.shape[1]
    else:
        ai_dim = 768 
        
    # SVD Dim (usually 32)
    svd_dim = 32

    # Prepare Current State
    current_count = user.ratings_count
    
    # Load AI Vector
    if user.preferences_vector:
        current_ai = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
        if current_ai.shape[1] != ai_dim:
            running_ai = np.zeros((1, ai_dim), dtype=np.float32)
            current_count = 0 
        else:
            running_ai = current_ai * current_count
    else:
        running_ai = np.zeros((1, ai_dim), dtype=np.float32)

    # Load SVD Vector
    if user.svd_preferences:
        current_svd = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
        running_svd = current_svd * current_count
    else:
        running_svd = np.zeros((1, svd_dim), dtype=np.float32)

    valid_ai_vecs = []
    valid_svd_vecs = []
    processed_count = 0
    total_embeddings_count = len(ekko_brain.ai_embeddings) if ekko_brain.ai_embeddings is not None else 0

    try:
        for item in payload.ratings:
            if item.tconst not in ekko_brain.tconst_map:
                continue
                
            idx = ekko_brain.tconst_map[item.tconst]

            if idx >= total_embeddings_count:
                continue

            dt_obj = datetime.utcnow()
            if item.date_rated:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
                    try:
                        dt_obj = datetime.strptime(item.date_rated, fmt)
                        break
                    except ValueError:
                        continue

            existing = db.query(models.Rating).filter(
                models.Rating.user_id == user.id, 
                models.Rating.tconst == item.tconst
            ).first()

            if existing:
                existing.score = item.score
                existing.timestamp = dt_obj
            else:
                new_rating = models.Rating(
                    user_id=user.id,
                    tconst=item.tconst,
                    score=item.score,
                    timestamp=dt_obj
                )
                db.add(new_rating)
                processed_count += 1
                
                # Collect Vectors
                ai_vec = ekko_brain.ai_embeddings[idx]
                valid_ai_vecs.append(ai_vec)
                
                if ekko_brain.svd_factors is not None:
                    svd_vec = ekko_brain.svd_factors[idx]
                    valid_svd_vecs.append(svd_vec)

        # Update Math
        if valid_ai_vecs:
            batch_ai_sum = np.sum(valid_ai_vecs, axis=0).reshape(1, -1)
            total_ai = running_ai + batch_ai_sum
            
            # Update SVD if available
            if valid_svd_vecs:
                batch_svd_sum = np.sum(valid_svd_vecs, axis=0).reshape(1, -1)
                total_svd = running_svd + batch_svd_sum
            else:
                total_svd = running_svd
            
            new_total_count = current_count + len(valid_ai_vecs)
            
            if new_total_count > 0:
                new_ai_mean = total_ai / new_total_count
                user.preferences_vector = new_ai_mean.astype(np.float32).tobytes()
                
                new_svd_mean = total_svd / new_total_count
                user.svd_preferences = new_svd_mean.astype(np.float32).tobytes()
                
                user.ratings_count = new_total_count
        
        db.commit()
        return {"status": "success", "processed": processed_count}

    except Exception as e:
        print(f" CRITICAL BATCH ERROR: {e}")
        db.rollback() 
        raise HTTPException(status_code=500, detail=str(e))

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

@app.get("/person/{name}")
def get_person_filmography(
    name: str,
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
):
    # Get User & Vectors
    user = None
    if token:
        try:
            payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            email = payload.get("sub")
            if email:
                user = db.query(models.User).filter(models.User.email == email).first()
        except Exception:
            user = None

    # Default vectors (Guest/New User)
    user_ai = np.zeros((1, 768), dtype=np.float32)
    user_svd = np.zeros((1, 32), dtype=np.float32)
    
    if user:
        if user.preferences_vector:
            user_ai = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
        if user.svd_preferences:
            v = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
            # Safety check
            if v.shape[1] == 32: user_svd = v
    mask = (
        ekko_brain.metadata['actors'].str.contains(name, case=False, regex=False, na=False) | 
        ekko_brain.metadata['directors'].str.contains(name, case=False, regex=False, na=False)
    )
    person_df = ekko_brain.metadata[mask]
    
    if person_df.empty:
        return []

    # Get indices for vector lookup
    relevant_indices = [ekko_brain.tconst_map[t] for t in person_df['tconst'] if t in ekko_brain.tconst_map]
    
    if not relevant_indices:
        return []
    
    # Feature 1: AI Similarity
    cand_vectors_ai = ekko_brain.ai_embeddings[relevant_indices]
    feat_sim_ai = cosine_similarity(user_ai, cand_vectors_ai).flatten()
    
    # Feature 2: SVD Score
    feat_score_svd = np.zeros(len(relevant_indices))
    if ekko_brain.svd_factors is not None:
        cand_vectors_svd = ekko_brain.svd_factors[relevant_indices]
        feat_score_svd = np.dot(user_svd, cand_vectors_svd.T).flatten()
        
    # Predict with LightGBM
    final_probs = feat_sim_ai # Fallback
    
    if ekko_brain.model:
        try:
            X_pred = np.column_stack((feat_sim_ai, feat_score_svd))
            final_probs = ekko_brain.model.predict_proba(X_pred)[:, 1]

            # FALLBACK LOGIC 
            # If SVD is 0 (Unknown item) but AI match is high, trust AI.
            for k in range(len(final_probs)):
                if feat_score_svd[k] == 0.0 and feat_sim_ai[k] > 0.5:
                    final_probs[k] = feat_sim_ai[k]
                    
        except Exception:
            pass

    # Map Scores back to DataFrame
    # We create a map of tconst -> score to sort the dataframe easily
    tconst_list = [ekko_brain.metadata.iloc[idx]['tconst'] for idx in relevant_indices]
    score_map = {tconst: float(score) for tconst, score in zip(tconst_list, final_probs)}
    
    person_df = person_df.copy()
    person_df['neural_score'] = person_df['tconst'].map(score_map)
    
    # Sort by Match Score (High to Low)
    person_df = person_df.sort_values(by='neural_score', ascending=False)

    results = []
    for _, row in person_df.iterrows():
        results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "numVotes": int(row['numVotes']),
            "score": float(row.get('neural_score', 0)) 
        })
        
    return results

# SETUP GEMINI
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None

GEMINI_MODELS = [
    "gemini-2.5-flash",    
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-001" 
]

@app.get("/search/semantic")
def search_semantic(
    q: str, 
    limit: int = 10, 
    current_email: str = Depends(auth.get_current_user_email),
    db: Session = Depends(get_db)):
    
    if not q: return []
    print(f" HYDE: User asked '{q}'")
    
    search_text = None

    # HALLUCINATION CASCADE (let's make it try models one by one)
    if client:
        for model_name in GEMINI_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=(
                    "You generate SEARCH-ORIENTED movie keywords for embedding retrieval.\n"
                    f"User query: {q}\n\n"
                    "Output EXACTLY 3 sentences as ONE paragraph.\n"
                    "Sentence 1: '<genre> — ' followed by 12-18 comma-separated keywords.\n"
                    "Keywords must be concrete and film-searchable (setting, roles, objects, tech, plot devices, stakes). "
                    "Avoid vague mood-only words unless the query is only mood.\n"
                    "No proper nouns and no real movie titles.\n"
                    "Sentences 2-3: two short hook sentences, simple words, no names.\n"
                    ),
                    config=types.GenerateContentConfig(
                        temperature=0.3, 
                    )
                )
                
                if response.text:
                    search_text = response.text.strip()
                    print(f"   ✨ Success ({model_name}): {search_text[:200]}...")
                    break 
            except Exception as e:
                if "429" in str(e) or "404" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    continue
                else:
                    print(f"    Unexpected Error ({model_name}): {e}")

    # FAIL FAST
    if not search_text:
        print("    ALL AI MODELS FAILED (Quota Exceeded or Unavailable).")
        return [] 

    # VECTORIZATION
    vector = ekko_brain.vectorize_text(search_text)
    if vector is None: return []

    # DIMENSION CHECK
    brain_dim = ekko_brain.ai_embeddings.shape[1]
    input_dim = vector.shape[1]

    if brain_dim != input_dim:
        print(f" DIMENSION MISMATCH! Brain={brain_dim}, Input={input_dim}")
        return []

    user = db.query(models.User).filter(models.User.email == current_email).first()
    
    user_ai = np.zeros((1, 768), dtype=np.float32)
    user_svd = np.zeros((1, 32), dtype=np.float32)
    
    if user:
        if user.preferences_vector:
            user_ai = np.frombuffer(user.preferences_vector, dtype=np.float32).reshape(1, -1)
        if user.svd_preferences:
            v = np.frombuffer(user.svd_preferences, dtype=np.float32).reshape(1, -1)
            # Safety check for dimensions
            if v.shape[1] == 32: user_svd = v

    # SEARCH (Semantic Match)
    scores = cosine_similarity(vector, ekko_brain.ai_embeddings).flatten()
    top_indices = np.argpartition(scores, -limit)[-limit:]
    top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]
    
    # Collect candidates for batch prediction
    cand_indices = []
    results_meta = []
    
    for idx in top_indices:
        row = ekko_brain.metadata.iloc[idx]
        results_meta.append({
            "row": row,
            "query_similarity": float(scores[idx])
        })
        cand_indices.append(idx)

    final_probs = np.zeros(len(cand_indices))
    
    if cand_indices:
        # Feature 1: User vs Candidate AI Similarity
        cand_vectors_ai = ekko_brain.ai_embeddings[cand_indices]
        feat_sim_ai = cosine_similarity(user_ai, cand_vectors_ai).flatten()
        
        # Feature 2: User vs Candidate SVD Score
        feat_score_svd = np.zeros(len(cand_indices))
        if ekko_brain.svd_factors is not None:
            cand_vectors_svd = ekko_brain.svd_factors[cand_indices]
            feat_score_svd = np.dot(user_svd, cand_vectors_svd.T).flatten()
            
        # Predict
        if ekko_brain.model:
            try:
                X_pred = np.column_stack((feat_sim_ai, feat_score_svd))
                final_probs = ekko_brain.model.predict_proba(X_pred)[:, 1]

                #  FALLBACK LOGIC 
                for k in range(len(final_probs)):
                    if feat_score_svd[k] == 0.0 and feat_sim_ai[k] > 0.5:
                        final_probs[k] = feat_sim_ai[k]

            except Exception:
                pass # Defaults to 0.0 if fails

    # BUILD RESULTS
    results = []
    for k, meta in enumerate(results_meta):
        row = meta['row']
        results.append({
            "tconst": row['tconst'],
            "primaryTitle": row['primaryTitle'],
            "startYear": int(row['startYear']),
            "averageRating": float(row['averageRating']),
            "similarity": meta['query_similarity'],
            "score": float(final_probs[k]), 
            "posterUrl": None 
        })
    return results