import { useState } from 'react';
import '../pages/pages.css';

interface SourceIndicatorProps {
  source: 'bank' | 'job_specific' | 'story_specific' | 'resume_gap';
  detail: string;
}

const SOURCE_COLORS: Record<string, string> = {
  bank: '#4A90D9',           // blue
  job_specific: '#27AE60',   // green
  story_specific: '#8E44AD', // purple
  resume_gap: '#E67E22',     // orange
};

export function SourceIndicator({ source, detail }: SourceIndicatorProps) {
  const [showDetail, setShowDetail] = useState(false);
  const color = SOURCE_COLORS[source] || '#999';

  return (
    <span className="source-indicator" onClick={() => setShowDetail(!showDetail)}>
      <span
        className="source-dot"
        style={{ background: color }}
        title={detail}
      />
      {showDetail && (
        <span className="source-detail" style={{ borderLeftColor: color }}>
          {detail}
        </span>
      )}
    </span>
  );
}
