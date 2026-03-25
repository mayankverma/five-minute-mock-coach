import axios from 'axios';
import { supabase } from './supabase';

const SUPABASE_STORAGE_KEY = `sb-egmforwmfydhtbgzsvdd-auth-token`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  // Try getSession first (preferred)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      return config;
    }
  } catch {
    // getSession failed — fall through to localStorage
  }

  // Fallback: read directly from localStorage (handles race conditions)
  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) {
        config.headers.Authorization = `Bearer ${parsed.access_token}`;
      }
    }
  } catch {
    // ignore parse errors
  }

  return config;
});

export default api;
