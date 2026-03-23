import React, { useState } from 'react';
import { useStories, type Story } from '../hooks/useStories';
import { StoryBuilder } from '../components/StoryBuilder';
import './pages.css';

/* ── Inline SVG icons (from reference HTML symbol defs) ── */

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
    >
      <path d="M2 3.5h5a2 2 0 0 1 2 2v10l-2.5-1.5L4 15.5v-10a2 2 0 0 0-2-2z" />
      <path d="M16 3.5h-5a2 2 0 0 0-2 2v10l2.5-1.5L14 15.5v-10a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 18 18"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
      style={{ width: 14, height: 14 }}
    >
      <line x1="9" y1="3" x2="9" y2="15" />
      <line x1="3" y1="9" x2="15" y2="9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
    >
      <circle cx="7.5" cy="7.5" r="4.5" />
      <line x1="11" y1="11" x2="15.5" y2="15.5" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
    >
      <circle cx="9" cy="9" r="7" />
      <polygon points="11.5 6.5 7 7 6.5 11.5 11 11" />
    </svg>
  );
}

/* ── Strength dot bar ── */

function StrengthBar({ value }: { value: number }) {
  return (
    <div className="strength-bar">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`str-dot${n <= value ? ' filled' : ''}`} />
      ))}
    </div>
  );
}

/* ── Page component ── */

export function Storybank() {
  const { stories, gaps, narrativeIdentity, addStory, deleteStory, isLoading } = useStories();
  const [showForm, setShowForm] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const showBuilder = showForm || editingStory !== null;

  const storyCount = stories.length;
  const gapCount = gaps.length;

  if (isLoading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading stories...</div>
    );
  }

  return (
    <div>
      {/* ── Header row (hidden when builder is open) ── */}
      {!showBuilder && (
        <div
          className="page-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <h1 className="page-title">
              <BookIcon /> Storybank
            </h1>
            <p className="page-subtitle">
              Your interview-ready STAR stories. {storyCount} stories built, {gapCount} gaps
              identified.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            <PlusIcon /> Add Story
          </button>
        </div>
      )}

      {/* ── Story builder (split-pane chat + card) ── */}
      {showBuilder && (
        <>
        <button
          className="btn btn-outline btn-sm"
          style={{ marginBottom: 10 }}
          onClick={() => { setShowForm(false); setEditingStory(null); }}
        >
          &larr; Back to Stories
        </button>
        <StoryBuilder
          initial={editingStory ? {
            title: editingStory.title,
            situation: editingStory.situation,
            task: editingStory.task,
            action: editingStory.action,
            result: editingStory.result,
            primarySkill: editingStory.primarySkill,
            secondarySkill: editingStory.secondarySkill,
            earnedSecret: editingStory.earnedSecret,
            strength: editingStory.strength,
            domain: editingStory.domain,
            deployFor: editingStory.deployFor,
          } : undefined}
          onSave={(data) => {
            addStory(data);
            setShowForm(false);
            setEditingStory(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingStory(null);
          }}
          onDelete={editingStory ? () => {
            deleteStory(editingStory.fullId);
            setEditingStory(null);
          } : undefined}
        />
        </>
      )}

      {/* ── Story table or empty state (hidden when builder is open) ── */}
      {showBuilder ? null : stories.length === 0 ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              <BookIcon />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No stories yet</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
              Stories are the foundation of great interview answers. Click "Add Story" to build your first STAR story from your experience.
            </p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <PlusIcon /> Add Your First Story
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Updated</th>
                    <th>Title</th>
                    <th>Primary Skill</th>
                    <th>Strength</th>
                    <th>Uses</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stories.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedId(expandedId === s.fullId ? null : s.fullId)}
                      >
                        <td><span className="story-date">{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '—'}</span></td>
                        <td><span className="story-title">{s.title}</span></td>
                        <td>{s.primarySkill}</td>
                        <td><StrengthBar value={s.strength} /></td>
                        <td>{s.uses}</td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {expandedId === s.fullId ? '▲' : '▼'}
                          </span>
                        </td>
                      </tr>
                      {expandedId === s.fullId && (
                        <tr>
                          <td colSpan={6} style={{ padding: '16px 20px', background: 'var(--bg-muted, #f9f8f6)' }}>
                            {s.deployFor && (
                              <div style={{ fontSize: 13, marginBottom: 12 }}>
                                <strong>Deploy For</strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>{s.deployFor}</p>
                              </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, lineHeight: 1.6 }}>
                              <div>
                                <strong>Situation</strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{s.situation || '—'}</p>
                                <strong>Task</strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{s.task || '—'}</p>
                              </div>
                              <div>
                                <strong>Action</strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{s.action || '—'}</p>
                                <strong>Result</strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{s.result || '—'}</p>
                              </div>
                            </div>
                            {s.earnedSecret && (
                              <div style={{ fontSize: 13, marginTop: 4 }}>
                                <strong>Earned Secret</strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>{s.earnedSecret}</p>
                              </div>
                            )}
                            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                              <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setEditingStory(s); }}>
                                Improve with Coach
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ color: 'var(--text-danger, #c53030)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Delete this story? This cannot be undone.')) {
                                    deleteStory(s.fullId);
                                    setExpandedId(null);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Gap Analysis + Narrative Identity (only show when stories exist) ── */}
          {gaps.length > 0 && (
            <div className="card-grid card-grid-2">
              <div className="card">
                <div className="card-header"><span className="card-title"><SearchIcon /> Gap Analysis</span></div>
                <div className="card-body">
                  <div className="prep-list">
                    {gaps.map((gap, i) => (
                      <li key={i}>
                        <span className={`tag ${gap.severity === 'missing' ? 'tag-red' : 'tag-amber'}`} style={{ fontSize: 10 }}>
                          {gap.severity === 'missing' ? 'Missing' : 'Weak'}
                        </span>{' '}
                        {gap.description}
                      </li>
                    ))}
                  </div>
                </div>
              </div>
              {narrativeIdentity && (
                <div className="card">
                  <div className="card-header"><span className="card-title"><CompassIcon /> Narrative Identity</span></div>
                  <div className="card-body">
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      <strong>Core themes:</strong> {narrativeIdentity}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
