from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # We store the numpy vector as Binary Data (BLOB) for speed
    preferences_vector = Column(LargeBinary, nullable=True) 
    
    # THE SVD MEMORY (Quality/Pattern)
    svd_preferences = Column(LargeBinary, nullable=True)
    
    # The 'N' in our formula (How many items rated)
    ratings_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    ratings = relationship("Rating", back_populates="owner")
    watchlist = relationship("Watchlist", back_populates="owner")

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tconst = Column(String, index=True)
    score = Column(Float) 
    
    timestamp = Column(DateTime, default=datetime.now)
    
    owner = relationship("User", back_populates="ratings")

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tconst = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.now)

    owner = relationship("User", back_populates="watchlist")