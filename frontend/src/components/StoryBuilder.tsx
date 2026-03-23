import { useState, useRef, useEffect, useCallback } from 'react';
import { useStoryChat } from '../hooks/useStoryChat';
import { useStoryVoice } from '../hooks/useStoryVoice';
import './story-builder.css';

/* ── Types ── */

interface StoryDraft {
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

interface ChatMessage {
  role: 'coach' | 'user';
  text: string;
}

interface StoryBuilderProps {
  /** Pre-fill for existing stories; omit for new */
  initial?: Partial<StoryDraft>;
  onSave: (draft: StoryDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const EMPTY: StoryDraft = {
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  primarySkill: '',
  secondarySkill: '',
  earnedSecret: '',
  strength: 0,
  domain: '',
  deployFor: '',
};

/* ── Opening messages ── */

const OPENING: ChatMessage[] = [
  {
    role: 'coach',
    text: "Let's surface a great interview story. Don't worry about structure yet — I'll help shape it.\n\nThink about a moment at work where you were at your best. What comes to mind?",
  },
];

const existingOpening = (title: string): ChatMessage[] => [
  {
    role: 'coach',
    text: `I've loaded your story "${title}". I can see the details on the right.\n\nWould you like to strengthen a specific section, extract a deeper earned secret, or practice telling this story in 90 seconds?`,
  },
];

/* ── Inline SVG icons ── */

function ChatIcon() {
  return (
    <svg viewBox="0 0 18 18" width="14" height="14">
      <path d="M3 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3 3V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 18 18">
      <line x1="3" y1="9" x2="15" y2="9" />
      <polyline points="10 4 15 9 10 14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 18 18">
      <polyline points="11 5 7 9 11 13" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 18 18" width="13" height="13" stroke="currentColor" strokeWidth="1.5" fill="none">
      <rect x="3" y="3" width="12" height="12" rx="2" />
      <line x1="6" y1="7" x2="12" y2="7" />
      <line x1="6" y1="10" x2="10" y2="10" />
    </svg>
  );
}

/* ── Component ── */

export function StoryBuilder({ initial, onSave, onCancel, onDelete }: StoryBuilderProps) {
  const isExisting = !!(initial && initial.title);
  const { messages, isStreaming, storyExtract, sendMessage } = useStoryChat(
    isExisting ? existingOpening(initial!.title!) : OPENING,
  );

  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [inputText, setInputText] = useState('');
  const [cardExpanded, setCardExpanded] = useState(isExisting);
  const [draft, setDraft] = useState<StoryDraft>({ ...EMPTY, ...initial });
  const [justExtracted, setJustExtracted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice mode hook
  const handleVoiceTranscript = useCallback((_text: string, _role: 'user' | 'coach') => {
    // Voice transcripts are handled by ElevenLabs agent in real-time;
    // no need to push into chat messages during the voice session.
  }, []);

  const handleVoiceSessionEnd = useCallback((transcript: { role: 'user' | 'coach'; text: string }[]) => {
    const formatted = transcript.map(t => `${t.role === 'coach' ? 'Coach' : 'User'}: ${t.text}`).join('\n');
    const extractionPrompt = `Please extract a STAR story from this voice conversation transcript:\n\n${formatted}`;
    sendMessage(extractionPrompt);
  }, [sendMessage]);

  const { isConnected, isListening, connect, disconnect } = useStoryVoice(
    handleVoiceTranscript,
    handleVoiceSessionEnd,
  );

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Populate draft when story extraction arrives
  useEffect(() => {
    if (storyExtract) {
      setDraft(prev => ({ ...prev, ...storyExtract }));
      setCardExpanded(true);
      setJustExtracted(true);
      setTimeout(() => setJustExtracted(false), 2500);
    }
  }, [storyExtract]);

  const updateDraft = (field: keyof StoryDraft, value: string | number) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  // Count filled fields for progress
  const fieldKeys: (keyof StoryDraft)[] = [
    'title', 'situation', 'task', 'action', 'result',
    'primarySkill', 'earnedSecret',
  ];
  const filledCount = fieldKeys.filter((k) => {
    const v = draft[k];
    return typeof v === 'string' ? v.trim().length > 0 : v > 0;
  }).length;
  const progressPct = Math.round((filledCount / fieldKeys.length) * 100);

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Top bar — mode toggle + close */}
      <div className="sb-topbar" style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
        <div className="sb-topbar-title">
          <CardIcon />
          {isExisting ? `Editing: ${draft.title}` : 'New Story'}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="sb-mode-toggle">
            <button
              className={`sb-mode-btn ${mode === 'chat' ? 'active' : ''}`}
              onClick={() => setMode('chat')}
            >
              <ChatIcon /> Chat
            </button>
            <button
              className={`sb-mode-btn ${mode === 'voice' ? 'active' : ''}`}
              onClick={() => setMode('voice')}
            >
              <MicIcon /> Voice
            </button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div className="story-builder">
        {/* ── Left: Chat panel ── */}
        <div className="sb-chat-panel">
          <div className="sb-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`sb-msg ${msg.role}`}>
                {msg.role === 'coach' && <div className="sb-msg-label">Coach</div>}
                {msg.text.split('\n').map((line, j) => (
                  <span key={j}>
                    {line.split(/(\*\*[^*]+\*\*)/).map((seg, k) =>
                      seg.startsWith('**') && seg.endsWith('**') ? (
                        <strong key={k}>{seg.slice(2, -2)}</strong>
                      ) : (
                        <span key={k}>{seg}</span>
                      ),
                    )}
                    {j < msg.text.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.text === '' && (
              <div className="sb-typing">
                <div className="sb-typing-dot" />
                <div className="sb-typing-dot" />
                <div className="sb-typing-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area — chat or voice */}
          {mode === 'chat' ? (
            <div className="sb-chat-input">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your experience..."
                rows={1}
              />
              <button className="sb-send-btn" onClick={handleSend} disabled={isStreaming}>
                <SendIcon />
              </button>
            </div>
          ) : (
            <div className="sb-voice-area">
              <div className="sb-voice-hint">
                {!isConnected
                  ? 'Click to start voice conversation'
                  : isListening
                    ? 'Listening...'
                    : 'Speaking...'}
              </div>
              <button
                className={`sb-mic-btn ${isListening ? 'recording' : ''}`}
                onClick={() => (isConnected ? disconnect() : connect())}
              >
                <svg viewBox="0 0 24 24">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              </button>
              {isListening && (
                <div className="voice-bars">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <div key={n} className="voice-bar" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="sb-divider" />

        {/* ── Right: Story Card (collapsible) ── */}
        <div className={`sb-card-panel ${cardExpanded ? '' : 'collapsed'}`}>
          <div className="sb-card-header">
            <div className="sb-card-header-title">
              <CardIcon />
              <span>Story Card</span>
            </div>
            <button
              className="sb-expand-btn"
              onClick={() => setCardExpanded((v) => !v)}
              title={cardExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronIcon />
            </button>
          </div>

          {/* Progress bar */}
          <div className="sb-progress">
            <div className="sb-progress-bar">
              <div className="sb-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="sb-progress-text">{filledCount}/{fieldKeys.length} fields</span>
          </div>

          {/* Scrollable form */}
          <div className="sb-card-body">
            <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
              <label>Title</label>
              <input
                value={draft.title}
                onChange={(e) => updateDraft('title', e.target.value)}
                placeholder="Generated from conversation..."
              />
            </div>

            <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
              <label>Situation</label>
              <textarea
                value={draft.situation}
                onChange={(e) => updateDraft('situation', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={3}
              />
            </div>

            <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
              <label>Task</label>
              <textarea
                value={draft.task}
                onChange={(e) => updateDraft('task', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={2}
              />
            </div>

            <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
              <label>Action</label>
              <textarea
                value={draft.action}
                onChange={(e) => updateDraft('action', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={3}
              />
            </div>

            <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
              <label>Result</label>
              <textarea
                value={draft.result}
                onChange={(e) => updateDraft('result', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={2}
              />
            </div>

            <div className="sb-field-row">
              <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
                <label>Primary Skill</label>
                <input
                  value={draft.primarySkill}
                  onChange={(e) => updateDraft('primarySkill', e.target.value)}
                  placeholder="Auto-tagged..."
                />
              </div>
              <div className="sb-field">
                <label>Secondary Skill</label>
                <input
                  value={draft.secondarySkill}
                  onChange={(e) => updateDraft('secondarySkill', e.target.value)}
                  placeholder="Auto-tagged..."
                />
              </div>
            </div>

            <div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
              <label>Earned Secret</label>
              <textarea
                value={draft.earnedSecret}
                onChange={(e) => updateDraft('earnedSecret', e.target.value)}
                placeholder="The unique insight only you learned..."
                rows={2}
              />
            </div>

            <div className="sb-field-row">
              <div className="sb-field">
                <label>Strength</label>
                <div className="sb-strength">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`sb-strength-dot ${n <= draft.strength ? 'filled' : ''}`}
                      onClick={() => updateDraft('strength', n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sb-field">
                <label>Domain</label>
                <input
                  value={draft.domain}
                  onChange={(e) => updateDraft('domain', e.target.value)}
                  placeholder="e.g. FinTech"
                />
              </div>
            </div>

            <div className="sb-field">
              <label>Deploy For</label>
              <input
                value={draft.deployFor}
                onChange={(e) => updateDraft('deployFor', e.target.value)}
                placeholder="e.g. Leadership questions"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="sb-card-footer">
            {onDelete && (
              <button
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--text-danger, #c53030)', marginRight: 'auto' }}
                onClick={() => {
                  if (window.confirm('Delete this story? This cannot be undone.')) onDelete();
                }}
              >
                Delete
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onSave(draft)}
            >
              Save Story
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
