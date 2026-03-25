import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useResume } from '../hooks/useResume';
import { useOutreachChat } from '../hooks/useOutreachChat';
import api from '../lib/api';
import './outreach-page.css';
import './pages.css';

/* -- Types -- */
interface Conversation {
  id: string;
  title: string;
  message_type: string;
  created_at: string;
  updated_at: string;
}

/* -- Message types -- */
const MESSAGE_TYPES = [
  { key: 'cold_linkedin', label: 'Cold LinkedIn Connection', limit: '300 chars' },
  { key: 'cold_email', label: 'Cold Email', limit: '75-125 words' },
  { key: 'warm_intro', label: 'Warm Intro Request', limit: 'Forwardable blurb' },
  { key: 'informational', label: 'Informational Interview Ask', limit: '' },
  { key: 'recruiter_reply', label: 'Recruiter Reply', limit: '' },
  { key: 'follow_up', label: 'Follow-Up', limit: '' },
  { key: 'post_meeting', label: 'Post-Meeting Follow-Up', limit: '' },
  { key: 'referral', label: 'Referral Request', limit: '' },
];

const MESSAGE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MESSAGE_TYPES.map((t) => [t.key, t.label]),
);

const SUGGESTION_PILLS: Record<string, string[]> = {
  cold_linkedin: ['Draft for a hiring manager at my target company', 'I have a mutual connection \u2014 help me leverage it', 'Help me find the right hook'],
  cold_email: ['Write a cold email to a VP of Engineering', 'Help me craft a compelling subject line', 'Review my draft email'],
  warm_intro: ['Ask a former colleague for an introduction', 'Write a forwardable blurb for my connector'],
  informational: ['Ask someone in my target role for 15 min', 'Prepare questions for an informational'],
  recruiter_reply: ['A recruiter reached out \u2014 help me respond', 'How do I ask about compensation range?'],
  follow_up: ['Follow up on an unanswered message', 'Add value in my follow-up without being pushy'],
  post_meeting: ['Write a thank-you after a coffee chat', 'Follow up after an informational interview'],
  referral: ['Ask for a referral at my target company', 'Write materials for my referrer to forward'],
};

/* -- Markdown rendering (copied from LinkedInPage) -- */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).map((seg, k) => {
    if (seg.startsWith('**') && seg.endsWith('**')) return <strong key={k}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith('*') && seg.endsWith('*')) return <em key={k}>{seg.slice(1, -1)}</em>;
    if (seg.startsWith('`') && seg.endsWith('`')) return <code key={k} style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em' }}>{seg.slice(1, -1)}</code>;
    return <span key={k}>{seg}</span>;
  });
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let keyCounter = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    elements.push(
      <Tag key={`list-${keyCounter++}`} style={{ margin: '6px 0', paddingLeft: 20 }}>
        {listItems.map((item, i) => <li key={i} style={{ marginBottom: 3 }}>{renderInline(item)}</li>)}
      </Tag>
    );
    listItems = [];
  };

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    const k = `ln-${keyCounter++}`;

    if (line.startsWith('### ')) {
      flushList();
      elements.push(<div key={k} style={{ fontWeight: 700, fontSize: 13, marginTop: 10, marginBottom: 4 }}>{renderInline(line.slice(4))}</div>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<div key={k} style={{ fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 4 }}>{renderInline(line.slice(3))}</div>);
    } else if (line.startsWith('> ')) {
      flushList();
      elements.push(<blockquote key={k} style={{ borderLeft: '3px solid var(--border-light)', paddingLeft: 12, margin: '6px 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{renderInline(line.slice(2))}</blockquote>);
    } else if (line.match(/^[-*] /)) {
      if (listOrdered) flushList();
      listOrdered = false;
      listItems.push(line.slice(2));
    } else if (line.match(/^\d+\.\s/)) {
      if (!listOrdered && listItems.length) flushList();
      listOrdered = true;
      listItems.push(line.replace(/^\d+\.\s/, ''));
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={k} style={{ height: 8 }} />);
      } else {
        elements.push(<div key={k}>{renderInline(line)}</div>);
      }
    }
  }
  flushList();
  return <>{elements}</>;
}

/* -- Chat View Component -- */
function ChatView({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const { messages, isStreaming, isLoading, sendMessage } = useOutreachChat(conversation.id);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    sendMessage(msg);
    setInput('');
  }

  const pills = SUGGESTION_PILLS[conversation.message_type] || [];

  if (isLoading) {
    return (
      <div className="outreach-page">
        <div className="outreach-loading">
          <div className="outreach-loading-inner">
            <div className="outreach-loading-spinner" />
            <div className="outreach-loading-text">Loading conversation...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="outreach-page">
      <div className="outreach-chat-header">
        <button className="outreach-back-btn" onClick={onBack}>
          &larr; Back to Outreach
        </button>
        <span className="outreach-chat-title">{conversation.title}</span>
      </div>

      <div className="outreach-chat-body">
        <div className="outreach-messages">
          {messages.length === 0 && (
            <div className="oc-welcome">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>How can I help with your outreach?</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                I can help you draft, refine, and personalize your{' '}
                {MESSAGE_TYPE_LABELS[conversation.message_type]?.toLowerCase() || 'message'}.
              </div>
              {pills.length > 0 && (
                <div className="oc-suggestions">
                  {pills.map((s, i) => (
                    <button key={i} className="oc-suggestion-chip" onClick={() => handleSend(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`oc-msg oc-msg-${msg.role}`}>
              <div className="oc-msg-bubble">
                {msg.role === 'coach' ? renderMarkdown(msg.text) : msg.text}
                {msg.role === 'coach' && isStreaming && i === messages.length - 1 && <span className="oc-cursor" />}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="oc-input-area">
          {messages.length > 0 && pills.length > 0 && !isStreaming && (
            <div className="oc-suggestions" style={{ marginBottom: 8 }}>
              {pills.slice(0, 3).map((s, i) => (
                <button key={i} className="oc-suggestion-chip" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="oc-input-row">
            <input
              className="oc-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type your message..."
              disabled={isStreaming}
            />
            <button className="oc-send-btn" onClick={() => handleSend()} disabled={isStreaming || !input.trim()}>
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 10h12M12 4l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- Main Page -- */
export function OutreachPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasResume, isLoading: resumeLoading } = useResume();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'list' | 'chat'>('list');
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const conversationsQuery = useQuery<Conversation[]>({
    queryKey: ['outreach-conversations', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/api/outreach/conversations');
      return data as Conversation[];
    },
    staleTime: 30 * 1000,
    enabled: !!user && !authLoading,
  });

  const createMutation = useMutation({
    mutationFn: async (messageType: string) => {
      const { data } = await api.post('/api/outreach/conversations', { message_type: messageType });
      return data as Conversation;
    },
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-conversations'] });
      setActiveConversation(newConv);
      setView('chat');
      setShowTypeSelector(false);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data } = await api.put(`/api/outreach/conversations/${id}`, { title });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-conversations'] });
      setRenamingId(null);
      setRenameValue('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/outreach/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-conversations'] });
    },
  });

  const conversations = conversationsQuery.data || [];

  function startNewChat() {
    setShowTypeSelector(true);
  }

  function createConversation(messageType: string) {
    createMutation.mutate(messageType);
  }

  function openConversation(conv: Conversation) {
    setActiveConversation(conv);
    setView('chat');
  }

  function goBack() {
    setView('list');
    setActiveConversation(null);
    queryClient.invalidateQueries({ queryKey: ['outreach-conversations'] });
  }

  function handleRename(id: string, currentTitle: string) {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  function submitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameMutation.mutate({ id, title: trimmed });
    } else {
      setRenamingId(null);
    }
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this conversation? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  }

  // Loading state
  if (authLoading || resumeLoading) {
    return (
      <div className="outreach-page">
        <div className="outreach-loading">
          <div className="outreach-loading-inner">
            <div className="outreach-loading-spinner" />
            <div className="outreach-loading-text">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Locked state — no resume
  if (!hasResume) {
    return (
      <div className="outreach-page">
        <div className="outreach-header">
          <div className="outreach-header-left">
            <h1>Outreach</h1>
            <p className="page-subtitle">Craft personalized networking messages with your AI coach.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-title">Upload your resume to unlock Outreach</div>
            <div className="empty-state-desc">Outreach messages are personalized using your resume and positioning.</div>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => (window.location.href = '/resume')}
            >
              Go to Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chat view
  if (view === 'chat' && activeConversation) {
    return <ChatView conversation={activeConversation} onBack={goBack} />;
  }

  // List view
  return (
    <div className="outreach-page">
      <div className="outreach-header">
        <div className="outreach-header-left">
          <h1>Outreach</h1>
          <p className="page-subtitle">Craft personalized networking messages with your AI coach.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={startNewChat}>
          + New Chat
        </button>
      </div>

      {/* Type selector */}
      {showTypeSelector && (
        <div className="outreach-type-grid">
          {MESSAGE_TYPES.map((type) => (
            <div
              key={type.key}
              className="outreach-type-card"
              onClick={() => createConversation(type.key)}
            >
              <div className="outreach-type-label">{type.label}</div>
              {type.limit && <div className="outreach-type-limit">{type.limit}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Creating spinner */}
      {createMutation.isPending && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          Creating conversation...
        </div>
      )}

      {/* Conversation table */}
      {conversations.length > 0 && (
        <div className="outreach-table-wrap">
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conv) => (
                    <tr key={conv.id} style={{ cursor: 'pointer' }}>
                      <td onClick={() => openConversation(conv)}>
                        {renamingId === conv.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitRename(conv.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            onBlur={() => submitRename(conv.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: 13,
                              padding: '2px 6px',
                              border: '1px solid var(--primary)',
                              borderRadius: 'var(--radius-xs)',
                              fontFamily: 'var(--ff-body)',
                              color: 'var(--text)',
                              background: 'var(--bg)',
                              width: '100%',
                            }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{conv.title}</span>
                        )}
                      </td>
                      <td onClick={() => openConversation(conv)}>
                        {MESSAGE_TYPE_LABELS[conv.message_type] || conv.message_type}
                      </td>
                      <td onClick={() => openConversation(conv)}>
                        {new Date(conv.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="outreach-actions">
                          <button
                            className="outreach-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(conv.id, conv.title);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="outreach-action-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(conv.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {conversations.length === 0 && !showTypeSelector && !conversationsQuery.isLoading && (
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-title">No outreach conversations yet</div>
            <div className="empty-state-desc">
              Start a conversation to draft personalized networking messages.
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={startNewChat}>
              Start your first outreach
            </button>
          </div>
        </div>
      )}

      {/* Loading conversations */}
      {conversationsQuery.isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          Loading conversations...
        </div>
      )}
    </div>
  );
}
