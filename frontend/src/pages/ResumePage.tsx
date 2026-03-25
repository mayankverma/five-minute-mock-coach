import { useRef, useState, useEffect, type DragEvent } from 'react';
import { useResume } from '../hooks/useResume';
import { useResumeChat } from '../hooks/useResumeChat';
import type { ResumeSection, ResumeAnalysis } from '../hooks/useResume';
import api from '../lib/api';
import './resume-page.css';

/* -- Markdown rendering -- */
function renderInline(text: string) {
  // Handle **bold**, *italic*, and `code`
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
    <svg className="resume-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* -- Helpers -- */
function dimValue(raw: any): string {
  if (!raw) return 'N/A';
  if (typeof raw === 'object' && raw.status) return raw.status;
  if (typeof raw === 'string') {
    if (raw.startsWith('{')) {
      try { const parsed = JSON.parse(raw); return parsed.status || raw; } catch { /* fall through */ }
    }
    return raw.split(' ')[0];
  }
  return 'N/A';
}

function dimClass(val: any) {
  const v = dimValue(val).toLowerCase();
  if (v.includes('strong') || v.includes('ready') || v.includes('aligned')) return 'strong';
  if (v.includes('moderate') || v.includes('risky')) return 'moderate';
  if (v.includes('weak') || v.includes('broken') || v.includes('mismatched')) return 'weak';
  return '';
}

/* -- Analysis Accordion -- */
function AnalysisAccordion({ analysis, onReanalyze, isAnalyzing }: {
  analysis: ResumeAnalysis | null;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addedSeeds, setAddedSeeds] = useState<Set<number>>(new Set());
  const [addingSeeds, setAddingSeeds] = useState<Set<number>>(new Set());
  const [existingTitles, setExistingTitles] = useState<Set<string>>(new Set());

  // On mount, fetch existing story titles to detect duplicates
  useEffect(() => {
    api.get('/api/stories').then(({ data }) => {
      const titles = new Set<string>(
        (data || []).map((s: { title: string }) => s.title?.toLowerCase().trim()).filter(Boolean)
      );
      setExistingTitles(titles);

      // Mark seeds that already exist as "added"
      if (analysis?.story_seeds) {
        const alreadyAdded = new Set<number>();
        analysis.story_seeds.forEach((seed, i) => {
          const seedTitle = (seed.title || seed.source_bullet || '').toLowerCase().trim();
          if (seedTitle && titles.has(seedTitle)) alreadyAdded.add(i);
        });
        if (alreadyAdded.size > 0) setAddedSeeds(alreadyAdded);
      }
    }).catch(() => {});
  }, [analysis]);

  // Track in-flight requests to prevent double-clicks
  const inflightRef = useRef(new Set<number>());

  async function addToStorybank(seed: { title: string; source_bullet: string; potential_skill: string }, index: number) {
    // Immediate guard — prevents double-clicks before React re-renders
    if (inflightRef.current.has(index)) return;
    inflightRef.current.add(index);

    const seedTitle = (seed.title || seed.source_bullet || '').toLowerCase().trim();
    if (existingTitles.has(seedTitle)) {
      setAddedSeeds(prev => new Set(prev).add(index));
      inflightRef.current.delete(index);
      return;
    }

    setAddingSeeds(prev => new Set(prev).add(index));
    try {
      await api.post('/api/stories', {
        title: seed.title || seed.source_bullet,
        notes: `[Resume seed] ${seed.source_bullet || seed.title}. This story needs STAR details — use Improve with Coach to develop it.`,
        primary_skill: seed.potential_skill || undefined,
      });
      setAddedSeeds(prev => new Set(prev).add(index));
      setExistingTitles(prev => new Set(prev).add(seedTitle));
    } catch (err) {
      console.error('Failed to add story seed:', err);
    } finally {
      setAddingSeeds(prev => { const s = new Set(prev); s.delete(index); return s; });
      inflightRef.current.delete(index);
    }
  }

  if (!analysis && !isAnalyzing) {
    return (
      <div className="ra-accordion">
        <div className="ra-accordion-header" style={{ cursor: 'default' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Analysis</span>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={onReanalyze}>Analyze Resume</button>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="ra-accordion">
        <div className="ra-accordion-header" style={{ cursor: 'default' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Analyzing...</span>
          <div className="resume-uploading-spinner" style={{ width: 16, height: 16, border: '2px solid var(--border-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const dims = [
    { label: 'ATS', value: analysis.ats_compatibility },
    { label: 'Recruiter Scan', value: analysis.recruiter_scan },
    { label: 'Bullet Quality', value: analysis.bullet_quality },
    { label: 'Seniority', value: analysis.seniority_calibration },
    { label: 'Keywords', value: analysis.keyword_coverage },
    { label: 'Structure', value: analysis.structure_layout },
    { label: 'Concerns', value: analysis.concern_management },
    { label: 'Polish', value: analysis.consistency_polish },
  ];

  return (
    <div className="ra-accordion">
      <div className="ra-accordion-header" onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ra-accordion-chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
          <div className="ra-grade-circle" style={{ width: 32, height: 32, fontSize: 14, borderWidth: 2 }}>{analysis.overall_grade || '?'}</div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Resume Score</span>
          {!expanded && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {dims.filter(d => dimClass(d.value) === 'weak').length} issues
            </span>
          )}
        </div>
        <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); onReanalyze(); }}>Re-analyze</button>
      </div>

      {expanded && (
        <div className="ra-accordion-body">
          <div className="ra-dims">
            {dims.map((d) => (
              <div key={d.label} className="ra-dim">
                <span className="ra-dim-label">{d.label}</span>
                <span className={`ra-dim-value ${dimClass(d.value)}`}>{dimValue(d.value)}</span>
              </div>
            ))}
          </div>

          {analysis.top_fixes && analysis.top_fixes.length > 0 && (
            <>
              <div className="ra-fixes-title">Top Fixes</div>
              {analysis.top_fixes.map((fix, i) => (
                <div key={i} className="ra-fix">
                  <span className={`ra-fix-severity ${fix.severity || 'neutral'}`}>
                    {fix.severity === 'red' ? 'Fix' : fix.severity === 'amber' ? 'Improve' : 'Nice'}
                  </span>
                  <span className="ra-fix-text">{fix.text || fix.fix}</span>
                </div>
              ))}
            </>
          )}

          {analysis.story_seeds && analysis.story_seeds.length > 0 && (
            <>
              <div className="ra-seeds-title">Story Seeds</div>
              {analysis.story_seeds.map((seed, i) => (
                <div key={i} className="ra-seed">
                  <span className="ra-seed-text">{seed.title || seed.source_bullet}</span>
                  {addedSeeds.has(i) ? (
                    <span className="ra-seed-added">Added</span>
                  ) : (
                    <button
                      className="ra-seed-btn"
                      onClick={() => addToStorybank(seed, i)}
                      disabled={addingSeeds.has(i)}
                    >
                      {addingSeeds.has(i) ? 'Adding...' : 'Add as Story Seed'}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* -- Chat Panel -- */
function ChatPanel({ resumeId, suggestions }: { resumeId: string; suggestions: string[] }) {
  const { messages, isStreaming, sendMessage } = useResumeChat(resumeId);
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
    <div className="rc-chat-panel">
      <div className="rc-chat-header">
        <span style={{ fontWeight: 600, fontSize: 13 }}>Resume Coach</span>
      </div>

      <div className="rc-messages">
        {messages.length === 0 && (
          <div className="rc-empty">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>How can I help with your resume?</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              I can rewrite bullets, optimize for ATS, improve your summary, or address any of the analysis findings.
            </div>
            {suggestions.length > 0 && (
              <div className="rc-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="rc-suggestion-chip" onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`rc-msg rc-msg-${msg.role}`}>
            <div className="rc-msg-bubble">
              {msg.role === 'coach' ? renderMarkdown(msg.text) : msg.text}
              {msg.role === 'coach' && isStreaming && i === messages.length - 1 && <span className="rc-cursor" />}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="rc-input-area">
        {messages.length > 0 && suggestions.length > 0 && !isStreaming && (
          <div className="rc-suggestions" style={{ marginBottom: 8 }}>
            {suggestions.slice(0, 3).map((s, i) => (
              <button key={i} className="rc-suggestion-chip" onClick={() => handleSend(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="rc-input-row">
          <input
            className="rc-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask about your resume..."
            disabled={isStreaming}
          />
          <button className="rc-send-btn" onClick={() => handleSend()} disabled={isStreaming || !input.trim()}>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 10h12M12 4l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -- Builder Section -- */
function BuilderSection({ section, onSave }: { section: ResumeSection; onSave: (sectionId: string, content: Record<string, any>) => void }) {
  const { content, section_type } = section;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  function startEdit() {
    setDraft(content);
    setEditing(true);
  }

  function save() {
    onSave(section.id, draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(content);
    setEditing(false);
  }

  const editButtons = editing ? (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="rb-section-edit" style={{ color: 'var(--primary)' }} onClick={save}>save</button>
      <button className="rb-section-edit" onClick={cancel}>cancel</button>
    </div>
  ) : (
    <button className="rb-section-edit" onClick={startEdit}>edit</button>
  );

  if (section_type === 'summary') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Summary</span>
          {editButtons}
        </div>
        {editing ? (
          <textarea
            className="rb-edit-textarea"
            value={draft.text || ''}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            rows={4}
          />
        ) : (
          <p className="rb-text">{content.text}</p>
        )}
      </div>
    );
  }

  if (section_type === 'experience') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Experience</span>
          {editButtons}
        </div>
        {editing ? (
          <div className="rb-edit-fields">
            <input className="rb-edit-input" value={draft.company || ''} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Company" />
            <input className="rb-edit-input" value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="rb-edit-input" value={draft.start_date || ''} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} placeholder="Start date" style={{ flex: 1 }} />
              <input className="rb-edit-input" value={draft.end_date || ''} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} placeholder="End date" style={{ flex: 1 }} />
            </div>
            <input className="rb-edit-input" value={draft.location || ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Location" />
            <textarea
              className="rb-edit-textarea"
              value={(draft.bullets || []).join('\n')}
              onChange={(e) => setDraft({ ...draft, bullets: e.target.value.split('\n') })}
              rows={Math.max(3, (draft.bullets || []).length + 1)}
              placeholder="One bullet per line"
            />
          </div>
        ) : (
          <>
            <div className="rb-company">{content.company}</div>
            <div className="rb-title">{content.title}</div>
            <div className="rb-dates">
              {content.start_date} — {content.end_date || 'Present'}
              {content.location && ` · ${content.location}`}
            </div>
            {content.bullets && (
              <ul className="rb-bullets">
                {content.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  if (section_type === 'education') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Education</span>
          {editButtons}
        </div>
        {editing ? (
          <div className="rb-edit-fields">
            <input className="rb-edit-input" value={draft.institution || ''} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} placeholder="Institution" />
            <input className="rb-edit-input" value={draft.degree || ''} onChange={(e) => setDraft({ ...draft, degree: e.target.value })} placeholder="Degree" />
            <input className="rb-edit-input" value={draft.field || ''} onChange={(e) => setDraft({ ...draft, field: e.target.value })} placeholder="Field" />
            <input className="rb-edit-input" value={draft.graduation_date || ''} onChange={(e) => setDraft({ ...draft, graduation_date: e.target.value })} placeholder="Graduation date" />
          </div>
        ) : (
          <>
            <div className="rb-company">{content.institution}</div>
            <div className="rb-title">{content.degree}{content.field ? ` — ${content.field}` : ''}</div>
            {content.graduation_date && <div className="rb-dates">{content.graduation_date}</div>}
          </>
        )}
      </div>
    );
  }

  if (section_type === 'skills') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Skills</span>
          {editButtons}
        </div>
        {editing ? (
          <div className="rb-edit-fields">
            {(draft.categories || []).map((cat: { name: string; skills: string[] }, i: number) => (
              <div key={i}>
                <input className="rb-edit-input" value={cat.name} onChange={(e) => {
                  const cats = [...(draft.categories || [])];
                  cats[i] = { ...cats[i], name: e.target.value };
                  setDraft({ ...draft, categories: cats });
                }} placeholder="Category name" />
                <textarea
                  className="rb-edit-textarea"
                  value={cat.skills.join(', ')}
                  onChange={(e) => {
                    const cats = [...(draft.categories || [])];
                    cats[i] = { ...cats[i], skills: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) };
                    setDraft({ ...draft, categories: cats });
                  }}
                  rows={2}
                  placeholder="Comma-separated skills"
                />
              </div>
            ))}
          </div>
        ) : (
          content.categories?.map((cat: { name: string; skills: string[] }, i: number) => (
            <div key={i} className="rb-skills-group">
              <div className="rb-skills-label">{cat.name}</div>
              <div className="rb-skill-tags">
                {cat.skills.map((s: string) => <span key={s} className="rb-skill-tag">{s}</span>)}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (section_type === 'certifications') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Certifications</span>
          {editButtons}
        </div>
        {content.items?.map((c: { name: string; issuer: string; date: string }, i: number) => (
          <div key={i} className="rb-text">{c.name} — {c.issuer} ({c.date})</div>
        ))}
      </div>
    );
  }

  return null;
}

/* -- Main Page -- */
export function ResumePage() {
  const { resume, sections, analysis, isLoading, hasResume, upload, deleteResume, analyze, updateSection } = useResume();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx'))) {
      upload.mutate(file);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (isLoading) {
    return <div className="resume-page"><div className="resume-uploading"><div className="resume-uploading-inner"><div className="resume-uploading-spinner" /><div className="resume-uploading-text">Loading...</div></div></div></div>;
  }

  // Uploading state
  if (upload.isPending) {
    return (
      <div className="resume-page">
        <div className="resume-uploading">
          <div className="resume-uploading-inner">
            <div className="resume-uploading-spinner" />
            <div className="resume-uploading-text">Analyzing your resume...</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Parsing sections, running 8-dimension audit, and extracting story seeds.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no resume uploaded
  if (!hasResume) {
    return (
      <div className="resume-page">
        <div className="resume-header"><h1>Resume</h1></div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <div
          className={`resume-dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="resume-dropzone-inner">
            <UploadIcon />
            <div className="resume-dropzone-title">Upload your resume to get started</div>
            <div className="resume-dropzone-desc">
              Get an ATS compatibility audit, story seeds for your storybank, and a structured resume you can iterate on with your AI coach.
            </div>
            <button className="btn btn-primary">Upload Resume</button>
            <div className="resume-dropzone-hint">Accepts PDF and DOCX — or drag and drop</div>
          </div>
        </div>
      </div>
    );
  }

  // Build suggestion chips from analysis top_fixes
  const suggestions = (analysis?.top_fixes || [])
    .slice(0, 5)
    .map(fix => fix.text || fix.fix)
    .filter(Boolean)
    .map(text => `Help me fix: ${text.length > 60 ? text.slice(0, 57) + '...' : text}`);

  // Main state — split pane: left (analysis accordion + builder), right (chat)
  return (
    <div className="resume-page">
      <div className="resume-header">
        <h1>Resume</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12 }}
            onClick={() => inputRef.current?.click()}
          >
            Re-upload
          </button>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, color: '#c0392b', borderColor: '#c0392b' }}
            onClick={() => {
              if (resume && window.confirm('Delete this resume? This will remove all sections, analysis, and coaching history.')) {
                deleteResume.mutate(resume.id);
              }
            }}
            disabled={deleteResume.isPending}
          >
            {deleteResume.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="resume-split">
        {/* Left: Analysis accordion + Resume builder */}
        <div className="resume-builder-panel">
          <AnalysisAccordion
            analysis={analysis}
            onReanalyze={() => resume && analyze.mutate(resume.id)}
            isAnalyzing={analyze.isPending}
          />

          {sections.map((section) => (
            <BuilderSection key={section.id} section={section} onSave={(sectionId, content) => updateSection.mutate({ sectionId, content })} />
          ))}
          {sections.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              No sections parsed yet.
            </div>
          )}
        </div>

        {/* Right: Coach chat */}
        <div className="resume-chat-panel">
          {resume && <ChatPanel resumeId={resume.id} suggestions={suggestions} />}
        </div>
      </div>
    </div>
  );
}
