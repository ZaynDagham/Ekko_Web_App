"use client";

import { motion } from 'framer-motion';

const GENRES = [
  "All", "Action", "Sci-Fi", "Drama", "Horror", 
  "Comedy", "Thriller", "Romance", "Mystery", "Crime", "Fantasy"
];

interface GenreBarProps {
  selectedGenre: string;
  onSelect: (genre: string) => void;
}

export default function GenreBar({ selectedGenre, onSelect }: GenreBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar px-12 mb-4">
      {GENRES.map((genre) => {
        const isActive = selectedGenre === genre;
        return (
          <button
            key={genre}
            onClick={() => onSelect(genre)}
            className={`
              relative px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300
              ${isActive 
                ? "bg-white text-black scale-105 shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
              }
            `}
          >
            {genre}
            {isActive && (
                <motion.div 
                    layoutId="active-pill"
                    className="absolute inset-0 border-2 border-ekko-highlight rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
            )}
          </button>
        );
      })}
    </div>
  );
}