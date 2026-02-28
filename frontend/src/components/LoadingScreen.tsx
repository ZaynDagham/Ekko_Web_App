"use client";

import { motion } from 'framer-motion';
import { BrainCircuit, Sparkles, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LoadingScreen() {
  const [text, setText] = useState("Initializing...");

  useEffect(() => {
    const messages = [
      "Initializing...",
      "Syncing User Vibe...",
      "Fetching Data...",
      "Calibrating Recommendation Engine...",
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setText(messages[i]);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl">
      
      {/* THE BRAIN ANIMATION */}
      <div className="relative mb-8">
        {/* Outer Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-24 h-24 rounded-full border-t-2 border-r-2 border-ekko-highlight/50"
        />
        
        {/* Inner Ring (Reverse) */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 rounded-full border-b-2 border-l-2 border-purple-500/50"
        />

        {/* Glowing Brain Center */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="relative">
             <div className="absolute inset-0 bg-ekko-highlight blur-xl opacity-40 animate-pulse" />
             <BrainCircuit size={40} className="text-white relative z-10" />
          </div>
        </motion.div>
      </div>

      {/* THE TEXT */}
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        className="flex items-center gap-2"
      >
        <Sparkles size={16} className="text-ekko-highlight animate-spin" />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 font-mono text-sm tracking-widest uppercase font-bold">
            {text}
        </span>
      </motion.div>

      {/* PROGRESS BAR */}
      <div className="w-64 h-1 bg-gray-800 rounded-full mt-6 overflow-hidden">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-ekko-highlight to-transparent"
          />
      </div>
    </div>
  );
}