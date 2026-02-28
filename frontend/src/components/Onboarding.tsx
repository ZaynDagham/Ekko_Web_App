"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { getPoster } from '@/lib/tmdb';
import { useAuthStore } from '@/store/authStore';
import { UploadCloud } from 'lucide-react';
import Importer from './Importer';
import { LogOut } from 'lucide-react';

interface Movie {
  tconst: string;
  primaryTitle: string;
  posterUrl?: string | null;
}

export default function Onboarding() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  
  // Gets the function to refresh user state (switching to Dashboard)
  const { fetchUser, logout } = useAuthStore();

  // Load the "Starter Pack" Movies
  useEffect(() => {
    async function loadMovies() {
      try {
        const res = await api.get('/onboarding/movies');
        const rawMovies = res.data;

        // Fetch posters in parallel
        const moviesWithPosters = await Promise.all(
          rawMovies.map(async (m: any) => ({
            ...m,
            posterUrl: await getPoster(m.tconst)
          }))
        );

        setMovies(moviesWithPosters);
      } catch (err) {
        console.error("Failed to load onboarding:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMovies();
  }, []);

  // Handle Selection (Limit to 3)
  const toggleMovie = (tconst: string) => {
    if (selected.includes(tconst)) {
      setSelected(selected.filter(id => id !== tconst));
    } else {
      if (selected.length < 3) {
        setSelected([...selected, tconst]);
      }
    }
  };

  // Submit the Vibe
  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    try {
      await api.post('/onboarding/submit', selected);
      await fetchUser(); // App switches to Dashboard
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitting(false);
    }
  };

  // 4. Handle Import Completion
  const handleImportComplete = async () => {
      // Small delay to let the user see "Complete" message
      setTimeout(async () => {
          await fetchUser(); // App switches to Dashboard
      }, 500);
  };

  if (loading) return <div className="text-center text-gray-500 mt-20">Calibrating Scanner...</div>;

  return (
    <div className="w-full max-w-6xl mx-auto p-6 relative">
      
      {/* IMPORT */}
      <div className="max-w-2xl mx-auto mb-12 text-center">
        <h2 className="text-xl font-bold text-white mb-4">ALREADY HAVE DATA?</h2>
        <button 
            onClick={() => setShowImporter(true)}
            className="w-full py-6 border-2 border-dashed border-white/20 hover:border-ekko-highlight hover:bg-white/5 rounded-xl flex flex-col items-center justify-center gap-3 transition-all group"
        >
            <div className="bg-ekko-highlight/20 p-3 rounded-full text-ekko-highlight group-hover:scale-110 transition-transform">
                <UploadCloud size={32} />
            </div>
            <div>
                <span className="text-white font-bold text-lg block">Import IMDb History</span>
                <span className="text-gray-500 text-sm">Upload your .csv file to skip calibration</span>
            </div>
        </button>
      </div>

      {/* DIVIDER */}
      <div className="relative flex items-center justify-center mb-16">
        <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative bg-[#0a0a0a] px-4 text-gray-500 font-bold text-sm tracking-widest">
            OR
        </div>
      </div>

      {/* SECTION 2: QUIZ */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
          Let's Calibrate Your Vibe
        </h1>
        <p className="text-gray-400">
          Select 3 Movies/TV-Shows you love. We'll build your AI profile from there.
        </p>
        <div className="mt-4 text-sm font-mono text-ekko-highlight tracking-widest">
          SELECTED: {selected.length} / 3
        </div>
      </div>

      {/* Movie Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-20">
        {movies.map((movie) => (
          <motion.div
            key={movie.tconst}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleMovie(movie.tconst)}
            className={`
              relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all
              ${selected.includes(movie.tconst) 
                ? 'border-ekko-highlight ring-4 ring-blue-500/20 grayscale-0' 
                : 'border-transparent grayscale hover:grayscale-0'}
            `}
          >
            {movie.posterUrl ? (
              <img 
                src={movie.posterUrl} 
                alt={movie.primaryTitle} 
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4 text-center text-xs text-gray-400">
                {movie.primaryTitle}
              </div>
            )}
            
            {/* Selection Checkmark */}
            {selected.includes(movie.tconst) && (
              <div className="absolute inset-0 bg-blue-600/40 flex items-center justify-center">
                <div className="bg-white text-blue-600 rounded-full p-2 shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Floating Submit Button */}
      {selected.length === 3 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-10 left-0 right-0 flex justify-center z-50"
        >
          <button
            onClick={handleSubmitQuiz}
            disabled={submitting}
            className="bg-ekko-highlight hover:bg-blue-600 text-white font-bold py-4 px-12 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.6)] text-lg tracking-wider border border-white/20 backdrop-blur-md transition-all"
          >
            {submitting ? 'PROCESSING...' : 'INITIALIZE SYSTEM'}
          </button>
        </motion.div>
      )}

      {/* Importer Modal */}
      <AnimatePresence>
        {showImporter && (
            <Importer 
                onClose={() => setShowImporter(false)} 
                onComplete={handleImportComplete} 
            />
        )}
      </AnimatePresence>

      {/* SIGN OUT BUTTON (New) */}
      <div className="absolute top-0 right-0 p-4">
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest border border-transparent hover:border-red-500/20 px-3 py-1.5 rounded-full"
          >
            <LogOut size={14} />
            Sign Out
          </button>
      </div>
    </div>
  );
}