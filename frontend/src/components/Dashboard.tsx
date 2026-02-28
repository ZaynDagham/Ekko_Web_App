"use client";

import { useEffect, useState, useRef, RefObject } from 'react';
import { api } from '@/lib/api';
import { getPoster, getBackdrop } from '@/lib/tmdb';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import MovieModal from './MovieModal';
import GlobalSearch from './GlobalSearch';
import { User as UserIcon } from 'lucide-react'; 
import UserProfile from './UserProfile';
import { useAuthStore } from '@/store/authStore'; 
import GenreBar from './GenreBar';
import WatchlistDrawer from './WatchlistDrawer';
import { Bookmark as BookmarkCheck } from 'lucide-react';
import PersonModal from './PersonModal';
import ExplorationRows from './ExplorationRows';
import AISearchModal from './AISearchModal';
import LoadingScreen from './LoadingScreen';

interface Movie {
  tconst: string;
  primaryTitle: string;
  posterUrl?: string | null;
  score?: number;
}

export default function Dashboard() {
  // STATE MANAGEMENT
  const [feed, setFeed] = useState<Movie[]>([]);     
  const [genreFeed, setGenreFeed] = useState<Movie[]>([]);
  const [hero, setHero] = useState<Movie | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeGenre, setActiveGenre] = useState("Action"); 

  // SCROLL REFS
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const genreScrollRef = useRef<HTMLDivElement>(null);

  const [showProfile, setShowProfile] = useState(false);
  const { user, logout } = useAuthStore();
  const isGuest = user?.email === 'guest';
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAISearch, setShowAISearch] = useState(false);

  // HELPERS
  const preloadImage = (src: string) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = resolve;
      img.onerror = resolve; 
    });
  };

  const handleSearchSelect = async (miniMovie: any) => {
     let finalPoster = miniMovie.posterUrl;
     if (!finalPoster) {
         finalPoster = await getPoster(miniMovie.tconst);
     }
     setSelectedMovie({ ...miniMovie, posterUrl: finalPoster });
  };

  // SCROLL LOGIC
  const scroll = (ref: RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) { 
      const { current } = ref;
      const scrollAmount = 600; 
      const maxScrollLeft = current.scrollWidth - current.clientWidth;

      if (direction === 'left') {
        if (current.scrollLeft <= 10) current.scrollTo({ left: maxScrollLeft, behavior: 'smooth' });
        else current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        if (current.scrollLeft >= maxScrollLeft - 10) current.scrollTo({ left: 0, behavior: 'smooth' });
        else current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  // DATA LOADING

  const loadMainFeed = async () => {
      try {
        const res = await api.get('/feed');
        const movies = res.data;

        if (movies.length > 0) {
             const heroUrl = await getBackdrop(movies[0].tconst);
             if (heroUrl && !hero) await preloadImage(heroUrl);
             setHero({ ...movies[0], posterUrl: heroUrl });
        }
        
        const feedWithPosters = await Promise.all(
          movies.map(async (m: any) => ({
            ...m,
            posterUrl: await getPoster(m.tconst)
          }))
        );
        
        setFeed(feedWithPosters.slice(1));
      } catch (err) {
        console.error("Main Feed error:", err);
      }
  };

  const loadGenreFeed = async (genre: string) => {
      try {
        const endpoint = genre === "All" ? '/feed' : `/feed/${genre}`;
        const res = await api.get(endpoint);
        const movies = res.data;
        
        const feedWithPosters = await Promise.all(
          movies.map(async (m: any) => ({
            ...m,
            posterUrl: await getPoster(m.tconst)
          }))
        );
        setGenreFeed(feedWithPosters);
      } catch (err) {
        console.error("Genre Feed error:", err);
      }
  };

  const refreshAll = async (showAnim = false) => {
      if (showAnim) setIsRefreshing(true);
      await Promise.all([
          loadMainFeed(),
          loadGenreFeed(activeGenre)
      ]);
      if (showAnim) setTimeout(() => setIsRefreshing(false), 500);
      setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    refreshAll(false);
  }, []);

  useEffect(() => {
    loadGenreFeed(activeGenre);
  }, [activeGenre]);

  useEffect(() => {
    const attachScroll = (ref: RefObject<HTMLDivElement | null>) => {
        const el = ref.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    };

    const cleanup1 = attachScroll(mainScrollRef);
    const cleanup2 = attachScroll(genreScrollRef);

    return () => {
        if (cleanup1) cleanup1();
        if (cleanup2) cleanup2();
    }
  }, [feed, genreFeed]);

  if (!hero) return <LoadingScreen />;
  return (
    <div className="w-full pb-20 min-h-screen relative overflow-hidden">
        
      {/*  BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 scale-110"
            style={{ backgroundImage: "url('/background.jpg')" }} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      </div>

      {/*  HEADER AREA (Global Search + AI Button) */}
      <div className="absolute top-6 left-0 right-0 z-40 flex justify-center items-center gap-4 px-4 pointer-events-none">
          
          {/* Global Search Container*/}
          <div className="pointer-events-auto w-full max-w-md">
              <GlobalSearch 
                  onSelectMovie={handleSearchSelect} 
                  onSelectPerson={(name) => setSelectedPerson(name)} 
              />
          </div>

          {/* AI Search Button*/}
          <div className="pointer-events-auto shrink-0">
              <button 
                onClick={() => setShowAISearch(true)}
                className="flex items-center gap-2 bg-ekko-highlight/20 hover:bg-ekko-highlight/40 backdrop-blur-md border border-ekko-highlight/50 text-white px-4 py-3 rounded-full transition-all hover:scale-105 shadow-[0_0_15px_rgba(79,70,229,0.3)] group"
              >
                  <Sparkles size={18} className="text-ekko-highlight group-hover:text-white transition-colors" />
                  <span className="font-bold text-sm tracking-wide">AI Search</span>
              </button>
          </div>
      </div>

      {/* WATCHLIST TRIGGER */}
        <button 
        onClick={() => setShowWatchlist(true)}
        className="absolute top-6 right-24 z-50 bg-black/50 backdrop-blur-md p-3 rounded-full text-white border border-white/10 hover:bg-white/20 hover:scale-110 transition-all shadow-xl"
        >
        <BookmarkCheck size={24} />
        </button>
      {/* PROFILE */}
        <button 
          onClick={() => setShowProfile(true)}
          className="absolute top-6 right-8 z-50 bg-black/50 backdrop-blur-md p-3 rounded-full text-white border border-white/10 hover:bg-white/20 hover:scale-110 transition-all shadow-xl"
        >
          <UserIcon size={24} />
        </button>

      {/* REFRESH OVERLAY */}
      <AnimatePresence>
        {isRefreshing && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center"
            >
                <Loader2 className="w-12 h-12 text-ekko-highlight animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-white tracking-widest animate-pulse">RE-CALIBRATING</h2>
                <p className="text-gray-400 text-sm mt-2">Updating Profile...</p>
            </motion.div>
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <div className="relative w-full h-[85vh] flex items-end">
        <div className="absolute inset-0 z-0">
            {hero.posterUrl && (
                <img 
                    src={hero.posterUrl} 
                    className="w-full h-full object-cover object-top transition-opacity duration-700"
                    alt="Hero Backdrop"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[1cm] blur-2xl bg-gradient-to-t from-black/0 to-black/100" />
        </div>

        <div className="relative z-10 p-12 max-w-3xl mb-16">
            <span className="bg-ekko-highlight text-xs font-bold px-3 py-1 rounded text-white mb-4 inline-block tracking-widest">
                #1 MATCH FOR YOU
            </span>
            <h1 className="text-7xl font-black text-white mb-6 drop-shadow-lg leading-none">
                {hero.primaryTitle}
            </h1>
            <p className="text-gray-200 text-xl mb-8 line-clamp-3 drop-shadow-md max-w-2xl">
                The AI has identified this as your optimal entertainment match based on your recent activity.
            </p>
            <div className="flex gap-4">
                <button 
                    onClick={() => setSelectedMovie(hero)}
                    className="bg-white text-black font-bold py-4 px-7 rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    View Plot
                </button>
                <button 
                    onClick={() => setSelectedMovie(hero)}
                    className="bg-gray-600/80 backdrop-blur-md text-white font-bold py-4 px-10 rounded hover:bg-gray-500/80 transition-colors"
                >
                    More Info
                </button>
            </div>
        </div>
      </div>

      {/* ROW 1: TOP PICKS */}
      <div className="px-12 relative z-20 mb-12"> 
        <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-md pl-1 flex items-center gap-2">
            Top Picks For You
            <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded font-normal uppercase tracking-wider">AI Curated</span>
        </h2>
        
        <div className="relative group">
            <button 
                onClick={() => scroll(mainScrollRef, 'left')}
                className="absolute left-0 top-[43%] -translate-y-1/2 z-30 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-ekko-highlight hover:scale-110 -ml-6"
            >
                <ChevronLeft size={32} />
            </button>

            <div 
                ref={mainScrollRef}
                className="flex gap-2 overflow-x-auto py-4 pb-4 scroll-smooth"
            >
                {feed.map((movie) => (
                    <motion.div 
                        key={movie.tconst}
                        whileHover={{ scale:05, y: -10 }}
                        onClick={() => setSelectedMovie(movie)}
                        className="min-w-[200px] cursor-pointer first:ml-1 last:mr-1 p-2"
                    >
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 mb-3 border border-white/10 shadow-lg relative">
                            {/* POSTER IMAGE */}
                            {movie.posterUrl ? (
                                <img src={movie.posterUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="p-2 text-xs text-center flex h-full items-center text-gray-500">{movie.primaryTitle}</div>
                            )}

                            {/* MATCH % BADGE */}
                            {movie.score && movie.score > 0 && (
                                <div className="absolute top-2 right-2 shadow-lg">
                                    <div className={`
                                        px-2 py-1 rounded text-[10px] font-black tracking-tighter text-white backdrop-blur-md border border-white/20
                                        ${movie.score > 0.85 ? 'bg-purple-600/90 shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 
                                        movie.score > 0.70 ? 'bg-green-600/90 shadow-[0_0_10px_rgba(22,163,74,0.5)]' : 
                                        'bg-gray-600/90'}
                                    `}>
                                        {Math.round(movie.score * 100)}%
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-sm text-gray-300 font-bold line-clamp-2 px-1 leading-tight text-center">
                            {movie.primaryTitle}
                        </div>
                    </motion.div>
                ))}
            </div>

            <button 
                onClick={() => scroll(mainScrollRef, 'right')}
                className="absolute right-0 top-[43%] -translate-y-1/2 z-30 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-ekko-highlight hover:scale-110 -mr-6"
            >
                <ChevronRight size={32} />
            </button>
        </div>
      </div>

      {/* ROW 2: GENRE EXPLORER */}
      <div className="px-12 relative z-20"> 
        <div className="mb-4">
            <GenreBar 
                selectedGenre={activeGenre} 
                onSelect={(g) => setActiveGenre(g)} 
            />
        </div>

        <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-md pl-1">
            Best {activeGenre} for You
        </h2>
            
        <div className="relative group">
            <button 
                onClick={() => scroll(genreScrollRef, 'left')}
                className="absolute left-0 top-[43%] -translate-y-1/2 z-30 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-ekko-highlight hover:scale-110 -ml-6"
            >
                <ChevronLeft size={32} />
            </button>

            <div 
                ref={genreScrollRef}
                className="flex gap-2 overflow-x-auto py-4 pb-4 scroll-smooth"
            >
                {genreFeed.length > 0 ? genreFeed.map((movie) => (
                    <motion.div 
                        key={`genre-${movie.tconst}`}
                        whileHover={{ scale:05, y: -10 }}
                        onClick={() => setSelectedMovie(movie)}
                        className="min-w-[200px] cursor-pointer first:ml-1 last:mr-1 p-2"
                    >
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 mb-3 border border-white/10 shadow-lg relative group">
                            
                            {/* POSTER */}
                            {movie.posterUrl ? (
                                <img src={movie.posterUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="p-2 text-xs text-center flex h-full items-center text-gray-500">{movie.primaryTitle}</div>
                            )}

                            {/*  MATCH BADGE*/}
                            {movie.score && movie.score > 0 && (
                                <div className="absolute top-2 right-2 shadow-lg">
                                    <div className={`
                                        px-2 py-1 rounded text-[10px] font-black tracking-tighter text-white backdrop-blur-md border border-white/20
                                        ${movie.score > 0.85 ? 'bg-purple-600/90 shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 
                                          movie.score > 0.70 ? 'bg-green-600/90 shadow-[0_0_10px_rgba(22,163,74,0.5)]' : 
                                          'bg-gray-600/90'}
                                    `}>
                                        {Math.round(movie.score * 100)}%
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-sm text-gray-300 font-bold line-clamp-2 px-1 leading-tight text-center">
                            {movie.primaryTitle}
                        </div>
                    </motion.div>
                )) : (
                    <div className="h-40 flex items-center justify-center w-full text-gray-500">
                        Searching database for {activeGenre}...
                    </div>
                )}
            </div>

            <button 
                onClick={() => scroll(genreScrollRef, 'right')}
                className="absolute right-0 top-[43%] -translate-y-1/2 z-30 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-ekko-highlight hover:scale-110 -mr-6"
            >
                <ChevronRight size={32} />
            </button>
        </div>
      </div>
      <div className="h-10" />
      
      {/* EXPLORATION */}
      <ExplorationRows 
          onSelectMovie={handleSearchSelect} 
          refreshTrigger={refreshTrigger} 
      />
      <div className="h-20" />

      {/* THE MOVIE MODAL */}
      {selectedMovie && (
        <MovieModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)} 
            onRateSuccess={() => refreshAll(true)}
            onSwitchMovie={(newMovie) => setSelectedMovie(newMovie)} 
            onPersonClick={(name) => setSelectedPerson(name)}
            isGuest={isGuest}
        />
      )}

      {/* AI MODAL */}
      {showAISearch && (
          <AISearchModal 
              onClose={() => setShowAISearch(false)}
              onSelectMovie={handleSearchSelect}
          />
      )}

      {/* WATCHLIST DRAWER */}
      <AnimatePresence>
        {showWatchlist && user && (
            <WatchlistDrawer 
                user={user} 
                onClose={() => setShowWatchlist(false)} 
                onSelectMovie={handleSearchSelect} 
            />
        )}
      </AnimatePresence>
      
      {/* PROFILE DRAWER */}
      <AnimatePresence>
        {showProfile && user && (
            <UserProfile 
                user={user} 
                onClose={() => setShowProfile(false)} 
                onLogout={logout}
                onSelectMovie={handleSearchSelect} 
            />
        )}
      </AnimatePresence>

      {/* PERSON MODAL */}
      <AnimatePresence>
            {selectedPerson && (
                <PersonModal 
                    name={selectedPerson} 
                    onClose={() => setSelectedPerson(null)}
                    onSelectMovie={(movie) => {
                        setSelectedPerson(null);
                        setTimeout(() => setSelectedMovie(movie), 100);
                    }}
                />
            )}
      </AnimatePresence>
    </div>
  );
}