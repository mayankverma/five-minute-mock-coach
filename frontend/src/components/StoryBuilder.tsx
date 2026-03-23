import { useState, useRef, useEffect } from 'react';
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

/* ── Dummy opening prompts (prototype only) ── */

const OPENING_PROMPTS: ChatMessage[] = [
  {
    role: 'coach',
    text: "Let's surface a great interview story. Don't worry about structure yet — I'll help shape it.\n\nThink about a moment at work where you were at your best. What comes to mind?",
  },
];

const EXISTING_STORY_PROMPTS = (title: string): ChatMessage[] => [
  {
    role: 'coach',
    text: `I've loaded your story "${title}". I can see the STAR details on the right.\n\nWould you like to:\n1. **Strengthen** a specific section (Situation, Action, etc.)\n2. **Extract an earned secret** — the unique insight only you learned\n3. **Practice telling** this story in 90 seconds`,
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

export function StoryBuilder({ initial, onSave, onCancel }: StoryBuilderProps) {
  const isExisting = !!(initial && initial.title);

  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(
    isExisting ? EXISTING_STORY_PROMPTS(initial!.title!) : OPENING_PROMPTS,
  );
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(isExisting);
  const [draft, setDraft] = useState<StoryDraft>({ ...EMPTY, ...initial });
  const [recentlyFilled, setRecentlyFilled] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  /* ── Dummy AI response (prototype only) ── */
  const simulateCoachReply = (userMsg: string) => {
    // Simulate extracting story content and filling fields
    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      const newFilled = new Set<string>();

      // Simulate AI extracting title from the conversation
      if (!draft.title && userMsg.length > 20) {
        const words = userMsg.split(' ').slice(0, 6).join(' ');
        updateDraft('title', words.charAt(0).toUpperCase() + words.slice(1));
        newFilled.add('title');
      }

      // Simulate AI extracting situation
      if (!draft.situation && (lower.includes('when') || lower.includes('at my') || lower.includes('was working'))) {
        updateDraft('situation', userMsg);
        newFilled.add('situation');
      }

      if (newFilled.size > 0) {
        setRecentlyFilled(newFilled);
        // Auto-expand card when first field is filled
        if (!cardExpanded) setCardExpanded(true);
        setTimeout(() => setRecentlyFilled(new Set()), 2000);
      }

      // Add coach follow-up
      let reply: string;
      if (!draft.situation || lower.includes('when') || lower.includes('was working')) {
        reply =
          "That's a compelling situation. I can already see the story forming.\n\nWhat was your specific responsibility? What were you expected to deliver or solve?";
      } else if (!draft.action) {
        reply =
          "Good — now for the most important part. Walk me through exactly what *you* did. Not the team, not the process — your specific actions and decisions.";
      } else if (!draft.result) {
        reply =
          "Strong actions. What was the outcome? If you can attach a number — revenue saved, time reduced, team size — do it.";
      } else {
        reply =
          "Nice — this story has solid bones. Let me ask you something: what did you believe *before* this experience that turned out to be wrong? That's where your earned secret lives.";
      }

      setMessages((prev) => [...prev, { role: 'coach', text: reply }]);
    }, 1200);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: inputText.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    simulateCoachReply(userMsg.text);
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
              <button className="sb-send-btn" onClick={handleSend}>
                <SendIcon />
              </button>
            </div>
          ) : (
            <div className="sb-voice-area">
              <div className="sb-voice-hint">
                {isRecording ? 'Listening... click to stop' : 'Click to start speaking'}
              </div>
              <button
                className={`sb-mic-btn ${isRecording ? 'recording' : ''}`}
                onClick={() => setIsRecording((v) => !v)}
              >
                <svg viewBox="0 0 24 24">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              </button>
              {isRecording && (
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
            <div className={`sb-field ${recentlyFilled.has('title') ? 'just-filled' : ''}`}>
              <label>Title</label>
              <input
                value={draft.title}
                onChange={(e) => updateDraft('title', e.target.value)}
                placeholder="Generated from conversation..."
              />
            </div>

            <div className={`sb-field ${recentlyFilled.has('situation') ? 'just-filled' : ''}`}>
              <label>Situation</label>
              <textarea
                value={draft.situation}
                onChange={(e) => updateDraft('situation', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={3}
              />
            </div>

            <div className={`sb-field ${recentlyFilled.has('task') ? 'just-filled' : ''}`}>
              <label>Task</label>
              <textarea
                value={draft.task}
                onChange={(e) => updateDraft('task', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={2}
              />
            </div>

            <div className={`sb-field ${recentlyFilled.has('action') ? 'just-filled' : ''}`}>
              <label>Action</label>
              <textarea
                value={draft.action}
                onChange={(e) => updateDraft('action', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={3}
              />
            </div>

            <div className={`sb-field ${recentlyFilled.has('result') ? 'just-filled' : ''}`}>
              <label>Result</label>
              <textarea
                value={draft.result}
                onChange={(e) => updateDraft('result', e.target.value)}
                placeholder="Will populate as you talk..."
                rows={2}
              />
            </div>

            <div className="sb-field-row">
              <div className={`sb-field ${recentlyFilled.has('primarySkill') ? 'just-filled' : ''}`}>
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

            <div className={`sb-field ${recentlyFilled.has('earnedSecret') ? 'just-filled' : ''}`}>
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
