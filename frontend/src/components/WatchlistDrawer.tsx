"use client";

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getPoster } from '@/lib/tmdb';
import { X, Search, List, Trash2, CheckCircle, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WatchlistItem {
  tconst: string;
  primaryTitle: string;
  startYear: number;
  averageRating: number;
  isWatched: boolean;
  posterUrl?: string | null;
}

interface WatchlistDrawerProps {
  user: any;
  onClose: () => void;
  onSelectMovie: (movie: any) => void;
}

export default function WatchlistDrawer({ user, onClose, onSelectMovie }: WatchlistDrawerProps) {
  const [list, setList] = useState<WatchlistItem[]>([]);
  const [filteredList, setFilteredList] = useState<WatchlistItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Load Data
  const fetchWatchlist = async () => {
      setLoading(true);
      try {
        const res = await api.get('/watchlist');
        const rawList = res.data;

        // Fetch posters for top 20
        const listWithPosters = await Promise.all(
            rawList.map(async (item: any, index: number) => {
                if (index < 20) {
                    return { ...item, posterUrl: await getPoster(item.tconst) };
                }
                return item;
            })
        );
        setList(listWithPosters);
        setFilteredList(listWithPosters);
      } catch (err) {
        console.error("Failed to load watchlist", err);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Filter Logic
  useEffect(() => {
    if (searchQuery.trim() === "") {
        setFilteredList(list);
    } else {
        const lowerQ = searchQuery.toLowerCase();
        const filtered = list.filter(item => 
            item.primaryTitle.toLowerCase().includes(lowerQ)
        );
        setFilteredList(filtered);
    }
  }, [searchQuery, list]);

  // Actions
  const handleRemove = async (tconst: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          await api.post(`/watchlist/${tconst}`); 
          // Update local state instantly
          const newList = list.filter(item => item.tconst !== tconst);
          setList(newList);
      } catch (err) { console.error(err); }
  };

  const handleCleanup = async () => {
      // Remove all "Watched" items
      const watchedItems = list.filter(item => item.isWatched);
      for (const item of watchedItems) {
          await api.post(`/watchlist/${item.tconst}`);
      }
      fetchWatchlist(); // Refresh
  };

  const watchedCount = list.filter(i => i.isWatched).length;

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
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-full"><List size={20} className="text-white"/></div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">WATCHLIST</h2>
                        <p className="text-gray-400 text-xs uppercase tracking-widest">
                            {list.length} Titles • {watchedCount} Watched
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Actions Row */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Filter list..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
                    />
                </div>
                
                {watchedCount > 0 && (
                    <button 
                        onClick={handleCleanup}
                        className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 px-3 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors"
                        title="Remove all watched movies"
                    >
                        <CheckCircle size={14} /> Clean Up
                    </button>
                )}
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {loading ? (
                <div className="text-center text-gray-500 mt-10">Syncing...</div>
            ) : filteredList.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                    {searchQuery ? "No matches." : "Your list is empty."}
                </div>
            ) : (
                filteredList.map((item) => (
                    <div 
                        key={item.tconst} 
                        onClick={() => onSelectMovie(item)}
                        className="group flex gap-4 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer transition-all relative overflow-hidden"
                    >
                         {/* Watched Indicator */}
                         {item.isWatched && (
                             <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-500/50" />
                         )}

                        {/* Tiny Poster */}
                        <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden shrink-0 border border-white/5 relative">
                            {item.posterUrl && <img src={item.posterUrl} className="w-full h-full object-cover" />}
                            {item.isWatched && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Eye size={16} className="text-green-400" />
                                </div>
                            )}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className={`text-sm font-bold truncate transition-colors ${item.isWatched ? "text-gray-500 line-through" : "text-white group-hover:text-ekko-highlight"}`}>
                                {item.primaryTitle}
                            </h4>
                            
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span>{item.startYear}</span>
                                <span className="text-yellow-600 flex items-center gap-1">★ {item.averageRating}</span>
                            </div>
                        </div>

                        {/* Delete Button (Appears on Hover) */}
                        <button 
                            onClick={(e) => handleRemove(item.tconst, e)}
                            className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))
            )}
        </div>
      </motion.div>
    </div>
  );
}