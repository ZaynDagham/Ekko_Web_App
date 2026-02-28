"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Lock, BrainCircuit, User, Bot, Award, BookmarkPlus, BookmarkCheck, Film, Clapperboard, Video, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getTMDBDetails, getPoster } from '@/lib/tmdb'; 
import SimilarRow from './SimilarRow';

interface MovieModalProps {
  movie: any;
  onClose: () => void;
  onRateSuccess?: () => void;
  onSwitchMovie?: (movie: any) => void;
  isGuest?: boolean;
  onPersonClick?: (name: string) => void; 
}

const RATING_TEXT: Record<number, { user: string; ai: string }> = {
    1: { user: "Burn it.",           ai: "Banishing this vibe completely." },
    2: { user: "Hated it.",          ai: "Pushing this far away." },
    3: { user: "Not for me.",        ai: "Filtering this type out." },
    4: { user: "Disappointing.",     ai: "Showing you less of this." },
    5: { user: "Meh.",               ai: "Drifting away slowly." },
    6: { user: "It was okay.",       ai: "Keeping profile steady." },
    7: { user: "Good stuff.",        ai: "Nudging you closer." },
    8: { user: "Great!",             ai: "Recommending more like this." },
    9: { user: "Incredible!",        ai: "Pulling you deep into this." },
    10: { user: "Perfect.",          ai: "Anchoring your taste here." }
};

export default function MovieModal({ movie, onClose, onRateSuccess, onSwitchMovie, isGuest = false, onPersonClick }: MovieModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [savedRating, setSavedRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  
  // AI Data
  const [tags, setTags] = useState<string[]>([]);
  const [vipPlot, setVipPlot] = useState<string>(""); 
  
  // Store precise score and correct poster and votes
  const [matchScore, setMatchScore] = useState<number>(movie.score || 0);
  const [finalPoster, setFinalPoster] = useState<string | null>(movie.posterUrl);
  const [votes, setVotes] = useState<number>(movie.numVotes || 0);

  // TMDB Data 
  const [tmdbData, setTmdbData] = useState<{
      type: string;
      plot: string;
      cast: { name: string; character: string; pic: string | null }[];
      directors: { name: string; pic: string | null }[];
  } | null>(null);

  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    // Reset state
    setRating(0); 
    setSavedRating(0);
    setTags([]); 
    setVipPlot("");
    setTmdbData(null);
    setMatchScore(movie.score || 0); 
    setVotes(movie.numVotes || 0);
    
    // IMAGE REPAIR (Fix Hero/Backdrop issues)
    async function fixImage() {
        const correctUrl = await getPoster(movie.tconst);
        if (correctUrl) setFinalPoster(correctUrl);
    }
    fixImage();

    // Fetch TMDB Details
    async function loadTMDB() {
        const details = await getTMDBDetails(movie.tconst);
        if (details) setTmdbData(details);
    }
    loadTMDB();

    // Fetch User & AI Data (Backend)
    if (!isGuest) {
        const fetchUserData = async () => {
            try {
                // Get AI Tags & Rating & MATCH SCORE
                const res = await api.get(`/movie/${movie.tconst}/tags`);
                setTags(res.data.tags);
                setVipPlot(res.data.plot);
                
                // UPDATE SCORE from Backend (Real-time calculation)
                if (res.data.match_score) {
                    setMatchScore(res.data.match_score);
                }

                // UPDATE VOTES from Backend
                if (res.data.num_votes) {
                    setVotes(res.data.num_votes);
                }
                
                if (res.data.user_rating > 0) {
                    setSavedRating(res.data.user_rating);
                    setRating(res.data.user_rating);
                }
                
                // Check Watchlist
                const wRes = await api.get(`/watchlist/${movie.tconst}/check`);
                setInWatchlist(wRes.data.in_watchlist);

            } catch (err) {
                console.error("Failed to fetch movie details", err);
            }
        };
        fetchUserData();
    }
  }, [movie, isGuest]);

  const toggleWatchlist = async () => {
    try {
        const res = await api.post(`/watchlist/${movie.tconst}`);
        setInWatchlist(res.data.status === 'added');
    } catch (err) {
        console.error("Watchlist toggle error", err);
    }
  };
  
  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    try {
        await api.post('/rate', { tconst: movie.tconst, score: rating });
        setSavedRating(rating);
        setTimeout(() => {
            if (onRateSuccess) onRateSuccess();
            onClose(); 
        }, 500);
    } catch (err) {
        console.error("Rating failed", err);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteRating = async () => {
      if (!savedRating) return;
      setLoading(true);
      try {
          await api.delete(`/rate/${movie.tconst}`);
          setSavedRating(0);
          setRating(0);
          if (onRateSuccess) onRateSuccess();
      } catch (err) {
          console.error("Delete rating failed", err);
      } finally {
          setLoading(false);
      }
  };

  const displayRating = hoverRating || rating || savedRating;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="relative w-full max-w-7xl bg-ekko-card rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition-colors">
            <X size={20} />
          </button>

          {/* LEFT: Poster */}
          <div className="w-full md:w-1/3 lg:w-1/4 h-64 md:h-auto relative shrink-0">
            {finalPoster ? (
                <img src={finalPoster} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">No Image</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ekko-card via-transparent to-transparent md:bg-gradient-to-r" />
          </div>

          {/* RIGHT: Content */}
          <div className="w-full md:w-2/3 lg:w-3/4 p-8 overflow-y-auto custom-scrollbar">
            
            <div className="flex flex-col items-start gap-2 mb-4 w-full">
                {/* MATCH SCORE BADGE */}
                {matchScore > 0 && (
                    <div className="mb-2 flex items-center gap-2 animate-in fade-in zoom-in duration-500">
                        <span className={`
                            px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg border border-white/10
                            ${matchScore > 0.85 ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 
                              matchScore > 0.70 ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 
                              'bg-gray-700'}
                        `}>
                            🎯 {Math.round(matchScore * 100)}% Match
                        </span>
                        <span className="text-xs text-gray-400">for you</span>
                    </div>
                )}

                <h2 className="text-4xl font-black text-white mb-2">{movie.primaryTitle}</h2>
                
                {/* METADATA ROW (Updated to use 'votes' state) */}
                <div className="flex items-center gap-4 text-sm text-gray-300 mt-1">
                    <span className="border border-white/20 px-2 py-0.5 rounded text-xs bg-black/30">
                        {movie.startYear}
                    </span>
                    <span className="flex items-center gap-1 text-yellow-500 font-bold">
                        <span className="text-lg">★</span> {movie.averageRating}
                    </span>
                    <span>{votes?.toLocaleString()} votes</span>
                </div>
            </div>
            
            {/* META ROW 2 */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-8 mt-2">
                <span className="border border-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                    {tmdbData?.type || "Movie"}
                </span>

                {/* My Rating Badge */}
                {!isGuest && (
                    <span className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded border transition-colors ${savedRating > 0 ? "bg-ekko-highlight/10 border-ekko-highlight/30 text-ekko-highlight" : "bg-gray-800 border-gray-700 text-gray-500"}`}>
                        <Award size={14} />
                        {savedRating > 0 ? `My Rating: ${savedRating}/10` : "Not Rated Yet"}
                    </span>
                )}

                {/* Watchlist Toggle */}
                {!isGuest && (
                    <button 
                        onClick={toggleWatchlist}
                        className={`p-1 rounded transition-all ml-2 ${inWatchlist ? "bg-yellow-400 text-gray-900 hover:bg-yellow-300" : "text-white border-white/20 hover:bg-yellow-500"}`}
                        title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                    >
                        {inWatchlist ? <BookmarkCheck size={20} /> : <BookmarkPlus size={20} />}
                    </button>
                )}
            </div>

            {/* CAST & CREW SECTION */}
            <div className="mb-8 space-y-6">
                
                {/* ROW A: DIRECTORS */}
                {tmdbData?.directors && tmdbData.directors.length > 0 && (
                    <div className="flex flex-col gap-3">
                         <div className="flex items-center gap-2 text-ekko-highlight text-xs font-bold uppercase tracking-widest">
                            <Clapperboard size={14} /> Director{tmdbData.directors.length > 1 ? 's' : ''} / Creator{tmdbData.directors.length > 1 ? 's' : ''}
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {tmdbData.directors.map((director, i) => (
                                <div key={i}
                                     onClick={() => onPersonClick?.(director.name)} 
                                     className="flex flex-col min-w-[100px] w-[100px] bg-white/5 rounded-lg border border-white/5 overflow-hidden shrink-0 group hover:border-white/20 transition-colors cursor-pointer">
                                    <div className="h-24 w-full bg-gray-700 overflow-hidden relative">
                                        {director.pic ? (
                                            <img src={director.pic} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500"><Video size={24} /></div>
                                        )}
                                    </div>
                                    <div className="p-2">
                                        <span className="text-xs font-bold text-white leading-tight break-words line-clamp-2 block text-center">
                                            {director.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ROW B: ACTORS */}
                {tmdbData?.cast && tmdbData.cast.length > 0 && (
                     <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
                            <Film size={14} /> Starring
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {tmdbData.cast.map((c, i) => (
                                <div key={i}
                                     onClick={() => onPersonClick?.(c.name)}
                                     className="flex flex-col min-w-[120px] w-[120px] bg-white/5 rounded-lg border border-white/5 overflow-hidden shrink-0 group hover:border-white/20 transition-colors cursor-pointer">
                                    <div className="h-32 w-full bg-gray-700 overflow-hidden relative">
                                        {c.pic ? (
                                            <img src={c.pic} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500"><User size={24} /></div>
                                        )}
                                    </div>
                                    <div className="p-2 flex flex-col gap-0.5 text-center">
                                        <span className="text-xs font-bold text-white leading-tight break-words line-clamp-2">
                                            {c.name}
                                        </span>
                                        <span className="text-[10px] text-gray-400 leading-tight break-words line-clamp-2">
                                            {c.character}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* STANDARD PLOT */}
            <p className="text-gray-300 leading-relaxed text-lg mb-8 animate-in fade-in duration-500 border-l-2 border-white/10 pl-4">
               {tmdbData?.plot || "Retrieving synopsis..."}
            </p>

            {/*  AI ANALYSIS BOX */}
            <div className="mb-8 p-6 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden group">
                <div className="flex items-center gap-2 mb-4 text-ekko-highlight">
                    <BrainCircuit size={20} />
                    <h3 className="font-bold tracking-widest text-sm uppercase">Ekko AI Analysis</h3>
                </div>

                {isGuest ? (
                    <div className="relative h-20 flex items-center justify-center">
                        <div className="bg-black/80 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-sm font-bold text-white z-10">
                            <Lock size={14} /> LOGIN TO VIEW EKKO ANALYSIS
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-500">
                        {vipPlot ? (
                            <div className="mb-4 text-sm text-gray-400 italic">"{vipPlot}"</div>
                        ) : (
                            <div className="mb-4 text-sm text-gray-500 italic">Analysis Unavailable.</div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {tags.length > 0 ? tags.map((tag, i) => (
                                <span key={i} className="bg-blue-900/30 text-blue-200 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
                                    {tag}
                                </span>
                            )) : null}
                        </div>
                    </div>
                )}
            </div>

            {/* RATING SECTION */}
            {/* If GUEST: Show Lock Message */}
            {isGuest ? (
                <div className="bg-white/5 p-6 rounded-xl border border-white/5 text-center mt-8">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="bg-white/10 p-3 rounded-full">
                            <Lock size={24} className="text-ekko-highlight" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">Login to Rate</h3>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 p-6 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rate this title</h3>
                         {/* DELETE BUTTON */}
                         {savedRating > 0 && (
                             <button 
                                 onClick={handleDeleteRating}
                                 className="text-red-500 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white/5"
                                 title="Delete Rating"
                                 disabled={loading}
                             >
                                 <Trash2 size={16} />
                             </button>
                         )}
                    </div>
                    
                    <div className="flex gap-1 items-center mb-4 flex-wrap justify-center sm:justify-start"> 
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                        <button
                            key={star}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(star)}
                            className="relative flex items-center justify-center transition-transform hover:scale-110 focus:outline-none w-8 h-8" // Made container explicit size
                        >
                            {/* The Star Icon */}
                            <Star 
                                size={32} // Slightly larger to fit text
                                fill={displayRating >= star ? "#EAB308" : "transparent"} 
                                color={displayRating >= star ? "#EAB308" : "#4B5563"} 
                                strokeWidth={1}
                            />
                            
                            {/* The Number Overlay */}
                            <span className={`
                                absolute text-[10px] font-bold select-none pointer-events-none pt-[2px]
                                ${displayRating >= star ? 'text-black' : 'text-gray-500'}
                            `}>
                                {star}
                            </span>
                        </button>
                    ))}
                    </div>

                    <div className="min-h-[3.5rem] flex items-center justify-between mt-2">
                        <div className={`flex flex-col gap-1.5 transition-opacity duration-300 ${displayRating > 0 ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-700 p-1 rounded-full text-gray-300"><User size={14} /></div>
                                <span className="text-white font-bold text-sm">{RATING_TEXT[displayRating]?.user || "..."}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-ekko-highlight p-1 rounded-full text-white"><Bot size={14} /></div>
                                <span className="text-ekko-highlight text-xs font-medium tracking-wide">{RATING_TEXT[displayRating]?.ai || "..."}</span>
                            </div>
                        </div>

                        {rating > 0 && rating !== savedRating && (
                            <button onClick={handleSubmit} disabled={loading} className="bg-white text-black hover:bg-gray-200 font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg">
                                {loading ? 'Saving...' : 'Confirm'}
                            </button>
                        )}
                        {savedRating > 0 && rating === savedRating && (
                             <span className="text-gray-500 text-xs uppercase tracking-widest font-bold border border-gray-600 px-3 py-2 rounded">Saved</span>
                        )}
                    </div>
                </div>
            )}
            
            {/* RELATED */}
            {!isGuest ? (
                onSwitchMovie && <SimilarRow tconst={movie.tconst} onSelect={onSwitchMovie} />
            ) : (
                <div className="mt-8 border-t border-white/5 pt-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Lock size={24} />
                        <p className="text-sm font-bold uppercase tracking-widest">Login to see similar titles</p>
                    </div>
                </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}