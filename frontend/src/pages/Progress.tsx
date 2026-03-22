import './pages.css';
import { useProgress } from '../hooks/useProgress';
import { ScoreTrendChart } from '../components/ScoreTrendChart';

type DimensionKey = 'substance' | 'structure' | 'relevance' | 'credibility' | 'differentiation';

const DIMENSIONS: { key: DimensionKey; label: string; color: string }[] = [
  { key: 'substance', label: 'Substance', color: 'var(--c-substance)' },
  { key: 'structure', label: 'Structure', color: 'var(--c-structure)' },
  { key: 'relevance', label: 'Relevance', color: 'var(--c-relevance)' },
  { key: 'credibility', label: 'Credibility', color: 'var(--c-credibility)' },
  { key: 'differentiation', label: 'Differentiation', color: 'var(--c-differentiation)' },
];

/** Convert a score (1-5) to a percentage width for progress bars */
function scoreToPercent(score: number): number {
  return (score / 5) * 100;
}

export function Progress() {
  const {
    scoreHistory,
    calibration,
    effectivePatterns,
    ineffectivePatterns,
    activeFilter,
    setFilter,
    isLoading,
  } = useProgress();

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">
          <svg className="icon" viewBox="0 0 18 18">
            <polyline points="2 14 6.5 9 10 11.5 16 4" />
            <polyline points="12.5 4 16 4 16 7.5" />
          </svg>
          {' '}Progress
        </h1>
        <p className="page-subtitle">Score trends, self-calibration, patterns, and coaching strategy.</p>
      </div>

      {/* Top row: 60/40 grid */}
      <div className="card-grid card-grid-60-40" style={{ marginBottom: 14 }}>
        {/* Score Trends card */}
        <div className="card">
          <ScoreTrendChart
            data={scoreHistory}
            filter={activeFilter}
            onFilterChange={setFilter}
          />
        </div>

        {/* Self-Calibration card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Self-Calibration</span>
          </div>
          <div className="card-body">
            {calibration && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'var(--c-differentiation)',
                    }}
                  >
                    {calibration.tendency}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginTop: 4,
                    }}
                  >
                    Your self-scores average {calibration.delta} points above coach scores
                  </div>
                </div>
                <div className="score-dims">
                  {DIMENSIONS.map((dim) => {
                    const score = calibration.latestScores[dim.key];
                    return (
                      <div className="score-dim" key={dim.key}>
                        <span className="score-dim-label">{dim.label}</span>
                        <div className="score-dim-bar">
                          <div
                            className="score-dim-fill"
                            style={{
                              width: `${scoreToPercent(score)}%`,
                              background: dim.color,
                            }}
                          />
                        </div>
                        <span className="score-dim-val">{score.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: 50/50 grid */}
      <div className="card-grid card-grid-2">
        {/* Effective Patterns */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: '#2eaa4a' }}>
              Effective Patterns
            </span>
          </div>
          <div className="card-body">
            {effectivePatterns.map((pattern, i) => (
              <div className="pattern-item" key={i}>
                <div className="pattern-label">Detected {pattern.detected}</div>
                <div className="pattern-text">{pattern.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ineffective Patterns */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--c-credibility)' }}>
              Ineffective Patterns
            </span>
          </div>
          <div className="card-body">
            {ineffectivePatterns.map((pattern, i) => (
              <div className="pattern-item" key={i}>
                <div className="pattern-label">Detected {pattern.detected}</div>
                <div className="pattern-text">{pattern.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
