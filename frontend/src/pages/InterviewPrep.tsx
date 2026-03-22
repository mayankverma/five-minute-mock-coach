import React from 'react';
import './pages.css';
import { usePrep, type PrepTab } from '../hooks/usePrep';

/* ── Inline SVG icons ── */

function ClipboardIcon({ className = 'icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function ShieldIcon({ className = 'icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function HelpIcon({ className = 'icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function MonitorIcon({ className = 'icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

/* ── Tab definitions ── */

const tabs: { id: PrepTab; label: string }[] = [
  { id: 'research', label: 'Research' },
  { id: 'decode', label: 'Decode' },
  { id: 'brief', label: 'Brief' },
  { id: 'concerns', label: 'Concerns' },
  { id: 'questions', label: 'Questions' },
  { id: 'present', label: 'Present' },
];

/* ── Sub-components for each tab ── */

function ResearchTab() {
  const { companyOverview, fitAssessment } = usePrep();

  if (!companyOverview && !fitAssessment) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No research yet</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
            Select a job workspace and run company research to see culture signals, interview process, and fit assessment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-grid card-grid-2">
      {/* Company Overview */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Company Overview</span>
        </div>
        <div className="card-body prep-section">
          <p>{companyOverview?.description || 'Not available'}</p>
          <h3>Culture Signals</h3>
          <ul className="prep-list">
            {(companyOverview?.cultureSignals || []).map((signal, i) => (
              <li key={i}>{signal}</li>
            ))}
          </ul>
          <h3>Interview Process</h3>
          <ul className="prep-list">
            {(companyOverview?.interviewProcess || []).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Fit Assessment */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Fit Assessment</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span className="tag tag-green" style={{ fontSize: 13, padding: '6px 14px' }}>
              {fitAssessment?.verdict || 'Not assessed'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fitAssessment?.confidence || ''}
            </span>
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Fit Signals</h3>
          <ul className="prep-list">
            {(fitAssessment?.fitSignals || []).map((signal, i) => (
              <li key={i}>{signal}</li>
            ))}
          </ul>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, marginTop: 12 }}>
            Structural Gaps
          </h3>
          <ul className="prep-list">
            {(fitAssessment?.structuralGaps || []).map((gap, i) => (
              <li key={i}>
                <span
                  className={`tag ${gap.severity === 'Frameable' ? 'tag-amber' : 'tag-neutral'}`}
                  style={{ fontSize: 10 }}
                >
                  {gap.severity}
                </span>{' '}
                {gap.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DecodeTab() {
  const { jdAnalysis } = usePrep();

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">JD Analysis</span>
      </div>
      <div className="card-body prep-section">
        <h3>Top 5 Competencies (Priority Order)</h3>
        <ul className="prep-list">
          {(jdAnalysis?.competencies || []).map((c) => (
            <li key={c.rank}>
              <strong>
                {c.rank}. {c.name}
              </strong>{' '}
              — {c.description}
            </li>
          ))}
        </ul>
        <h3>Story Coverage</h3>
        <ul className="prep-list">
          {(jdAnalysis?.storyCoverage || []).map((sc, i) => (
            <li key={i}>
              <span
                className={`tag ${sc.status === 'covered' ? 'tag-green' : 'tag-red'}`}
                style={{ fontSize: 10 }}
              >
                {sc.status === 'covered' ? 'Covered' : 'Gap'}
              </span>{' '}
              {sc.competency} — {sc.story}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BriefTab() {
  return (
    <div className="card">
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-state-icon">
            <ClipboardIcon />
          </div>
          <div className="empty-state-title">Prep Brief</div>
          <div className="empty-state-desc">
            Full prep brief with day-of cheat sheet, predicted questions, and story mapping.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }}>
            Generate Prep Brief
          </button>
        </div>
      </div>
    </div>
  );
}

function ConcernsTab() {
  const { concerns } = usePrep();

  const severityClass: Record<string, string> = {
    high: 'tag-red',
    med: 'tag-amber',
    low: 'tag-neutral',
  };

  const severityLabel: Record<string, string> = {
    high: 'High',
    med: 'Med',
    low: 'Low',
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <ShieldIcon /> Anticipated Concerns
        </span>
      </div>
      <div className="card-body">
        <ul className="prep-list">
          {concerns.map((c, i) => (
            <li key={i}>
              <span className={`concern-severity ${severityClass[c.severity]}`}>
                {severityLabel[c.severity]}
              </span>{' '}
              <span>
                <strong>{c.title}</strong> {c.counter}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuestionsTab() {
  const { questionsToAsk } = usePrep();

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <HelpIcon /> Questions to Ask
        </span>
      </div>
      <div className="card-body">
        <ul className="prep-list">
          {questionsToAsk.map((q, i) => (
            <li key={i}>
              <strong>{i + 1}.</strong> {q}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PresentTab() {
  return (
    <div className="card">
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-state-icon">
            <MonitorIcon />
          </div>
          <div className="empty-state-title">No Presentation Round</div>
          <div className="empty-state-desc">
            This interview loop doesn't include a presentation round. If one is added, prep tools
            will appear here.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page component ── */

export function InterviewPrep() {
  const { activeTab, setActiveTab, subtitle, isLoading } = usePrep();

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">
            <ClipboardIcon /> Interview Prep
          </h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  const tabContent: Record<PrepTab, React.ReactNode> = {
    research: <ResearchTab />,
    decode: <DecodeTab />,
    brief: <BriefTab />,
    concerns: <ConcernsTab />,
    questions: <QuestionsTab />,
    present: <PresentTab />,
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <ClipboardIcon /> Interview Prep
        </h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabContent[activeTab]}
    </div>
  );
}
