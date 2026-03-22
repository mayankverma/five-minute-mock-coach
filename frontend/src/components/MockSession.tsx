import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../lib/api';
import './mock-session.css';

type SessionState = 'idle' | 'connecting' | 'active' | 'ended';

interface MockSessionProps {
  onEnd?: (transcript: string) => void;
}

export function MockSession({ onEnd }: MockSessionProps) {
  const [state, setState] = useState<SessionState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => { stopTimer(); wsRef.current?.close(); }, [stopTimer]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const start = async () => {
    setError(null);
    setState('connecting');
    try {
      const { data } = await api.get('/api/voice/signed-url');
      const ws = new WebSocket(data.signed_url);
      wsRef.current = ws;

      ws.onopen = () => {
        setState('active');
        startTimer();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcript' && msg.text) {
            setTranscript(prev => prev + (prev ? '\n' : '') + `${msg.role === 'agent' ? 'Interviewer' : 'You'}: ${msg.text}`);
          }
        } catch {
          // Binary audio data — ignore
        }
      };

      ws.onclose = () => {
        stopTimer();
        if (state !== 'ended') setState('ended');
      };

      ws.onerror = () => {
        setError('Connection lost. Please try again.');
        stopTimer();
        setState('idle');
      };
    } catch {
      setError('Failed to start voice session. Check your connection.');
      setState('idle');
    }
  };

  const end = () => {
    wsRef.current?.close();
    stopTimer();
    setState('ended');
    if (onEnd && transcript) onEnd(transcript);
  };

  return (
    <div className="mock-session">
      {error && <div className="mock-error">{error}</div>}

      {state === 'idle' && (
        <div className="mock-start">
          <div className="mock-start-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h3>Ready to start your mock interview?</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            You'll speak with an AI interviewer using your microphone.
          </p>
          <button className="mock-btn mock-btn-primary" onClick={start}>
            Start Voice Interview
          </button>
        </div>
      )}

      {state === 'connecting' && (
        <div className="mock-start">
          <div className="mock-pulse" />
          <p>Connecting to interviewer...</p>
        </div>
      )}

      {state === 'active' && (
        <div className="mock-active">
          <div className="mock-timer">{formatTime(elapsed)}</div>
          <div className="mock-mic-ring">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <p className="mock-listening">Interview in progress</p>
          {transcript && (
            <div className="mock-live-transcript">
              {transcript.split('\n').slice(-3).map((line, i) => (
                <p key={i} className={line.startsWith('Interviewer') ? 'mock-t-agent' : 'mock-t-user'}>{line}</p>
              ))}
            </div>
          )}
          <button className="mock-btn mock-btn-danger" onClick={end}>
            End Interview
          </button>
        </div>
      )}

      {state === 'ended' && (
        <div className="mock-ended">
          <h3>Interview Complete</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            Duration: {formatTime(elapsed)}
          </p>
          {transcript ? (
            <div className="mock-transcript">
              <h4>Transcript</h4>
              <div className="mock-transcript-body">
                {transcript.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('Interviewer') ? 'mock-t-agent' : 'mock-t-user'}>{line}</p>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No transcript captured.</p>
          )}
          <button className="mock-btn mock-btn-primary" onClick={() => { setState('idle'); setElapsed(0); setTranscript(''); }}>
            Start New Interview
          </button>
        </div>
      )}
    </div>
  );
}
