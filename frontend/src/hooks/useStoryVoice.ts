import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || '';
const SUPABASE_STORAGE_KEY = `sb-egmforwmfydhtbgzsvdd-auth-token`;

interface TranscriptEntry {
  role: 'user' | 'coach';
  text: string;
}

export interface UseStoryVoiceReturn {
  isConnected: boolean;
  isListening: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) return parsed.access_token;
    }
  } catch { /* ignore */ }

  return null;
}

async function getStorySignedUrl(): Promise<string> {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}/api/voice/story-signed-url`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to get voice URL');
  const data = await res.json();
  return data.signed_url;
}

export function useStoryVoice(
  onTranscript: (text: string, role: 'user' | 'coach') => void,
  onSessionEnd?: (transcript: TranscriptEntry[]) => void,
): UseStoryVoiceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const connect = useCallback(async () => {
    try {
      transcriptRef.current = [];
      const url = await getStorySignedUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcript' && msg.text) {
            const role: 'user' | 'coach' = msg.role === 'agent' ? 'coach' : 'user';
            transcriptRef.current.push({ role, text: msg.text });
            onTranscript(msg.text, role);
          }
        } catch { /* skip non-JSON frames */ }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        if (transcriptRef.current.length > 0) {
          onSessionEnd?.(transcriptRef.current);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsListening(false);
      };
    } catch {
      setIsConnected(false);
    }
  }, [onTranscript, onSessionEnd]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { isConnected, isListening, connect, disconnect };
}
