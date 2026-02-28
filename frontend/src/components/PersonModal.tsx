"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, User, ChevronDown, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { getPoster, getPersonDetails } from '@/lib/tmdb'; 

interface PersonModalProps {
  name: string;
  onClose: () => void;
  onSelectMovie: (movie: any) => void;
  isGuest?: boolean; 
}

const BATCH_SIZE = 30;
export default function PersonModal({ name, onClose, onSelectMovie, isGuest }: PersonModalProps) {
  
  // Data State
  const [allMovies, setAllMovies] = useState<any[]>([]); 
  const [visibleMovies, setVisibleMovies] = useState<any[]>([]); 
  const [personInfo, setPersonInfo] = useState<{ image: string | null; bio: string } | null>(null);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFullBio, setShowFullBio] = useState(false);
  
  // Refs
  const listRef = useRef<HTMLDivElement>(null);

  // INITIAL LOAD
  useEffect(() => {
    async function init() {
        setLoading(true);
        try {
            // Parallel Fetch: Backend List + TMDB Details
            const [res, details] = await Promise.all([
                api.get(`/person/${encodeURIComponent(name)}`),
                getPersonDetails(name)
            ]);

            setPersonInfo(details);
            const fullList = res.data;
            setAllMovies(fullList);

            // Load first batch posters
            await loadBatch(fullList, 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }
    init();
  }, [name]);

  // BATCH LOADER
  const loadBatch = async (fullList: any[], pageNum: number) => {
      const start = 0;
      const end = pageNum * BATCH_SIZE;
      const slice = fullList.slice(start, end);

      // Fetch posters only for the new items that don't have one yet
      const enrichedSlice = await Promise.all(
          slice.map(async (m: any) => {
              if (!m.posterUrl) {
                  return { ...m, posterUrl: await getPoster(m.tconst) };
              }
              return m;
          })
      );

      setVisibleMovies(enrichedSlice);
      setPage(pageNum);
  };

  // INFINITE SCROLL HANDLER
  const handleScroll = () => {
      if (listRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = listRef.current;
          // Check if we are near bottom (within 100px)
          if (scrollHeight - scrollTop <= clientHeight + 100) {
              if (visibleMovies.length < allMovies.length) {
                  loadBatch(allMovies, page + 1);
              }
          }
      }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
          className="relative w-full max-w-6xl h-[85vh] bg-[#0a0a0a] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
            {/* HEADER */}
            <div className="p-8 border-b border-white/5 flex gap-6 bg-gradient-to-r from-ekko-highlight/10 to-transparent shrink-0">
                
                {/* Profile Pic */}
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border border-white/20 overflow-hidden shrink-0 shadow-lg">
                    {personInfo?.image ? (
                        <img src={personInfo.image} className="w-full h-full object-cover" alt={name} />
                    ) : (
                        <User size={32} className="text-white" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-2">{name}</h2>
                            <p className="text-ekko-highlight text-xs font-bold uppercase tracking-widest bg-ekko-highlight/10 px-2 py-1 rounded inline-block mb-3">
                                Biography • {allMovies.length} Titles
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/20 rounded-full text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Biography */}
                    <div 
                        className={`text-gray-300 text-sm leading-relaxed max-w-4xl transition-all duration-300 relative ${
                            !showFullBio 
                                ? 'line-clamp-2 cursor-pointer hover:text-white' 
                                : 'max-h-40 overflow-y-auto custom-scrollbar pr-2'
                        }`}
                        onClick={() => !showFullBio && setShowFullBio(true)}
                    >
                        {personInfo?.bio || "No biography available."}
                        
                        {/* Collapse Button */}
                        {showFullBio && (
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFullBio(false);
                                }}
                                className="block mt-2 text-ekko-highlight text-xs font-bold hover:underline sticky bottom-0 bg-[#0a0a0a]/90 w-full text-left py-1"
                             >
                                Show Less
                             </button>
                        )}
                        
                        {/* Expand Hint */}
                        {personInfo?.bio && personInfo.bio.length > 150 && !showFullBio && (
                           <span className="text-ekko-highlight font-bold ml-2 text-xs">Read more</span>
                        )}
                    </div>
                </div>
            </div>

            {/* GRID (Scrollable) */}
            <div 
                ref={listRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-8 custom-scrollbar relative"
            >
                {/* GUEST LOCK OVERLAY */}
                {isGuest && (
                    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
                        <div className="bg-ekko-card border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md">
                            <Lock size={48} className="mx-auto text-ekko-highlight mb-4" />
                            <h3 className="text-2xl font-bold text-white mb-2">Login Required</h3>
                            <p className="text-gray-400 mb-6">
                                Create an account to view <strong>{name}'s</strong> full filmography and see how much you match with their work.
                            </p>
                            <button 
                                onClick={onClose} 
                                className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center text-gray-500 mt-20 animate-pulse">Scanning database...</div>
                ) : (
                    <>
                        <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 ${isGuest ? 'opacity-20 pointer-events-none' : ''}`}>
                            {visibleMovies.map((movie, i) => (
                                <motion.div
                                    key={movie.tconst}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    onClick={() => onSelectMovie(movie)}
                                    className="group cursor-pointer"
                                >
                                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 mb-3 border border-white/5 relative shadow-lg group-hover:shadow-ekko-highlight/20 transition-all group-hover:scale-105 group-hover:border-ekko-highlight">
                                        {movie.posterUrl ? (
                                            <img src={movie.posterUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 text-center p-2">
                                                {movie.primaryTitle}
                                            </div>
                                        )}
                                        
                                        {/* Match Score Badge */}
                                        {movie.score > 0 && (
                                            <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-ekko-highlight border border-white/10">
                                                {Math.round(movie.score * 100)}% Match
                                            </div>
                                        )}
                                    </div>
                                    
                                    <h4 className="text-white font-bold text-sm truncate group-hover:text-ekko-highlight transition-colors">
                                        {movie.primaryTitle}
                                    </h4>
                                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                                        <span>{movie.startYear}</span>
                                        <span className="flex items-center gap-1 text-yellow-600">
                                            <Star size={10} fill="currentColor" /> {movie.averageRating}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Loading Indicator at bottom */}
                        {visibleMovies.length < allMovies.length && (
                            <div className="w-full py-8 flex justify-center text-gray-500 animate-pulse text-sm">
                                Loading more titles...
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}