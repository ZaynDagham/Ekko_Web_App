"use client";

import { useEffect, useState } from 'react';
import AuthForm from '@/components/AuthForm';
import { useAuthStore } from '@/store/authStore';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';
import GuestDashboard from '@/components/GuestDashboard';

export default function Home() {
  const { isAuthenticated, logout } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [view, setView] = useState<'landing' | 'login' | 'signup' | 'guest'>('landing');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  // AUTHENTICATED USER FLOW
  if (isAuthenticated) {
    // Wait for user data
    if (!useAuthStore.getState().user) {
        useAuthStore.getState().fetchUser();
        return null; 
    }

    // New User -> Onboarding
    if (useAuthStore.getState().user?.ratings_count === 0) {
      return (
        <main className="min-h-screen bg-ekko-dark text-white">
          <Onboarding />
        </main>
      );
    }

    // Veteran User -> Dashboard
    return (
      <main className="min-h-screen bg-ekko-dark">
        <Dashboard />
      </main>
    );
  }

  // UN-AUTHENTICATED TRAFFIC CONTROL

  // GUEST DASHBOARD
  if (view === 'guest') {
    return (
      <GuestDashboard 
         onRequestSignup={() => setView('landing')}
         onExit={() => setView('landing')}     
      />
    );
  }

  // LOGIN / SIGNUP SCREEN
  if (view === 'login' || view === 'signup') {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden bg-ekko-dark">
            {/* Background Gradient Blob */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]" />

            {/* BACK BUTTON */}
            <button 
                onClick={() => setView('landing')} 
                className="absolute top-8 left-8 text-gray-400 hover:text-white flex gap-2 items-center z-50 transition-colors"
            >
                ← Back
            </button>

            <div className="z-10 w-full max-w-md">
                <div className="mb-10 text-center">
                    <h1 className="text-6xl font-black tracking-tighter text-white mb-2">
                        EKKO.
                    </h1>
                    <p className="text-lg text-ekko-muted">
                        {view === 'login' ? ' ' : 'Initialize your profile.'}
                    </p>
                </div>
                
                <AuthForm initialMode={view === 'signup' ? 'signup' : 'login'} />
            </div>
        </main>
    );
  }

  // LANDING PAGE
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-black text-white relative overflow-hidden">
        {/* Background Image/Video Placeholder */}
        <div className="absolute inset-0 bg-[url('https://wallpaperaccess.com/full/8213677.gif')] bg-cover opacity-20 pointer-events-none" />
        
        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black pointer-events-none" />
        
        <div className="z-10 text-center max-w-2xl animate-in fade-in zoom-in duration-700">
            <h1 className="text-8xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-600 drop-shadow-2xl">
                EKKO
            </h1>
            <p className="text-xl text-gray-400 mb-12 font-light tracking-[0.2em]">
                THE AI ARCHITECT FOR YOUR ENTERTAINMENT
            </p>

            <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
                <button 
                    onClick={() => setView('login')}
                    className="w-full py-4 bg-white text-black font-bold text-lg rounded hover:bg-gray-200 transition-transform hover:scale-105"
                >
                    LOGIN
                </button>
                <button 
                    onClick={() => setView('signup')}
                    className="w-full py-4 bg-transparent border border-white text-white font-bold text-lg rounded hover:bg-white/10 transition-transform hover:scale-105"
                >
                    CREATE ACCOUNT
                </button>
                <div className="h-px bg-gray-800 my-2" />
                <button 
                    onClick={() => setView('guest')}
                    className="w-full py-4 bg-transparent border-2 border-gray-500 text-gray-300 font-bold text-lg rounded hover:border-white hover:text-white transition-colors"
                >
                    ENTER AS GUEST
                </button>
            </div>
        </div>
    </main>
  );
}