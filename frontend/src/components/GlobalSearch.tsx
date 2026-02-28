"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, X, Film, User, Clapperboard, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { getPoster, getPersonDetails } from '@/lib/tmdb';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  type: 'movie' | 'person';
  id: string;           
  title: string;        
  year?: number;        
  rating?: number;      
  role?: string;        
  posterUrl?: string | null;
}

interface GlobalSearchProps {
  onSelectMovie: (movie: any) => void;
  onSelectPerson?: (name: string) => void; 
}

export default function GlobalSearch({ onSelectMovie, onSelectPerson }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) { 
        setLoading(true);
        try {
          const res = await api.get(`/search?q=${query}`);
          const rawResults: SearchResult[] = res.data;
          
          setResults(rawResults);

          const resultsWithImages = await Promise.all(
            rawResults.map(async (item) => {
              let imageUrl = null;
              
              if (item.type === 'movie') {
                imageUrl = await getPoster(item.id);
              } else if (item.type === 'person') {
                const details = await getPersonDetails(item.title);
                imageUrl = details?.image || null;
              }

              return { ...item, posterUrl: imageUrl };
            })
          );
          
          setResults(resultsWithImages);

        } catch (err) {
          console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300); 

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelection = (item: SearchResult) => {
      if (item.type === 'person') {
          if (onSelectPerson) onSelectPerson(item.id);
      } else {
          onSelectMovie({
              tconst: item.id,
              primaryTitle: item.title,
              startYear: item.year,
              posterUrl: item.posterUrl
          });
      }
      setQuery("");
      setResults([]);
  };

return (
    <div ref={searchRef} className="relative w-full max-w-md mx-auto z-40">
      
      {/* INPUT BAR */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-ekko-highlight transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-10 py-3 border border-white/10 rounded-full leading-5 bg-black/50 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-black/80 focus:border-ekko-highlight focus:ring-1 focus:ring-ekko-highlight sm:text-sm transition-all backdrop-blur-md shadow-lg"
          placeholder="Search movies, actors, directors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {loading ? (
                <div className="w-4 h-4 border-2 border-ekko-highlight border-t-transparent rounded-full animate-spin" />
            ) : query.length > 0 ? (
                <button onClick={() => { setQuery(""); setResults([]); }}>
                    <X className="h-4 w-4 text-gray-500 hover:text-white" />
                </button>
            ) : null}
        </div>
      </div>

      {/* RESULTS DROPDOWN */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute mt-2 w-full rounded-xl bg-ekko-card border border-white/10 shadow-2xl overflow-hidden"
          >
            <ul className="max-h-96 overflow-y-auto custom-scrollbar py-2">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelection(item)}
                    className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-4 group border-b border-white/5 last:border-0"
                  >
                    {/* THUMBNAIL */}
                    <div className="w-10 h-14 shrink-0 rounded overflow-hidden bg-gray-800 shadow-sm border border-white/5 relative flex items-center justify-center">
                        {item.posterUrl ? (
                            <img src={item.posterUrl} className="w-full h-full object-cover" alt={item.title} />
                        ) : (
                            item.type === 'movie' ? <Film size={18} className="text-gray-500" /> : <User size={18} className="text-ekko-highlight" />
                        )}
                    </div>

                    {/* TEXT INFO */}
                    <div>
                        <div className="text-gray-200 font-bold text-sm line-clamp-1 group-hover:text-white transition-colors flex items-center gap-2">
                            {item.title}
                            {item.type === 'person' && (
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-normal uppercase">Person</span>
                            )}
                        </div>
                        
                        <div className="text-gray-500 text-xs mt-0.5 font-mono">
                            {item.type === 'movie' 
                                ? (
                                    <span className="flex items-center gap-1">
                                        {item.year || "N/A"} • <span className="text-yellow-500 flex items-center gap-0.5"><Star size={10} fill="currentColor" /> {item.rating || "?"}</span>
                                    </span>
                                )
                                : <span className="flex items-center gap-1 text-ekko-highlight"><Clapperboard size={10} /> Filmography</span>
                            }
                        </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}