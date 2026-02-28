import { create } from 'zustand';
import { api } from '@/lib/api'; 

interface User {
  id: number;
  email: string;
  ratings_count: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('ekko_token') : null,
  isAuthenticated: typeof window !== 'undefined' && !!localStorage.getItem('ekko_token'),

  login: async (email, password) => {
    try {
      const response = await api.post('/login', { email, password });
      const token = response.data.access_token;
      
      // Save to Storage
      localStorage.setItem('ekko_token', token);
      
      // CRITICAL FIX: Force Axios to use token immediately
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update State
      set({ token, isAuthenticated: true });
      
      // Fetch User immediately
      await get().fetchUser();
      
    } catch (error) {
      throw error;
    }
  },

  signup: async (email, password) => {
    try {
      const response = await api.post('/signup', { email, password });
      const token = response.data.access_token;
      
      localStorage.setItem('ekko_token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      set({ token, isAuthenticated: true });
      await get().fetchUser();
      
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('ekko_token');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      const token = localStorage.getItem('ekko_token');
      if (!token) return;

      // Ensure the header is set before request
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const response = await api.get('/users/me');
      set({ user: response.data });
      
    } catch (error: any) { 
      console.error("Failed to fetch user:", error);
      
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          get().logout(); 
      }
    }
  }
}));