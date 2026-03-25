import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

export interface ChatMessage {
  role: 'coach' | 'user';
  text: string;
}

async function getToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch { /* fall through */ }
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      if (parsed?.access_token) return parsed.access_token;
    } catch { /* skip */ }
  }
  return null;
}

export function useResumeChat(resumeId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  // On mount: check for active session to resume
  useEffect(() => {
    if (!resumeId || initializedRef.current) return;
    initializedRef.current = true;

    async function initSession() {
      try {
        const { data } = await api.get('/api/resume/chat/session', {
          params: { resume_id: resumeId },
        });
        if (data?.session && data.messages?.length > 0) {
          setSessionId(data.session.id);
          setMessages(data.messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'coach' : m.role,
            text: m.content,
          })));
        }
      } catch {
        // No active session — that's fine
      }
    }

    initSession();
  }, [resumeId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!resumeId) return;

    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'coach', text: '' }]);

    try {
      const token = await getToken();
      abortRef.current = new AbortController();

      const response = await fetch('/api/resume/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resume_id: resumeId,
          messages: apiMessages,
          session_id: sessionId,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (eventType === 'token' && parsed.text) {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'coach') {
                    updated[updated.length - 1] = { ...last, text: last.text + parsed.text };
                  }
                  return updated;
                });
              } else if (eventType === 'session') {
                setSessionId(parsed.session_id);
              }
            } catch { /* skip */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'coach' && last.text === '') {
            updated[updated.length - 1] = {
              ...last,
              text: 'Sorry, I had trouble connecting. Please try again.',
            };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
    }
  }, [resumeId, messages, sessionId]);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setIsStreaming(false);
    initializedRef.current = false;
  }, []);

  return { messages, isStreaming, sessionId, sendMessage, resetChat };
}
