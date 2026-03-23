import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
  sendMessage: (text: string) => Promise<void>;
  resetChat: (opening?: ChatMessage[]) => void;
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

export function useStoryChat(openingMessages: ChatMessage[] = []): UseStoryChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(openingMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [storyExtract, setStoryExtract] = useState<StoryExtract | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // Build conversation history for the API (all messages including the new one)
    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

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
        body: JSON.stringify({ messages: apiMessages }),
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
  }, [messages]);

  const resetChat = useCallback((opening: ChatMessage[] = []) => {
    abortRef.current?.abort();
    setMessages(opening);
    setStoryExtract(null);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, storyExtract, sendMessage, resetChat };
}
