import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

interface ChatMessage {
  role: 'coach' | 'user';
  text: string;
}

interface StoryExtract {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  primarySkill: string;
  secondarySkill: string;
  earnedSecret: string;
  strength: number;
  domain: string;
  deployFor: string;
}

interface UseStoryChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  storyExtract: StoryExtract | null;
  sessionId: string | null;
  isResuming: boolean;
  sendMessage: (text: string) => Promise<void>;
  resetChat: (opening?: ChatMessage[]) => void;
  abandonSession: () => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  // Fallback to localStorage
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      if (parsed?.access_token) return parsed.access_token;
    } catch { /* skip */ }
  }
  return null;
}

export function useStoryChat(
  openingMessages: ChatMessage[] = [],
  storyContext?: string,
  storyId?: string,
): UseStoryChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(openingMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [storyExtract, setStoryExtract] = useState<StoryExtract | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  // On mount: check for active session to resume
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function initSession() {
      if (!storyId) {
        // New story — no session needed until the story is created
        return;
      }

      // Existing story — check for active session
      try {
        const { data } = await api.get(`/api/stories/${storyId}/conversations/active`);
        if (data && data.messages && data.messages.length > 0) {
          // Resume: load existing messages
          setMessages(data.messages as ChatMessage[]);
          setSessionId(data.id);
          setIsResuming(true);
          return;
        }
      } catch {
        // 404 = no active session, create a new one
      }

      // No active session — create one
      try {
        const { data } = await api.post(`/api/stories/${storyId}/conversations`);
        setSessionId(data.id);
      } catch {
        // Ignore — will work without session persistence
      }
    }

    initSession();
  }, [storyId]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // Build conversation history for the API (all messages including the new one)
    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

    // If we have story context, prepend it so the coach can see the full story
    if (storyContext) {
      apiMessages.unshift({ role: 'user', content: storyContext });
    }

    setIsStreaming(true);

    // Add empty coach message that we'll stream into
    setMessages(prev => [...prev, { role: 'coach', text: '' }]);

    try {
      const token = await getToken();
      abortRef.current = new AbortController();

      const response = await fetch(`${API_URL}/api/stories/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
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

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (eventType === 'token' && parsed.text) {
                // Append token to the last coach message
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'coach') {
                    updated[updated.length - 1] = { ...last, text: last.text + parsed.text };
                  }
                  return updated;
                });
              } else if (eventType === 'story_complete') {
                setStoryExtract(parsed as StoryExtract);
              } else if (eventType === 'version_created') {
                // Session was completed by the backend — clear sessionId
                setSessionId(null);
              }
              // 'done' event — no action needed
            } catch { /* skip unparseable */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Add error message to chat
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
  }, [messages, storyContext, sessionId]);

  const resetChat = useCallback((opening: ChatMessage[] = []) => {
    abortRef.current?.abort();
    setMessages(opening);
    setStoryExtract(null);
    setIsStreaming(false);
  }, []);

  const abandonSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await api.put(`/api/stories/conversations/${sessionId}/abandon`);
      setSessionId(null);
      setIsResuming(false);
    } catch {
      // Ignore
    }
  }, [sessionId]);

  return { messages, isStreaming, storyExtract, sessionId, isResuming, sendMessage, resetChat, abandonSession };
}
