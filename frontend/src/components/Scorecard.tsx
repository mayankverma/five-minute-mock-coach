import { useState } from 'react';
import '../pages/pages.css';

interface ScorecardProps {
  scores: {
    substance: number;
    structure: number;
    relevance: number;
    credibility: number;
    differentiation: number;
    presence?: number | null;
  };
  hireSignal: string;
  feedback: string;
  coachingBullets?: string[];
  exemplarAnswer?: string | null;
  microDrill?: string | null;
  attempts?: { attemptNumber: number; average: number }[];
}

const DIMENSIONS: { key: keyof Omit<ScorecardProps['scores'], 'presence'>; label: string; color: string }[] = [
  { key: 'substance', label: 'Substance', color: 'var(--c-substance)' },
  { key: 'structure', label: 'Structure', color: 'var(--c-structure)' },
  { key: 'relevance', label: 'Relevance', color: 'var(--c-relevance)' },
  { key: 'credibility', label: 'Credibility', color: 'var(--c-credibility)' },
  { key: 'differentiation', label: 'Differentiation', color: 'var(--c-differentiation)' },
];

type ActiveTab = 'coaching' | 'exemplar' | 'drill';

export function Scorecard({
  scores,
  hireSignal,
  feedback,
  coachingBullets,
  exemplarAnswer,
  microDrill,
  attempts,
}: ScorecardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('coaching');

  const coreScores = [
    scores.substance,
    scores.structure,
    scores.relevance,
    scores.credibility,
    scores.differentiation,
  ];
  const average = coreScores.reduce((sum, s) => sum + s, 0) / coreScores.length;

  const hasCoaching = coachingBullets && coachingBullets.length > 0;
  const hasExemplar = Boolean(exemplarAnswer);
  const hasDrill = Boolean(microDrill);
  const hasPresence = scores.presence != null;
  const showAttempts = attempts && attempts.length > 1;

  return (
    <div className="scorecard" style={{ display: 'block' }}>
      {showAttempts && (
        <div className="scorecard-attempts">
          {attempts!.map((a, i) => (
            <span key={a.attemptNumber}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> → </span>}
              <span>Attempt {a.attemptNumber}: {a.average.toFixed(1)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="scorecard-condensed">
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div className="scorecard-avg">{average.toFixed(1)}</div>
          <div className="scorecard-avg-label">/ 5</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>
            <span className="tag tag-green" style={{ fontSize: 13, fontWeight: 700 }}>
              {hireSignal}
            </span>
          </div>
          <p className="scorecard-feedback">{feedback}</p>
        </div>
      </div>

      <button
        className="scorecard-expand-btn"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {expanded ? 'Hide breakdown' : 'See full breakdown'}
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div className="score-dims">
            {DIMENSIONS.map((dim) => {
              const value = scores[dim.key];
              const widthPercent = (value / 5) * 100;
              return (
                <div className="score-dim" key={dim.key}>
                  <span className="score-dim-label">{dim.label}</span>
                  <div className="score-dim-bar">
                    <div
                      className="score-dim-fill"
                      style={{ width: `${widthPercent}%`, background: dim.color }}
                    />
                  </div>
                  <span className="score-dim-val">{value.toFixed(1)}</span>
                </div>
              );
            })}

            {hasPresence && (
              <div className="score-dim">
                <span className="score-dim-label">Presence</span>
                <div className="score-dim-bar">
                  <div
                    className="score-dim-fill"
                    style={{
                      width: `${(scores.presence! / 5) * 100}%`,
                      background: 'var(--primary)',
                    }}
                  />
                </div>
                <span className="score-dim-val">{scores.presence!.toFixed(1)}</span>
              </div>
            )}
          </div>

          {(hasCoaching || hasExemplar || hasDrill) && (
            <>
              <div className="scorecard-tabs">
                {hasCoaching && (
                  <button
                    className={`scorecard-tab${activeTab === 'coaching' ? ' active' : ''}`}
                    onClick={() => setActiveTab('coaching')}
                  >
                    Coaching Notes
                  </button>
                )}
                {hasExemplar && (
                  <button
                    className={`scorecard-tab${activeTab === 'exemplar' ? ' active' : ''}`}
                    onClick={() => setActiveTab('exemplar')}
                  >
                    Exemplar Answer
                  </button>
                )}
                {hasDrill && (
                  <button
                    className={`scorecard-tab${activeTab === 'drill' ? ' active' : ''}`}
                    onClick={() => setActiveTab('drill')}
                  >
                    Quick Drill
                  </button>
                )}
              </div>

              <div className="scorecard-tab-panel">
                {activeTab === 'coaching' && hasCoaching && (
                  <ul className="scorecard-bullets">
                    {coachingBullets!.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {activeTab === 'exemplar' && hasExemplar && (
                  <p style={{ margin: 0 }}>{exemplarAnswer}</p>
                )}
                {activeTab === 'drill' && hasDrill && (
                  <p style={{ margin: 0 }}>{microDrill}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
