import type { ScoreHistoryPoint } from '../hooks/useProgress';

interface ScoreTrendChartProps {
  data: ScoreHistoryPoint[];
  filter: string;
  onFilterChange: (filter: string) => void;
}

type DimensionKey = 'substance' | 'structure' | 'relevance' | 'credibility' | 'differentiation';

const DIMENSIONS: { key: DimensionKey; label: string; color: string; dashed?: boolean }[] = [
  { key: 'substance', label: 'Substance', color: 'var(--c-substance)' },
  { key: 'structure', label: 'Structure', color: 'var(--c-structure)' },
  { key: 'relevance', label: 'Relevance', color: 'var(--c-relevance)' },
  { key: 'credibility', label: 'Credibility', color: 'var(--c-credibility)' },
  { key: 'differentiation', label: 'Differentiation', color: 'var(--c-differentiation)', dashed: true },
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'google', label: 'Google' },
  { value: 'practice', label: 'Practice' },
];

/** Map a score (1-5) to an SVG Y coordinate within viewBox 0-180 */
function scoreToY(score: number): number {
  return 180 - ((score - 1) / 4) * 140 - 20;
}

/** Spread N points evenly from x=30 to x=370 */
function indexToX(index: number, total: number): number {
  if (total <= 1) return 200;
  return 30 + (index / (total - 1)) * 340;
}

function buildPolyline(data: ScoreHistoryPoint[], dimension: DimensionKey): string {
  return data
    .map((point, i) => {
      const x = Math.round(indexToX(i, data.length));
      const y = Math.round(scoreToY(point[dimension]));
      return `${x},${y}`;
    })
    .join(' ');
}

export function ScoreTrendChart({ data, filter, onFilterChange }: ScoreTrendChartProps) {
  return (
    <>
      {/* Filter chips */}
      <div className="card-header">
        <span className="card-title">Score Trends</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map((f) => (
            <span
              key={f.value}
              className={`tag ${filter === f.value ? 'tag-primary' : 'tag-neutral'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onFilterChange(f.value)}
            >
              {f.label}
            </span>
          ))}
        </div>
      </div>

      <div className="card-body">
        {/* SVG Chart */}
        <svg viewBox="0 0 380 180" style={{ width: '100%' }}>
          {/* Horizontal grid lines */}
          {[20, 60, 100, 140].map((y) => (
            <line
              key={y}
              x1={25}
              y1={y}
              x2={370}
              y2={y}
              stroke="var(--border-light)"
              strokeWidth={0.5}
            />
          ))}

          {/* Y-axis labels */}
          {[
            { y: 24, label: '5' },
            { y: 64, label: '4' },
            { y: 104, label: '3' },
            { y: 144, label: '2' },
          ].map((item) => (
            <text
              key={item.label}
              x={14}
              y={item.y}
              fontSize={9}
              fill="var(--text-muted)"
              textAnchor="end"
              fontFamily="var(--ff-body)"
            >
              {item.label}
            </text>
          ))}

          {/* Dimension polylines */}
          {data.length > 0 &&
            DIMENSIONS.map((dim) => (
              <polyline
                key={dim.key}
                points={buildPolyline(data, dim.key)}
                fill="none"
                stroke={dim.color}
                strokeWidth={2}
                strokeDasharray={dim.dashed ? '4 3' : undefined}
              />
            ))}

          {/* End dots for each dimension */}
          {data.length > 0 &&
            DIMENSIONS.map((dim) => {
              const lastIndex = data.length - 1;
              const lastPoint = data[lastIndex];
              const cx = Math.round(indexToX(lastIndex, data.length));
              const cy = Math.round(scoreToY(lastPoint[dim.key]));
              return (
                <circle
                  key={`dot-${dim.key}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={dim.color}
                />
              );
            })}
        </svg>

        {/* Legend */}
        <div className="chart-legend">
          {DIMENSIONS.map((dim) => (
            <span key={dim.key} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: dim.color }} />
              {' '}{dim.label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
