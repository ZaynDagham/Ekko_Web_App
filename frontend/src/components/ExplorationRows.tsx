"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getPoster } from '@/lib/tmdb';
import { motion } from 'framer-motion';
import { Star, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { useRef } from 'react';

interface Movie {
  tconst: string;
  primaryTitle: string;
  startYear: number;
  averageRating: number;
  score?: number;
  posterUrl?: string | null;
}

interface ExplorationGroup {
  source: {
    tconst: string;
    primaryTitle: string;
    score: number;
  };
  items: Movie[];
}

interface ExplorationRowsProps {
  onSelectMovie: (movie: any) => void;
  refreshTrigger: number;
}

export default function ExplorationRows({ onSelectMovie, refreshTrigger }: ExplorationRowsProps) {
  const [groups, setGroups] = useState<ExplorationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/feed/exploration');
        const rawGroups: ExplorationGroup[] = res.data;

        // Fetch posters for all items in all groups
        const enrichedGroups = await Promise.all(
          rawGroups.map(async (group) => {
            const itemsWithPosters = await Promise.all(
              group.items.map(async (m) => ({
                ...m,
                posterUrl: await getPoster(m.tconst)
              }))
            );
            return { ...group, items: itemsWithPosters };
          })
        );

        setGroups(enrichedGroups);
      } catch (err) {
        console.error("Exploration feed error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshTrigger]);

  if (loading) return null;
  if (groups.length === 0) return null;

  return (
    <div className="space-y-12 mb-12">
      {groups.map((group, groupIndex) => (
        <ExplorationRow 
            key={group.source.tconst} 
            group={group} 
            onSelectMovie={onSelectMovie} 
            index={groupIndex}
        />
      ))}
    </div>
  );
}

// Sub-component for individual scrolling rows
function ExplorationRow({ group, onSelectMovie, index }: { group: ExplorationGroup, onSelectMovie: (m: any) => void, index: number }) {
    const rowRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (rowRef.current) {
            const { current } = rowRef;
            const scrollAmount = 600;
            if (direction === 'left') current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            else current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <div className="px-12 relative z-20">
            {/* HEADER */}
            <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-2xl font-bold text-white drop-shadow-md flex items-center gap-2">
                    {index === 0 ? <Sparkles className="text-yellow-500" size={20} /> : <Sparkles className="text-blue-500" size={20} />}
                    Because you rated
                    <span className="text-ekko-highlight">"{group.source.primaryTitle}"</span>
                    highly
                </h2>
            </div>

            {/* SCROLLABLE ROW */}
            <div className="relative group">
                <button 
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-[43%] -translate-y-1/2 z-30 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-ekko-highlight hover:scale-110 -ml-6"
                >
                    <ChevronLeft size={32} />
                </button>

                <div 
                    ref={rowRef}
                    className="flex gap-4 overflow-x-auto py-4 pb-4 scroll-smooth no-scrollbar"
                >
                    {group.items.map((movie) => {
                        // Calculate Badge Color & Text
                        const matchPercent = movie.score ? Math.round(movie.score * 100) : 0;
                        let badgeColor = "bg-gray-600";
                        if (matchPercent > 85) badgeColor = "bg-purple-600";
                        else if (matchPercent > 70) badgeColor = "bg-green-600";

                        return (
                            <motion.div 
                                key={movie.tconst}
                                whileHover={{ scale: 1.05, y: -10 }}
                                onClick={() => onSelectMovie(movie)}
                                className="min-w-[200px] cursor-pointer"
                            >
                                {/* CARD IMAGE */}
                                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 mb-3 border border-white/10 shadow-lg relative group">
                                    {movie.posterUrl ? (
                                        <img src={movie.posterUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="p-2 text-xs text-center flex h-full items-center text-gray-500">{movie.primaryTitle}</div>
                                    )}

                                    {/*  MATCH BADGE*/}
                                    {matchPercent > 0 && (
                                        <div className="absolute top-2 right-2 shadow-lg">
                                            <div className={`
                                                px-2 py-1 rounded text-[10px] font-black tracking-tighter text-white backdrop-blur-md border border-white/20
                                                ${badgeColor}/90
                                            `}>
                                                {matchPercent}%
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* TEXT INFO */}
                                <div className="text-center px-1">
                                    <div className="text-sm text-gray-300 font-bold line-clamp-1 leading-tight mb-1">
                                        {movie.primaryTitle}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500">
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

                <button 
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-[43%] -translate-y-1/2 z-30 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-ekko-highlight hover:scale-110 -mr-6"
                >
                    <ChevronRight size={32} />
                </button>
            </div>
        </div>
    );
}