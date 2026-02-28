"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { getPoster } from '@/lib/tmdb';
import { X, Star, Calendar, Search, UploadCloud, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Importer from './Importer';

interface HistoryItem {
  tconst: string;
  primaryTitle: string;
  startYear: number;
  score: number;
  timestamp: string;
  averageRating?: number;
  posterUrl?: string | null;
}

interface UserProfileProps {
  user: any;
  onClose: () => void;
  onLogout: () => void;
  onSelectMovie: (movie: any) => void;
}

export default function UserProfile({ user, onClose, onLogout, onSelectMovie }: UserProfileProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Pagination State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Importer
  const [showImporter, setShowImporter] = useState(false);

  // Debounce Search Ref
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // FETCH FUNCTION
  const fetchHistory = async (reset = false, query = "") => {
      setLoading(true);
      try {
          // If reset, start from 0. Else use current offset
          const currentOffset = reset ? 0 : offset;
          
          const res = await api.get(`/users/history?limit=30&offset=${currentOffset}&q=${query}`);
          const { items, total } = res.data;

          // Fetch Posters for this chunk
          const itemsWithPosters = await Promise.all(
              items.map(async (item: any) => ({
                  ...item,
                  posterUrl: await getPoster(item.tconst)
              }))
          );

          if (reset) {
              setHistory(itemsWithPosters);
              setOffset(30); // Next batch starts at 30
          } else {
              setHistory(prev => [...prev, ...itemsWithPosters]);
              setOffset(prev => prev + 30);
          }

          setTotal(total);
          setHasMore(currentOffset + 30 < total);

      } catch (err) {
          console.error("History error", err);
      } finally {
          setLoading(false);
      }
  };

  // Initial Load
  useEffect(() => {
      fetchHistory(true, "");
  }, []);

  // 2. HANDLE SEARCH (Debounced)
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setSearchQuery(q);
      
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      
      searchTimeout.current = setTimeout(() => {
          // Reset pagination when searching
          setOffset(0); 
          fetchHistory(true, q);
      }, 500); // Wait 500ms after typing
  };

  // 3. INFINITE SCROLL HANDLER
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
      // If we are near bottom (10px buffer) and not loading
      if (scrollHeight - scrollTop <= clientHeight + 10 && hasMore && !loading) {
          fetchHistory(false, searchQuery);
      }
  };

  const formatDate = (isoString: string) => {
      if (!isoString) return "";
      return new Date(isoString).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
      });
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div 
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md h-full bg-ekko-card border-l border-white/10 shadow-2xl flex flex-col"
      >
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-black/20">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">MY PROFILE</h2>
                    <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">
                        {user.email}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Import Button */}
            <div className="pt-3 pb-6">
                <button 
                    onClick={() => setShowImporter(true)}
                    className="w-full py-2.5 border border-dashed border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-ekko-highlight hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider"
                >
                    <UploadCloud size={16} />
                    Import IMDb History
                </button>
            </div>

            {/* Server-Side Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-500 " size={16} />
                <input 
                    type="text" 
                    placeholder="Search your history..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-ekko-highlight transition-colors"
                />
            </div>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-ekko-highlight/10 flex justify-between items-center border-b border-white/5">
            <div className="text-center">
                <div className="text-xl font-bold text-white">{total}</div>
                <div className="text-[10px] text-ekko-highlight uppercase font-bold tracking-wider">Calibrations</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <button 
                onClick={onLogout}
                className="text-xs font-bold text-red-400 hover:text-red-300 uppercase tracking-widest border border-red-500/30 px-4 py-2 rounded hover:bg-red-500/10 transition-colors"
            >
                Sign Out
            </button>
        </div>

        {/* History List */}
        <div 
            className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3"
            onScroll={handleScroll}
        >
            {history.length === 0 && !loading ? (
                <div className="text-center text-gray-500 mt-10">
                    {searchQuery ? "No matches found." : "No data points yet."}
                </div>
            ) : (
                <>
                    {history.map((item) => (
                        <button 
                            key={item.tconst} 
                            onClick={() => onSelectMovie(item)}
                            className="w-full flex gap-4 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-ekko-highlight/30 transition-all group text-left"
                        >
                            <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden shrink-0 border border-white/5">
                                {item.posterUrl && <img src={item.posterUrl} className="w-full h-full object-cover" />}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="text-white font-bold text-sm truncate group-hover:text-ekko-highlight transition-colors">
                                    {item.primaryTitle}
                                </h4>
                                
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-gray-500 text-xs">{item.startYear}</span>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-600 bg-black/30 px-2 py-0.5 rounded">
                                        <Calendar size={10} />
                                        {formatDate(item.timestamp)}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 mt-2">
                                    <Star size={12} className={item.score >= 7 ? "text-ekko-highlight" : "text-gray-400"} fill="currentColor" />
                                    <span className={`text-xs font-bold ${item.score >= 7 ? "text-ekko-highlight" : "text-gray-400"}`}>
                                        {item.score} / 10
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                    
                    {/* STATUS BAR AT BOTTOM */}
                    <div className="py-4 text-center">
                        {loading && <Loader2 className="w-6 h-6 animate-spin mx-auto text-ekko-highlight" />}
                        {!hasMore && history.length > 0 && (
                            <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                                End of History
                            </div>
                        )}
                        <div className="w-32 h-1 bg-gray-800 rounded-full mx-auto mt-2 overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min((history.length / total) * 100, 100)}%` }} 
                            />
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">
                            Showing {history.length} / {total}
                        </div>
                    </div>
                </>
            )}
        </div>
      </motion.div>
      
      {/* IMPORTER OVERLAY */}
      <AnimatePresence>
        {showImporter && (
            <Importer 
                onClose={() => setShowImporter(false)} 
                onComplete={() => { window.location.reload(); }} 
            />
        )}
      </AnimatePresence>
    </div>
  );
}