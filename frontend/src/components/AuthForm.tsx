"use client";

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';

// Define the Prop Type
interface AuthFormProps {
  initialMode?: 'login' | 'signup';
}

// Accept the Prop (default to 'login' if not provided)
export default function AuthForm({ initialMode = 'login' }: AuthFormProps) {
  
  // Initialize state based on the prop
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const { login, signup } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 1. Basic Client-Side Validation
    if (!email.includes('@')) {
        setError("Please enter a valid email address.");
        return;
    }
    if (!isLogin && password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
    }
    
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (err: any) {
      // Error Handling
      console.error("Auth Error:", err);

      if (err.response) {
          const status = err.response.status;
          
          if (status === 422) {
              setError("Invalid email format. Please use 'user@example.com'.");
          } else if (status === 400) {
              setError(isLogin ? "Incorrect email or password." : "Email already registered.");
          } else {
              setError("Server unavailable. Please try again.");
          }
      } else {
          setError("Connection failed. Is the backend running?");
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md p-8 rounded-2xl bg-ekko-card border border-white/10 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          {isLogin ? 'Welcome Back' : 'Join Ekko'}
        </h2>
        <p className="text-ekko-muted mt-2 text-sm">
          {isLogin ? 'Enter the portal.' : 'Start your journey.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ekko-muted mb-1 ml-1">EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-ekko-text focus:outline-none focus:border-ekko-highlight transition-colors"
            placeholder="neo@matrix.com"
            required
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-ekko-muted mb-1 ml-1">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-ekko-text focus:outline-none focus:border-ekko-highlight transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        <AnimatePresence>
            {!isLogin && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                >
                    <div className="pt-0">
                        <label className="block text-xs font-medium text-ekko-muted mb-1 ml-1">CONFIRM PASSWORD</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-ekko-text focus:outline-none focus:border-ekko-highlight transition-colors"
                            placeholder="••••••••"
                            required={!isLogin}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          className="w-full bg-ekko-highlight hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLogin ? 'Enter System' : 'Initialize Account'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => {
              setIsLogin(!isLogin);
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              setError('');
          }}
          className="text-sm text-ekko-muted hover:text-white transition-colors underline decoration-dotted"
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Login"}
        </button>
      </div>
    </motion.div>
  );
}