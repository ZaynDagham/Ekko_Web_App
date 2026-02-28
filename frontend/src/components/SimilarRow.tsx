"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getPoster } from '@/lib/tmdb';
import { motion } from 'framer-motion';
import { Star, TrendingUp } from 'lucide-react';

interface SimilarRowProps {
  tconst: string;
  onSelect: (movie: any) => void;
}

export default function SimilarRow({ tconst, onSelect }: SimilarRowProps) {
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilar() {
      try {
        setLoading(true);
        // This endpoint returns 'user_probability' now (from Phase 16)
        const res = await api.get(`/movie/${tconst}/similar`);
        
        // Fetch posters
        const withPosters = await Promise.all(
          res.data.map(async (m: any) => ({
            ...m,
            posterUrl: await getPoster(m.tconst)
          }))
        );
        
        setMovies(withPosters);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    if (tconst) fetchSimilar();
  }, [tconst]);

  if (loading) return <div className="h-40 flex items-center justify-center text-gray-600 animate-pulse">Scanning network...</div>;
  if (movies.length === 0) return null;

  return (
    <div className="mt-8 border-t border-white/5 pt-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-ekko-highlight" />
            More Like This
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {movies.map((movie) => {
                // Convert probability (0.0 - 1.0) to Percentage
                // We use 'user_probability' if available, otherwise 'similarity_score'
                const rawScore = movie.user_probability || movie.similarity_score || 0;
                const matchPercent = Math.round(rawScore * 100);

                return (
                    <motion.div 
                        key={movie.tconst}
                        whileHover={{ scale: 1.05 }}
                        className="cursor-pointer group relative"
                        onClick={() => onSelect(movie)}
                    >
                        {/* CARD IMAGE */}
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 border border-white/10 relative shadow-md">
                            {movie.posterUrl ? (
                                <img src={movie.posterUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2 text-center">
                                    {movie.primaryTitle}
                                </div>
                            )}

                            {/* MATCH BADGE */}
                            {matchPercent > 0 && (
                                <div className="absolute top-2 right-2 shadow-lg">
                                    <div className={`
                                        px-2 py-0.5 rounded text-[10px] font-black tracking-tighter text-white backdrop-blur-md border border-white/20
                                        ${matchPercent > 85 ? 'bg-purple-600/90' : 
                                          matchPercent > 70 ? 'bg-green-600/90' : 
                                          'bg-gray-600/90'}
                                    `}>
                                        {matchPercent}%
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* TEXT INFO */}
                        <div className="mt-2 text-center">
                            <h4 className="text-xs font-bold text-gray-300 truncate group-hover:text-white transition-colors">
                                {movie.primaryTitle}
                            </h4>
                            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                <span>{movie.startYear}</span>
                                <span className="flex items-center gap-0.5 text-yellow-600">
                                    <Star size={8} fill="currentColor" /> {movie.averageRating}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    </div>
  );
}