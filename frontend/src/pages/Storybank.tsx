import React, { useState, useEffect } from 'react';
import { useStories, type Story } from '../hooks/useStories';
import { useStoryGaps, type StoryGap } from '../hooks/useStoryGaps';
import { useNarrativeIdentity } from '../hooks/useNarrativeIdentity';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { StoryBuilder } from '../components/StoryBuilder';
import api from '../lib/api';
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
  const { stories, addStory, deleteStory, isLoading } = useStories();
  const { activeWorkspace } = useWorkspace();
  const { gapAnalysis } = useStoryGaps(activeWorkspace?.id);
  const { narrative } = useNarrativeIdentity(stories.length);
  const [showForm, setShowForm] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [gapContext, setGapContext] = useState<StoryGap | null>(null);
  const showBuilder = showForm || editingStory !== null;

  useEffect(() => {
    api.get('/api/materials/resume').then(({ data }) => {
      setHasResume(!!(data && data.id));
    }).catch(() => {});
  }, []);

  const storyCount = stories.length;
  const gapCount = gapAnalysis?.gaps?.length || 0;

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
              Your interview-ready STAR stories. {storyCount} stories built{gapCount > 0 ? `, ${gapCount} gaps identified` : ''}.
              {activeWorkspace ? ` Context: ${activeWorkspace.company_name}` : ''}
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
          storyId={editingStory?.fullId}
          storyCount={stories.length}
          hasResume={hasResume}
          gapContext={gapContext ? { competency: gapContext.competency, recommendation: gapContext.recommendation } : undefined}
          onSave={(data) => {
            addStory(data);
            setShowForm(false);
            setEditingStory(null);
            setGapContext(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingStory(null);
            setGapContext(null);
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
                    {activeWorkspace && <th>Fit</th>}
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
                        {activeWorkspace && gapAnalysis?.mapped_stories && (
                          <td>
                            {(() => {
                              const fits = gapAnalysis.mapped_stories.filter(
                                m => m.title?.toLowerCase().includes(s.title.toLowerCase().slice(0, 20)) || m.story_id === s.fullId
                              );
                              const best = fits.find(f => f.fit_level === 'strong') || fits.find(f => f.fit_level === 'workable') || fits[0];
                              if (!best) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>;
                              const colors = { strong: { bg: '#dcfce7', text: '#166534' }, workable: { bg: '#fef3c7', text: '#92400e' }, stretch: { bg: '#f3f4f6', text: '#6b7280' } };
                              const c = colors[best.fit_level] || colors.stretch;
                              return (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: c.bg, color: c.text }}>
                                  {best.fit_level.charAt(0).toUpperCase() + best.fit_level.slice(1)}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        <td>{s.uses}</td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {expandedId === s.fullId ? '▲' : '▼'}
                          </span>
                        </td>
                      </tr>
                      {expandedId === s.fullId && (
                        <tr>
                          <td colSpan={activeWorkspace ? 7 : 6} style={{ padding: '16px 20px', background: 'var(--bg-muted, #f9f8f6)' }}>
                            {s.deployFor && (
                              <div style={{ fontSize: 13, marginBottom: 12 }}>
                                <strong>Use this story when asked about:</strong>
                                <ul style={{ color: 'var(--text-secondary)', margin: '6px 0 0', paddingLeft: 20, listStyle: 'disc' }}>
                                  {s.deployFor.split(';').map((item, i) => {
                                    const text = item.trim();
                                    return <li key={i} style={{ marginBottom: 3 }}>{text.charAt(0).toUpperCase() + text.slice(1)}</li>;
                                  })}
                                </ul>
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
                              <div style={{ fontSize: 13, marginTop: 12, padding: '12px 14px', background: 'var(--bg-card, #fff)', borderRadius: 8, border: '1px solid var(--border-light, #e8e5df)' }}>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 15 }}>&#128161;</span> Earned Secret
                                </strong>
                                <p style={{ color: 'var(--text-secondary)', margin: '6px 0 4px', lineHeight: 1.6 }}>{s.earnedSecret}</p>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 11, fontStyle: 'italic' }}>
                                  This is the unique insight only you learned from this experience. Weave it into your answer to stand out from other candidates.
                                </p>
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

          {/* ── Gap Analysis ── */}
          {gapAnalysis && gapAnalysis.gaps.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title"><SearchIcon /> {gapAnalysis.mode === 'workspace' ? 'Gaps for This Role' : 'Story Coverage'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Coverage: {gapAnalysis.coverage_score}/10
                </span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <tbody>
                    {gapAnalysis.gaps.map((gap, i) => (
                      <tr key={i}>
                        <td style={{ width: 90 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            padding: '2px 6px', borderRadius: 4,
                            background: gap.severity === 'critical' ? '#fee2e2' : gap.severity === 'important' ? '#fef3c7' : '#f3f4f6',
                            color: gap.severity === 'critical' ? '#991b1b' : gap.severity === 'important' ? '#92400e' : '#6b7280',
                          }}>
                            {gap.severity === 'critical' ? 'Critical' : gap.severity === 'important' ? 'Important' : 'Nice to have'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {gap.competency.charAt(0).toUpperCase() + gap.competency.slice(1)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {gap.recommendation}
                          </div>
                        </td>
                        <td style={{ width: 120, textAlign: 'right' }}>
                          {gap.handling_pattern === 'reframe_existing' && gap.closest_story ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                const match = stories.find(s => s.fullId === gap.closest_story?.id);
                                if (match) {
                                  setGapContext(gap);
                                  setEditingStory(match);
                                }
                              }}
                            >
                              Reframe
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setGapContext(gap);
                                setShowForm(true);
                              }}
                            >
                              Build Story
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!activeWorkspace && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-muted)' }}>
                  Add a target job to see which gaps matter most for you
                </div>
              )}
            </div>
          )}

          {/* ── Narrative Identity ── */}
          {narrative && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-header">
                <span className="card-title"><CompassIcon /> Narrative Identity</span>
              </div>
              <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
                {narrative.core_themes?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>Core themes:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                      {narrative.core_themes.map((t, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          <strong>{t.theme}</strong>
                          <span style={{ color: 'var(--text-secondary)' }}> — {t.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {narrative.sharpest_edge && (
                  <div style={{ padding: '10px 14px', background: 'var(--primary-lighter)', borderRadius: 8, marginBottom: 12 }}>
                    <strong>Sharpest edge:</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{narrative.sharpest_edge}</p>
                  </div>
                )}
                {narrative.orphan_stories?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {narrative.orphan_stories.map((o, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Orphan: "{o.title}" — {o.suggestion}
                      </div>
                    ))}
                  </div>
                )}
                {narrative.how_to_use && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
                    {narrative.how_to_use}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
