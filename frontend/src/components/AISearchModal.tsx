"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Brain, Star, ChevronRight, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { getPoster } from '@/lib/tmdb';

interface AISearchModalProps {
  onClose: () => void;
  onSelectMovie: (movie: any) => void;
}

interface SemanticResult {
  tconst: string;
  primaryTitle: string;
  startYear: number;
  averageRating: number;
  similarity: number;
  score: number; 
  posterUrl?: string | null;
}

export default function AISearchModal({ onClose, onSelectMovie }: AISearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults([]);

    try {
      const res = await api.get(`/search/semantic?q=${encodeURIComponent(query)}`);
      const rawResults: SemanticResult[] = res.data;

      const enrichedResults = await Promise.all(
        rawResults.map(async (m) => ({
          ...m,
          posterUrl: await getPoster(m.tconst)
        }))
      );

      setResults(enrichedResults);
    } catch (err) {
      console.error("AI Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/80 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }}
          className="w-full max-w-4xl bg-[#0f0f13] border border-ekko-highlight/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
            {/* HEADER */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-ekko-highlight/10 to-transparent shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-ekko-highlight">
                        <Brain size={24} />
                        <h2 className="font-black tracking-widest text-lg uppercase">AI Search</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSearch} className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-12 py-4 text-lg text-white placeholder-gray-500 focus:outline-none focus:border-ekko-highlight focus:ring-1 focus:ring-ekko-highlight transition-all"
                        placeholder="Describe the title/story you are looking for..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <button 
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-ekko-highlight hover:bg-ekko-highlight/80 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChevronRight size={20} />}
                    </button>
                </form>
            </div>

            {/* RESULTS */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {results.length === 0 && !loading && (
                    <div className="text-center py-20 text-gray-600">
                        <Zap size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Enter a prompt to start the search process.</p>
                    </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {results.map((movie, i) => {
                        const matchPercent = movie.score ? Math.round(movie.score * 100) : 0;
                        
                        let badgeColor = "bg-gray-600";
                        if (matchPercent > 60) badgeColor = "bg-ekko-highlight";
                        if (matchPercent > 75) badgeColor = "bg-green-600";
                        if (matchPercent > 85) badgeColor = "bg-purple-600";

                        return (
                            <motion.div
                                key={movie.tconst}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => onSelectMovie(movie)}
                                className="group cursor-pointer flex flex-col"
                            >
                                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 shadow-lg border border-white/10 relative group-hover:scale-105 transition-transform duration-300">
                                    {movie.posterUrl ? (
                                        <img src={movie.posterUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2 text-center">
                                            {movie.primaryTitle}
                                        </div>
                                    )}

                                    {/* MATCH BADGE */}
                                    {matchPercent > 0 && (
                                        <div className={`absolute top-2 right-2 ${badgeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md backdrop-blur-md`}>
                                            {matchPercent}%
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 text-center px-1">
                                    <h3 className="text-white text-sm font-bold leading-tight group-hover:text-ekko-highlight transition-colors">
                                        {movie.primaryTitle}
                                    </h3>
                                    
                                    <div className="flex items-center justify-center gap-3 mt-1 text-xs text-gray-400">
                                        <span>{movie.startYear}</span>
                                        <span className="flex items-center gap-1 text-yellow-500">
                                            <Star size={10} fill="currentColor" /> 
                                            {movie.averageRating.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}