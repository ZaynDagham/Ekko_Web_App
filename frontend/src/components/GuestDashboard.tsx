"use client";

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { getPoster, getBackdrop } from '@/lib/tmdb';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import MovieModal from './MovieModal';
import PersonModal from './PersonModal';
import GlobalSearch from './GlobalSearch';

interface Movie {
  tconst: string;
  primaryTitle: string;
  posterUrl?: string | null;
}

interface GuestDashboardProps {
  onRequestSignup: () => void; 
  onExit: () => void; 
}

export default function GuestDashboard({ onRequestSignup, onExit }: GuestDashboardProps) {
  const [feed, setFeed] = useState<Movie[]>([]);
  const [hero, setHero] = useState<Movie | null>(null);
  
  // Modals
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Initial Load
  useEffect(() => {
    loadGuestFeed(0, true);
  }, []);

  // Fetch Logic
  async function loadGuestFeed(currentOffset: number, isInitial: boolean = false) {
      if (loadingMore) return;
      setLoadingMore(true);

      try {
        const limit = isInitial ? 50 : 30;
        const res = await api.get(`/feed/guest?limit=${limit}&offset=${currentOffset}`);
        const movies = res.data;

        if (movies.length === 0) {
            setHasMore(false);
            setLoadingMore(false);
            return;
        }

        // Hero Logic (First item of first batch)
        if (isInitial && movies.length > 0) {
            const heroUrl = await getBackdrop(movies[0].tconst);
            setHero({ ...movies[0], posterUrl: heroUrl });
        }

        // Posters
        const newBatch = await Promise.all(
          movies.map(async (m: any) => ({
            ...m,
            posterUrl: await getPoster(m.tconst)
          }))
        );

        // Update State with DUPLICATE CHECK
        if (isInitial) {
            setFeed(newBatch.slice(1));
            setOffset(50);
        } else {
            setFeed(prev => {
                // Create a Set of existing IDs to prevent duplicates
                const existingIds = new Set(prev.map(p => p.tconst));
                // Only add movies that are NOT in the Set
                const uniqueNewMovies = newBatch.filter(m => !existingIds.has(m.tconst));
                return [...prev, ...uniqueNewMovies];
            });
            setOffset(prev => prev + 30);
        }

      } catch (err) {
        console.error("Guest Feed error:", err);
      } finally {
        setLoadingMore(false);
      }
  }

  // 3. Infinite Scroll Handler
  useEffect(() => {
      const handleScroll = () => {
          if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && hasMore && !loadingMore) {
              loadGuestFeed(offset);
          }
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, [offset, hasMore, loadingMore]);


  if (!hero) return <div className="text-white text-center mt-20">Loading Preview...</div>;

  return (
    <div className="w-full pb-20 bg-ekko-dark min-h-screen relative">
      
      {/* LOCKED BANNER (UPDATED) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-ekko-highlight/90 backdrop-blur-md text-white text-center py-3 font-bold flex justify-center items-center gap-4 shadow-lg">
        <div className="flex items-center gap-2">
            <Lock size={16} />
            <span>GUEST MODE: READ ONLY</span>
        </div>

        <div className="flex items-center gap-2">
            {/* LOGIN / EXIT BUTTON */}
            <button 
                onClick={onExit}
                className="bg-black/20 hover:bg-black/40 text-white border border-white/20 px-4 py-1 rounded text-xs uppercase tracking-wider transition-colors"
            >
                Log In
            </button>

            <button 
                onClick={onRequestSignup}
                className="bg-white text-black px-4 py-1 rounded text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors font-bold"
            >
                Create Account
            </button>
        </div>
      </div>

      {/* GLOBAL SEARCH */}
      <div className="fixed top-16 left-0 right-0 z-40 px-4 flex justify-center">
          <GlobalSearch 
              onSelectMovie={setSelectedMovie} 
              onSelectPerson={setSelectedPerson} 
          />
      </div>

      {/* HERO SECTION */}
      <div className="relative w-full h-[70vh] flex items-end">
        <div className="absolute inset-0 z-0">
            {hero.posterUrl && (
                <img src={hero.posterUrl} className="w-full h-full object-cover object-top opacity-50 grayscale-[30%]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ekko-dark via-ekko-dark/60 to-transparent" />
        </div>

        <div className="relative z-10 p-12 max-w-4xl">
            <span className="bg-gray-600 text-xs font-bold px-3 py-1 rounded text-white mb-4 inline-block tracking-widest">
                #1 ON GLOBAL CHARTS
            </span>
            <h1 className="text-6xl font-black text-white mb-6 drop-shadow-lg leading-none">
                {hero.primaryTitle}
            </h1>
            <button 
                onClick={onRequestSignup}
                className="bg-ekko-highlight text-white font-bold py-3 px-8 rounded-full hover:bg-blue-600 transition-colors shadow-xl"
            >
                Create a Profile for More Details
            </button>
        </div>
      </div>

      {/* GRID SECTION */}
      <div className="px-12 -mt-6 relative z-20"> 
        <h2 className="text-2xl font-bold text-white mb-8 drop-shadow-md border-b border-gray-800 pb-4">
            Global Trending
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
            {feed.map((movie) => (
                <motion.div 
                    key={movie.tconst}
                    whileHover={{ scale: 1.05, y: -5 }}
                    onClick={() => setSelectedMovie(movie)}
                    className="cursor-pointer group"
                >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 mb-3 border border-white/5 shadow-lg group-hover:border-ekko-highlight/50 transition-colors">
                        {movie.posterUrl ? (
                            <img src={movie.posterUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="p-2 text-xs text-center flex h-full items-center text-gray-500">{movie.primaryTitle}</div>
                        )}
                    </div>
                    <div className="text-sm text-gray-400 font-medium line-clamp-1 group-hover:text-white transition-colors">
                        {movie.primaryTitle}
                    </div>
                </motion.div>
            ))}
        </div>
        
        {loadingMore && (
            <div className="w-full py-10 text-center text-gray-500 animate-pulse">
                Loading more titles...
            </div>
        )}
      </div>

      {/* MODAL FOR GUESTS */}
      {selectedMovie && (
        <MovieModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)} 
            isGuest={true} 
            onPersonClick={setSelectedPerson}
        />
      )}

      {/* PERSON MODAL FOR GUESTS */}
      {selectedPerson && (
          <PersonModal
              name={selectedPerson}
              onClose={() => setSelectedPerson(null)}
              onSelectMovie={setSelectedMovie}
              isGuest={true}
          />
      )}
    </div>
  );
}