import '../pages/pages.css';

interface ScorecardProps {
  scores: {
    substance: number;
    structure: number;
    relevance: number;
    credibility: number;
    differentiation: number;
  };
  hireSignal: string;
  feedback: string;
}

const DIMENSIONS: { key: keyof ScorecardProps['scores']; label: string; color: string }[] = [
  { key: 'substance', label: 'Substance', color: 'var(--c-substance)' },
  { key: 'structure', label: 'Structure', color: 'var(--c-structure)' },
  { key: 'relevance', label: 'Relevance', color: 'var(--c-relevance)' },
  { key: 'credibility', label: 'Credibility', color: 'var(--c-credibility)' },
  { key: 'differentiation', label: 'Differentiation', color: 'var(--c-differentiation)' },
];

export function Scorecard({ scores, hireSignal, feedback }: ScorecardProps) {
  return (
    <div className="scorecard">
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
      </div>
      <div>
        <div style={{ marginBottom: 12 }}>
          <span className="tag tag-green" style={{ fontSize: 13, fontWeight: 700 }}>
            {hireSignal}
          </span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {feedback}
        </p>
      </div>
    </div>
  );
}
