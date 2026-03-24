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
    text: `I've loaded your story "${title}". I can see the details on the right.\n\nPick an area below to improve, or type your own question.`,
  },
];

function buildSuggestions(draft: Partial<StoryDraft>): { label: string; prompt: string }[] {
  const suggestions: { label: string; prompt: string }[] = [];

  // Always offer the 90-second practice
  suggestions.push({
    label: '🎯 Practice telling this in 90 seconds',
    prompt: 'Help me practice telling this story concisely in 90 seconds. Coach me on what to cut and what to emphasize.',
  });

  // Check for weak sections
  if (!draft.situation || draft.situation.length < 80) {
    suggestions.push({
      label: '📍 Strengthen the Situation',
      prompt: 'The Situation section feels thin. Help me add more context — what was at stake, who was involved, and why it mattered.',
    });
  }
  if (!draft.action || draft.action.length < 100) {
    suggestions.push({
      label: '⚡ Deepen the Action',
      prompt: 'Help me make the Action section more specific. What concrete steps did I take? What decisions did I make and why?',
    });
  }
  if (!draft.result || draft.result.length < 80) {
    suggestions.push({
      label: '📊 Quantify the Result',
      prompt: 'Help me make the Result more compelling with specific numbers, metrics, or concrete outcomes.',
    });
  }

  // Earned secret quality
  if (!draft.earnedSecret || draft.earnedSecret.length < 40) {
    suggestions.push({
      label: '💡 Extract a deeper Earned Secret',
      prompt: 'Help me dig deeper into what I uniquely learned from this experience — the insight that only someone who lived it would know.',
    });
  } else {
    suggestions.push({
      label: '💡 Sharpen the Earned Secret',
      prompt: `My current earned secret is: "${draft.earnedSecret}". Help me make it more memorable and unique — something an interviewer would remember.`,
    });
  }

  // Deploy-for expansion
  if (!draft.deployFor || draft.deployFor.split(';').length < 3) {
    suggestions.push({
      label: '🗂️ Find more interview questions this fits',
      prompt: 'What other common interview questions could I deploy this story for? Help me identify all the question types where this story would be a strong answer.',
    });
  }

  // General strength
  suggestions.push({
    label: '🔍 What\'s the weakest part of this story?',
    prompt: 'Analyze this story critically. What is the weakest section and what specific improvements would raise the overall strength?',
  });

  return suggestions;
}

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

/* ── Simple markdown renderer ── */

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((seg, k) =>
    seg.startsWith('**') && seg.endsWith('**') ? (
      <strong key={k}>{seg.slice(2, -2)}</strong>
    ) : (
      <span key={k}>{seg}</span>
    ),
  );
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    elements.push(
      <Tag key={elements.length} style={{ margin: '6px 0', paddingLeft: 20 }}>
        {listItems.map((item, i) => <li key={i} style={{ marginBottom: 3 }}>{renderInline(item)}</li>)}
      </Tag>
    );
    listItems = [];
  };

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<div key={j} style={{ fontWeight: 700, fontSize: 13, marginTop: 10, marginBottom: 4 }}>{renderInline(line.slice(4))}</div>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<div key={j} style={{ fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 4 }}>{renderInline(line.slice(3))}</div>);
    } else if (line.match(/^[-*] /)) {
      // Unordered list item
      if (listOrdered) flushList();
      listOrdered = false;
      listItems.push(line.slice(2));
    } else if (line.match(/^\d+\.\s/)) {
      // Ordered list item
      if (!listOrdered && listItems.length) flushList();
      listOrdered = true;
      listItems.push(line.replace(/^\d+\.\s/, ''));
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<br key={j} />);
      } else {
        elements.push(<span key={j}>{renderInline(line)}<br /></span>);
      }
    }
  }
  flushList();
  return <>{elements}</>;
}

/* ── Component ── */

export function StoryBuilder({ initial, onSave, onCancel, onDelete }: StoryBuilderProps) {
  const isExisting = !!(initial && initial.title);

  // Build story context string so the coach can see the full story when editing
  const storyContext = isExisting ? [
    `Here is the full story I'm working on improving:`,
    `Title: ${initial!.title}`,
    initial!.situation ? `Situation: ${initial!.situation}` : '',
    initial!.task ? `Task: ${initial!.task}` : '',
    initial!.action ? `Action: ${initial!.action}` : '',
    initial!.result ? `Result: ${initial!.result}` : '',
    initial!.primarySkill ? `Primary Skill: ${initial!.primarySkill}` : '',
    initial!.secondarySkill ? `Secondary Skill: ${initial!.secondarySkill}` : '',
    initial!.earnedSecret ? `Earned Secret: ${initial!.earnedSecret}` : '',
    initial!.domain ? `Domain: ${initial!.domain}` : '',
    initial!.deployFor ? `Deploy For: ${initial!.deployFor}` : '',
  ].filter(Boolean).join('\n') : undefined;

  const { messages, isStreaming, storyExtract, sendMessage } = useStoryChat(
    isExisting ? existingOpening(initial!.title!) : OPENING,
    storyContext,
  );

  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [inputText, setInputText] = useState('');
  const [cardExpanded, setCardExpanded] = useState(isExisting);
  const [draft, setDraft] = useState<StoryDraft>({ ...EMPTY, ...initial });
  const [justExtracted, setJustExtracted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(isExisting);
  const suggestions = isExisting ? buildSuggestions(initial || {}) : [];

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
    setShowSuggestions(false);
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
                {renderMarkdown(msg.text)}
              </div>
            ))}
            {showSuggestions && !isStreaming && messages.length <= 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0 12px' }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    style={{
                      padding: '8px 14px',
                      fontSize: 13,
                      lineHeight: 1.4,
                      background: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border-light, #e0ddd7)',
                      borderRadius: 20,
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent, #4a9e8f)';
                      e.currentTarget.style.background = 'var(--bg-muted, #f5f3ef)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-light, #e0ddd7)';
                      e.currentTarget.style.background = 'var(--bg-card, #fff)';
                    }}
                    onClick={() => {
                      setShowSuggestions(false);
                      sendMessage(s.prompt);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
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
