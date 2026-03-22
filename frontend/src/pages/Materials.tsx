import { useSearchParams } from 'react-router-dom';
import { useMaterials } from '../hooks/useMaterials';
import type { MaterialTab } from '../hooks/useMaterials';
import { ResumeUpload } from '../components/ResumeUpload';
import './pages.css';

/* ── Inline SVG icons ── */

function DocIcon() {
  return (
    <svg
      className="icon"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 2h6.5l4 4v9.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 15.5v-12A1.5 1.5 0 0 1 4.5 2z" />
      <polyline points="11 2 11 6 15 6" />
      <line x1="6" y1="9.5" x2="12" y2="9.5" />
      <line x1="6" y1="12.5" x2="10" y2="12.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 24, height: 24 }}
    >
      <path d="M7.5 10.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" />
      <path d="M10.5 7.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 24, height: 24 }}
    >
      <line x1="16" y1="2" x2="8" y2="10" />
      <polygon points="16 2 11 16 8 10 2 7" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 24, height: 24 }}
    >
      <line x1="9" y1="1" x2="9" y2="17" />
      <path d="M13 5c-1-1.5-2.5-2-4-2s-4 .8-4 3c0 4.5 8 2 8 6.5 0 2-2 3-4 3s-3.5-1-4.5-2.5" />
    </svg>
  );
}

/* ── Tab definitions ── */

const TABS: { key: MaterialTab; label: string }[] = [
  { key: 'resume', label: 'Resume' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'salary', label: 'Salary' },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.key));

function getInitialTab(searchParams: URLSearchParams): MaterialTab {
  const tab = searchParams.get('tab');
  if (tab && VALID_TABS.has(tab)) {
    return tab as MaterialTab;
  }
  return 'resume';
}

/* ── Severity tag helper ── */

function severityLabel(severity: 'red' | 'amber' | 'neutral') {
  switch (severity) {
    case 'red':
      return 'Fix';
    case 'amber':
      return 'Improve';
    case 'neutral':
      return 'Nice';
  }
}

/* ── Page component ── */

export function Materials() {
  const [searchParams] = useSearchParams();
  const initialTab = getInitialTab(searchParams);
  const { activeTab, setActiveTab, resume, pitch, isLoading } = useMaterials(initialTab);

  if (isLoading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading materials...</div>
    );
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <h1 className="page-title">
          <DocIcon /> Materials
        </h1>
        <p className="page-subtitle">
          Your application materials &mdash; resume, LinkedIn, pitch, and outreach.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Resume tab ── */}
      {activeTab === 'resume' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Resume Optimization</span>
            <ResumeUpload onUpload={(file) => console.log('Resume uploaded:', file.name)} />
          </div>
          <div className="card-body">
            {!resume ? (
              <div style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No resume analyzed yet</div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload your resume to get an ATS compatibility audit, bullet quality analysis, and optimization recommendations.</p>
              </div>
            ) : (
              <>
                <div className="material-score">
                  <div className="material-score-circle">{resume.grade}</div>
                  <div className="material-dims">
                    <div className="material-dim"><strong>ATS:</strong> {resume.dimensions.ats}</div>
                    <div className="material-dim"><strong>Recruiter Scan:</strong> {resume.dimensions.recruiterScan}</div>
                    <div className="material-dim"><strong>Bullet Quality:</strong> {resume.dimensions.bulletQuality}</div>
                    <div className="material-dim"><strong>Seniority:</strong> {resume.dimensions.seniority}</div>
                    <div className="material-dim"><strong>Keywords:</strong> {resume.dimensions.keywords}</div>
                  </div>
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Top Fixes</h3>
                <ul className="prep-list">
                  {resume.topFixes.map((fix, i) => (
                    <li key={i}>
                      <span className={`tag tag-${fix.severity}`} style={{ fontSize: 10 }}>{severityLabel(fix.severity)}</span>
                      {fix.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── LinkedIn tab ── */}
      {activeTab === 'linkedin' && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">
                <LinkIcon />
              </div>
              <div className="empty-state-title">LinkedIn Audit</div>
              <div className="empty-state-desc">
                Paste your LinkedIn profile URL to get a section-by-section optimization audit.
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }}>
                Start Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pitch tab ── */}
      {activeTab === 'pitch' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Positioning Statement</span>
          </div>
          <div className="card-body prep-section">
            {!pitch ? (
              <div style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No positioning statement yet</div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Generate your core "tell me about yourself" answer — a 10-second hook and 30-second full statement.</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }}>Generate Pitch</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 4 }}>10-Second Hook</div>
                <p style={{ fontFamily: 'var(--ff-display)', fontSize: 18, lineHeight: 1.5, marginBottom: 16 }}>{pitch.hook10s}</p>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 4 }}>Full Statement (30s)</div>
                <p>{pitch.fullStatement}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Outreach tab ── */}
      {activeTab === 'outreach' && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">
                <SendIcon />
              </div>
              <div className="empty-state-title">Outreach Coaching</div>
              <div className="empty-state-desc">
                Get help crafting cold outreach, warm intros, informational interview asks, and
                recruiter replies.
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }}>
                Start Coaching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Salary tab ── */}
      {activeTab === 'salary' && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">
                <DollarIcon />
              </div>
              <div className="empty-state-title">Comp Strategy</div>
              <div className="empty-state-desc">
                Prepare for salary questions before they come up. Get scripts, range research, and
                negotiation frameworks.
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }}>
                Build Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
