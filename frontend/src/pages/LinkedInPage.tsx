import { useRef, useState, type DragEvent } from 'react';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLinkedInChat } from '../hooks/useLinkedInChat';
import api from '../lib/api';
import './linkedin-page.css';

/* -- Safe text rendering for AI responses that may be strings or objects -- */
function safeText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(safeText).join('\n');
  if (typeof val === 'object') {
    // Render nested objects as "Key: value" lines
    return Object.entries(val)
      .map(([k, v]) => {
        const label = k.replace(/_/g, ' ');
        if (typeof v === 'string') return `**${label}:** ${v}`;
        if (Array.isArray(v)) return `**${label}:**\n${v.map((item: any) => typeof item === 'string' ? `- ${item}` : `- ${safeText(item)}`).join('\n')}`;
        if (typeof v === 'object' && v) return `**${label}:**\n${safeText(v)}`;
        return `**${label}:** ${String(v)}`;
      })
      .join('\n\n');
  }
  return String(val);
}

/* -- Markdown rendering (copied from ResumePage) -- */
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

/* -- Icons -- */
function UploadIcon() {
  return (
    <svg className="linkedin-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* -- Types -- */
interface LinkedInAnalysis {
  id?: string;
  overall: string;
  recruiter_discoverability: string;
  credibility_score: string;
  differentiation_score: string;
  headline_assessment: { current: string; assessment: string; recommended: string; rationale: string } | null;
  about_assessment: { assessment: string; recommended: string; rationale: string } | null;
  experience_assessment: { assessment: string; recommended_rewrite: string; rationale: string } | null;
  skills_assessment: { assessment: string; recommended_top_10: string[]; rationale: string } | null;
  photo_banner_assessment: { assessment: string; recommendations: string } | null;
  featured_assessment: { assessment: string; recommendations: string[] } | null;
  recommendations_assessment: { count_guidance: string; who_to_ask: string; how_to_ask: string } | null;
  url_completeness_assessment: { custom_url: string; completeness: string; open_to_work_guidance: string } | null;
  content_strategy: { posting_approach: string; post_ideas: string[]; engagement_tips: string } | null;
  top_fixes: { section: string; issue: string; fix: string; severity: string }[];
  positioning_gaps: string;
  cross_surface_gaps: any[];
  source: string;
  created_at: string;
}

/* -- Chat Panel -- */
function ChatPanel({ suggestions }: { suggestions: string[] }) {
  const { messages, isStreaming, sendMessage } = useLinkedInChat();
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

  return (
    <div className="lc-chat-panel">
      <div className="lc-chat-header">
        <span style={{ fontWeight: 600, fontSize: 13 }}>LinkedIn Coach</span>
      </div>

      <div className="lc-messages">
        {messages.length === 0 && (
          <div className="lc-empty">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>How can I help with your LinkedIn?</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              I can rewrite sections, improve your headline, optimize for recruiter search, or address any audit findings.
            </div>
            {suggestions.length > 0 && (
              <div className="lc-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="lc-suggestion-chip" onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`lc-msg lc-msg-${msg.role}`}>
            <div className="lc-msg-bubble">
              {msg.role === 'coach' ? renderMarkdown(msg.text) : msg.text}
              {msg.role === 'coach' && isStreaming && i === messages.length - 1 && <span className="lc-cursor" />}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="lc-input-area">
        {messages.length > 0 && suggestions.length > 0 && !isStreaming && (
          <div className="lc-suggestions" style={{ marginBottom: 8 }}>
            {suggestions.slice(0, 3).map((s, i) => (
              <button key={i} className="lc-suggestion-chip" onClick={() => handleSend(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="lc-input-row">
          <input
            className="lc-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask about your LinkedIn profile..."
            disabled={isStreaming}
          />
          <button className="lc-send-btn" onClick={() => handleSend()} disabled={isStreaming || !input.trim()}>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 10h12M12 4l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -- Audit Section Cards -- */

function parseDimValue(raw: any): { rating: string; rationale: string } {
  if (!raw) return { rating: 'N/A', rationale: '' };
  if (typeof raw === 'object' && raw.rating) return { rating: raw.rating, rationale: raw.rationale || '' };
  if (typeof raw === 'string') {
    if (raw.startsWith('{')) {
      try { const p = JSON.parse(raw); return { rating: p.rating || p.status || raw, rationale: p.rationale || '' }; } catch { /* fall through */ }
    }
    return { rating: raw.split(' ')[0], rationale: '' };
  }
  return { rating: String(raw), rationale: '' };
}

function dimColorClass(rating: string): string {
  const r = rating.toLowerCase();
  if (r.includes('strong') || r.includes('ready')) return 'li-dim-strong';
  if (r.includes('moderate') || r.includes('risky')) return 'li-dim-moderate';
  if (r.includes('weak') || r.includes('broken')) return 'li-dim-weak';
  return '';
}

function OverallSection({ analysis }: { analysis: LinkedInAnalysis }) {
  const dims = [
    { label: 'Recruiter Discoverability', ...parseDimValue(analysis.recruiter_discoverability) },
    { label: 'Credibility', ...parseDimValue(analysis.credibility_score) },
    { label: 'Differentiation', ...parseDimValue(analysis.differentiation_score) },
  ];

  // Derive overall rating from AI or from dimensions
  const overallRating = (analysis as any).overall_rating
    || (dims.every(d => d.rating.toLowerCase().includes('strong')) ? 'Strong'
      : dims.some(d => d.rating.toLowerCase().includes('weak')) ? 'Weak'
      : 'Needs Work');

  const ratingColor = overallRating.toLowerCase().includes('strong') ? 'li-dim-strong'
    : overallRating.toLowerCase().includes('weak') ? 'li-dim-weak'
    : 'li-dim-moderate';

  return (
    <div className="li-section">
      <div className="li-section-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>LinkedIn Profile Score</span>
        <span className={`li-dim-badge ${ratingColor}`} style={{ fontSize: 13, padding: '4px 14px' }}>{overallRating}</span>
      </div>
      <div className="li-overall">{safeText(analysis.overall)}</div>
      <div className="li-dims">
        {dims.map((d) => (
          <div key={d.label} className="li-dim">
            <span className="li-dim-label">{d.label}</span>
            <span className={`li-dim-badge ${dimColorClass(d.rating)}`}>{d.rating}</span>
          </div>
        ))}
      </div>
      {dims.some(d => d.rationale) && (
        <div className="li-dim-rationales">
          {dims.filter(d => d.rationale).map(d => (
            <div key={d.label} className="li-dim-rationale-item">
              <strong>{d.label}:</strong> {d.rationale}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadlineSection({ data }: { data: NonNullable<LinkedInAnalysis['headline_assessment']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">Headline</div>
      <div className="li-section-assessment">{safeText(data.assessment)}</div>
      {data.current && <div className="li-section-current">{safeText(data.current)}</div>}
      {data.recommended && <div className="li-section-recommended">{safeText(data.recommended)}</div>}
      {data.rationale && <div className="li-section-rationale">{safeText(data.rationale)}</div>}
    </div>
  );
}

function AboutSection({ data }: { data: NonNullable<LinkedInAnalysis['about_assessment']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">About</div>
      <div className="li-section-assessment">{safeText(data.assessment)}</div>
      {data.recommended && <div className="li-section-recommended">{renderMarkdown(safeText(data.recommended))}</div>}
      {data.rationale && <div className="li-section-rationale">{safeText(data.rationale)}</div>}
    </div>
  );
}

function ExperienceSection({ data }: { data: NonNullable<LinkedInAnalysis['experience_assessment']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">Experience</div>
      <div className="li-section-assessment">{safeText(data.assessment)}</div>
      {data.recommended_rewrite && <div className="li-section-recommended">{renderMarkdown(safeText(data.recommended_rewrite))}</div>}
      {data.rationale && <div className="li-section-rationale">{safeText(data.rationale)}</div>}
    </div>
  );
}

function SkillsSection({ data }: { data: NonNullable<LinkedInAnalysis['skills_assessment']> }) {
  const skills = Array.isArray(data.recommended_top_10) ? data.recommended_top_10 : [];
  return (
    <div className="li-section">
      <div className="li-section-header">Skills</div>
      <div className="li-section-assessment">{safeText(data.assessment)}</div>
      {skills.length > 0 && (
        <>
          <div className="li-section-label" style={{ marginTop: 8 }}>Recommended Top 10</div>
          <div className="li-skill-tags">
            {skills.map((skill, i) => (
              <span key={i} className="li-skill-tag">{safeText(skill)}</span>
            ))}
          </div>
        </>
      )}
      {data.rationale && <div className="li-section-rationale">{safeText(data.rationale)}</div>}
    </div>
  );
}

function PhotoBannerSection({ data }: { data: NonNullable<LinkedInAnalysis['photo_banner_assessment']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">Photo & Banner</div>
      <div className="li-section-assessment">{safeText(data.assessment)}</div>
      {data.recommendations && (
        <div className="li-section-text" style={{ marginTop: 6 }}>
          <div className="li-section-label">Recommendations</div>
          {renderMarkdown(safeText(data.recommendations))}
        </div>
      )}
    </div>
  );
}

function FeaturedSection({ data }: { data: NonNullable<LinkedInAnalysis['featured_assessment']> }) {
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  return (
    <div className="li-section">
      <div className="li-section-header">Featured</div>
      <div className="li-section-assessment">{safeText(data.assessment)}</div>
      {recs.length > 0 && (
        <>
          <div className="li-section-label" style={{ marginTop: 8 }}>Recommendations</div>
          <ul className="li-rec-list">
            {recs.map((rec, i) => (
              <li key={i}>{safeText(rec)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RecommendationsSection({ data }: { data: NonNullable<LinkedInAnalysis['recommendations_assessment']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">Recommendations</div>
      {data.count_guidance && (
        <div className="li-section-text" style={{ marginBottom: 6 }}>
          <div className="li-section-label">Guidance</div>
          {safeText(data.count_guidance)}
        </div>
      )}
      {data.who_to_ask && (
        <div className="li-section-text" style={{ marginBottom: 6 }}>
          <div className="li-section-label">Who to Ask</div>
          {safeText(data.who_to_ask)}
        </div>
      )}
      {data.how_to_ask && (
        <div className="li-section-text">
          <div className="li-section-label">How to Ask</div>
          {safeText(data.how_to_ask)}
        </div>
      )}
    </div>
  );
}

function UrlCompletenessSection({ data }: { data: NonNullable<LinkedInAnalysis['url_completeness_assessment']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">URL & Completeness</div>
      {data.custom_url && (
        <div className="li-section-text" style={{ marginBottom: 6 }}>
          <div className="li-section-label">Custom URL</div>
          {safeText(data.custom_url)}
        </div>
      )}
      {data.completeness && (
        <div className="li-section-text" style={{ marginBottom: 6 }}>
          <div className="li-section-label">Completeness</div>
          {safeText(data.completeness)}
        </div>
      )}
      {data.open_to_work_guidance && (
        <div className="li-section-text">
          <div className="li-section-label">Open to Work Guidance</div>
          {safeText(data.open_to_work_guidance)}
        </div>
      )}
    </div>
  );
}

function TopFixesSection({ fixes }: { fixes: LinkedInAnalysis['top_fixes'] }) {
  if (!fixes || fixes.length === 0) return null;
  return (
    <div className="li-section">
      <div className="li-section-header">Top Fixes</div>
      {fixes.map((fix, i) => (
        <div key={i} className="li-fix">
          <span className={`li-fix-severity ${fix.severity || 'neutral'}`}>
            {fix.severity === 'red' ? 'Fix' : fix.severity === 'amber' ? 'Improve' : fix.severity === 'green' ? 'Nice' : 'Note'}
          </span>
          <span className="li-fix-text">
            <span className="li-fix-section">{fix.section}:</span> {fix.issue} — <em>{fix.fix}</em>
          </span>
        </div>
      ))}
    </div>
  );
}

function ContentStrategySection({ data }: { data: NonNullable<LinkedInAnalysis['content_strategy']> }) {
  return (
    <div className="li-section">
      <div className="li-section-header">Content Strategy</div>
      {data.posting_approach && (
        <div className="li-section-text" style={{ marginBottom: 8 }}>
          <div className="li-section-label">Posting Approach</div>
          {data.posting_approach}
        </div>
      )}
      {data.post_ideas && data.post_ideas.length > 0 && (
        <>
          <div className="li-section-label">Post Ideas</div>
          <ul className="li-post-ideas">
            {data.post_ideas.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ul>
        </>
      )}
      {data.engagement_tips && (
        <div className="li-section-text" style={{ marginTop: 8 }}>
          <div className="li-section-label">Engagement Tips</div>
          {data.engagement_tips}
        </div>
      )}
    </div>
  );
}

/* -- Main Page -- */
export function LinkedInPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [profileText, setProfileText] = useState('');

  const linkedinQuery = useQuery({
    queryKey: ['linkedin', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/api/materials/linkedin');
      return data as LinkedInAnalysis | null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const auditMutation = useMutation({
    mutationFn: async (input: { file?: File; text?: string }) => {
      const formData = new FormData();
      if (input.file) {
        formData.append('file', input.file);
      } else if (input.text) {
        formData.append('linkedin_text', input.text);
      }
      const { data } = await api.post('/api/materials/linkedin/audit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin'] });
      setProfileText('');
    },
  });

  const analysis = linkedinQuery.data;
  const isLoading = linkedinQuery.isLoading;

  function handleFile(file: File) {
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      auditMutation.mutate({ file });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleReaudit() {
    queryClient.removeQueries({ queryKey: ['linkedin'] });
    setProfileText('');
  }

  function handleDelete() {
    if (window.confirm('Delete this LinkedIn audit? You can re-audit at any time.')) {
      queryClient.removeQueries({ queryKey: ['linkedin'] });
      setProfileText('');
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="linkedin-page">
        <div className="linkedin-auditing">
          <div className="linkedin-auditing-inner">
            <div className="linkedin-auditing-spinner" />
            <div className="linkedin-auditing-text">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Auditing state
  if (auditMutation.isPending) {
    return (
      <div className="linkedin-page">
        <div className="linkedin-auditing">
          <div className="linkedin-auditing-inner">
            <div className="linkedin-auditing-spinner" />
            <div className="linkedin-auditing-text">Auditing your LinkedIn profile...</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Running 9-section audit calibrated to how recruiters search and scan profiles.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hidden file input (shared)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf"
      style={{ display: 'none' }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
      }}
    />
  );

  // State 1 — Empty (no audit yet)
  if (!analysis) {
    return (
      <div className="linkedin-page">
        <div className="linkedin-header">
          <h1>LinkedIn</h1>
        </div>
        {fileInput}
        <div className="linkedin-upload">
          <div className="linkedin-upload-inner">
            {/* Left: PDF upload */}
            <div
              className={`linkedin-dropzone${dragging ? ' dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div>
                <UploadIcon />
                <div className="linkedin-dropzone-title">Upload LinkedIn PDF</div>
                <div className="linkedin-dropzone-desc">
                  Export your profile as PDF from LinkedIn, then drop it here.
                </div>
                <button className="btn btn-primary">Choose PDF</button>
                <div className="linkedin-dropzone-hint">Drag and drop supported</div>
              </div>
            </div>

            {/* Divider */}
            <div className="linkedin-or">or</div>

            {/* Right: Paste text */}
            <div className="linkedin-paste">
              <div className="linkedin-paste-label">Paste your profile text</div>
              <textarea
                className="linkedin-paste-textarea"
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                placeholder="Copy your LinkedIn profile text and paste it here..."
              />
              <button
                className="btn btn-primary linkedin-paste-btn"
                onClick={() => auditMutation.mutate({ text: profileText })}
                disabled={!profileText.trim()}
              >
                Start Audit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Build suggestion chips from top_fixes
  const fixSuggestions = (analysis.top_fixes || [])
    .slice(0, 4)
    .map(fix => `Help me fix: ${fix.issue.length > 50 ? fix.issue.slice(0, 47) + '...' : fix.issue}`)
    .filter(Boolean);
  const suggestions = ['Rewrite my headline', ...fixSuggestions];

  // State 3 — Results (split pane)
  return (
    <div className="linkedin-page">
      <div className="linkedin-header">
        <h1>LinkedIn</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {fileInput}
          <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={handleReaudit}>
            Re-audit
          </button>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, color: '#c0392b', borderColor: '#c0392b' }}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="linkedin-split">
        {/* Left: Scrollable audit sections */}
        <div className="linkedin-left-panel">
          {/* 1. Overall Score */}
          <OverallSection analysis={analysis} />

          {/* 2. Headline */}
          {analysis.headline_assessment && (
            <HeadlineSection data={analysis.headline_assessment} />
          )}

          {/* 3. About */}
          {analysis.about_assessment && (
            <AboutSection data={analysis.about_assessment} />
          )}

          {/* 4. Experience */}
          {analysis.experience_assessment && (
            <ExperienceSection data={analysis.experience_assessment} />
          )}

          {/* 5. Skills */}
          {analysis.skills_assessment && (
            <SkillsSection data={analysis.skills_assessment} />
          )}

          {/* 6. Photo & Banner */}
          {analysis.photo_banner_assessment && (
            <PhotoBannerSection data={analysis.photo_banner_assessment} />
          )}

          {/* 7. Featured */}
          {analysis.featured_assessment && (
            <FeaturedSection data={analysis.featured_assessment} />
          )}

          {/* 8. Recommendations */}
          {analysis.recommendations_assessment && (
            <RecommendationsSection data={analysis.recommendations_assessment} />
          )}

          {/* 9. URL & Completeness */}
          {analysis.url_completeness_assessment && (
            <UrlCompletenessSection data={analysis.url_completeness_assessment} />
          )}

          {/* 10. Top Fixes */}
          <TopFixesSection fixes={analysis.top_fixes} />

          {/* 11. Content Strategy */}
          {analysis.content_strategy && (
            <ContentStrategySection data={analysis.content_strategy} />
          )}

          {/* Positioning Gaps */}
          {analysis.positioning_gaps && (
            <div className="li-section">
              <div className="li-section-header">Positioning Gaps</div>
              <div className="li-section-text">{analysis.positioning_gaps}</div>
            </div>
          )}
        </div>

        {/* Right: Coach Chat */}
        <div className="linkedin-chat-panel">
          <ChatPanel suggestions={suggestions} />
        </div>
      </div>
    </div>
  );
}
