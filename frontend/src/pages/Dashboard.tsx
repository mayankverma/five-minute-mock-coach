import { useWorkspace } from '../contexts/WorkspaceContext';
import { useDashboard } from '../hooks/useDashboard';
import type { KanbanWorkspace, ScorePoint } from '../hooks/useDashboard';
import './pages.css';

/* ── SVG Icon helpers (inline, no icon library) ── */

function IconGrid() {
  return (
    <svg className="icon" viewBox="0 0 18 18">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="10.5" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="2" y="10.5" width="5.5" height="5.5" rx="1" />
      <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg className="icon" viewBox="0 0 18 18">
      <path d="M2 3.5h5a2 2 0 0 1 2 2v10l-2.5-1.5L4 15.5v-10a2 2 0 0 0-2-2z" />
      <path d="M16 3.5h-5a2 2 0 0 0-2 2v10l2.5-1.5L14 15.5v-10a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg className="icon" viewBox="0 0 18 18">
      <polyline points="2 14 6.5 9 10 11.5 16 4" />
      <polyline points="12.5 4 16 4 16 7.5" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg className="icon" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" />
      <polygon points="11.5 6.5 7 7 6.5 11.5 11 11" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg className="icon" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" />
      <circle cx="9" cy="9" r="4" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="icon" viewBox="0 0 18 18">
      <rect x="3" y="3" width="12" height="14" rx="1.5" />
      <path d="M7 1h4v3H7z" />
      <line x1="6" y1="8" x2="12" y2="8" />
      <line x1="6" y1="11" x2="10" y2="11" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 18 18">
      <polyline points="4 9 7.5 12.5 14 5.5" />
    </svg>
  );
}

/* ── Strength dots ── */

function StrengthBar({ value }: { value: number }) {
  return (
    <div className="strength-bar">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`str-dot${i <= value ? ' filled' : ''}`} />
      ))}
    </div>
  );
}

/* ── Score Chart (SVG) ── */

function ScoreChart({ scores }: { scores: ScorePoint[] }) {
  if (scores.length === 0) return null;

  // Chart dimensions matching the reference: viewBox 0 0 380 180
  const xStart = 30;
  const xEnd = 370;
  const yTop = 20;   // score = 5
  const yBottom = 140; // score = 2

  const xStep = scores.length > 1 ? (xEnd - xStart) / (scores.length - 1) : 0;

  function scoreToY(score: number): number {
    // Map score 2..5 to yBottom..yTop
    return yBottom - ((score - 2) / 3) * (yBottom - yTop);
  }

  function makePoints(key: keyof Omit<ScorePoint, 'session'>): string {
    return scores.map((s, i) => `${xStart + i * xStep},${scoreToY(s[key])}`).join(' ');
  }

  const dimensions: { key: keyof Omit<ScorePoint, 'session'>; color: string; label: string; dashed?: boolean }[] = [
    { key: 'substance', color: 'var(--c-substance)', label: 'Sub' },
    { key: 'structure', color: 'var(--c-structure)', label: 'Str' },
    { key: 'relevance', color: 'var(--c-relevance)', label: 'Rel' },
    { key: 'credibility', color: 'var(--c-credibility)', label: 'Cred' },
    { key: 'differentiation', color: 'var(--c-differentiation)', label: 'Diff', dashed: true },
  ];

  const lastScore = scores[scores.length - 1];

  return (
    <>
      <svg viewBox="0 0 380 180" style={{ width: '100%' }}>
        {/* Grid lines */}
        {[20, 60, 100, 140].map((y) => (
          <line key={y} x1="25" y1={y} x2="370" y2={y} stroke="var(--border-light)" strokeWidth="0.5" />
        ))}
        {/* Y-axis labels */}
        <text x="14" y="24" fontSize="9" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--ff-body)">5</text>
        <text x="14" y="64" fontSize="9" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--ff-body)">4</text>
        <text x="14" y="104" fontSize="9" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--ff-body)">3</text>
        <text x="14" y="144" fontSize="9" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--ff-body)">2</text>

        {/* Polylines for each dimension */}
        {dimensions.map((dim) => (
          <polyline
            key={dim.key}
            points={makePoints(dim.key)}
            fill="none"
            stroke={dim.color}
            strokeWidth="2"
            strokeDasharray={dim.dashed ? '4 3' : undefined}
          />
        ))}

        {/* End-point circles */}
        {dimensions.map((dim) => (
          <circle
            key={dim.key}
            cx={xEnd}
            cy={scoreToY(lastScore[dim.key])}
            r="3"
            fill={dim.color}
          />
        ))}
      </svg>

      <div className="chart-legend">
        {dimensions.map((dim) => (
          <span key={dim.key} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: dim.color }} />
            {dim.label}
          </span>
        ))}
      </div>
    </>
  );
}

/* ── Kanban Board ── */

type KanbanStage = 'researched' | 'applied' | 'interviewing' | 'offer';

const kanbanColumns: { stage: KanbanStage; label: string }[] = [
  { stage: 'researched', label: 'Researched' },
  { stage: 'applied', label: 'Applied' },
  { stage: 'interviewing', label: 'Interviewing' },
  { stage: 'offer', label: 'Offer' },
];

function KanbanBoard({ workspaces }: { workspaces: KanbanWorkspace[] }) {
  return (
    <div className="kanban">
      {kanbanColumns.map((col) => {
        const cards = workspaces.filter((ws) => ws.stage === col.stage);
        return (
          <div key={col.stage} className={`kc-${col.stage}`}>
            <div className="kanban-col-header">
              {col.label} <span className="cnt">{cards.length}</span>
            </div>
            {cards.length === 0 ? (
              <div className="kanban-empty">None</div>
            ) : (
              cards.map((card) => (
                <div key={card.company} className="k-card">
                  <div className="k-card-co">{card.company}</div>
                  <div className="k-card-role">{card.role}</div>
                  <span
                    className="k-card-tag"
                    style={{ background: card.tagBg, color: card.tagColor }}
                  >
                    {card.status}
                  </span>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Drill Stepper ── */

function DrillStepper({ currentStage, stages }: { currentStage: number; stages: string[] }) {
  return (
    <div className="stepper">
      {stages.map((label, i) => {
        const stageNum = i + 1;
        let className = 'step';
        if (stageNum < currentStage) className += ' done';
        else if (stageNum === currentStage) className += ' active';
        return (
          <div key={label} className={className}>
            <div className="step-dot">{stageNum}</div>
            <div className="step-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── General Dashboard View ── */

function GeneralDashboard() {
  const { profile, stories, scores, workspaces, drillProgression, coachingStrategy, isLoading } = useDashboard();

  if (isLoading || !profile) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title"><IconGrid /> Dashboard</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><IconGrid /> Dashboard</h1>
        <p className="page-subtitle">Welcome back, {profile.name.split(' ')[0]}. Here's your coaching overview.</p>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body">
          <div className="profile-row">
            <div className="profile-avatar">{profile.initials}</div>
            <div>
              <div className="profile-name">{profile.name}</div>
              <div className="profile-role">{profile.role}</div>
            </div>
            <div className="profile-tags">
              {profile.tags.map((tag) => (
                <span key={tag.label} className={`tag ${tag.variant}`}>{tag.label}</span>
              ))}
            </div>
          </div>
          <div className="stat-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
            <div className="stat"><strong>Track:</strong> {profile.track}</div>
            <div className="stat"><strong>Timeline:</strong> {profile.timeline}</div>
            <div className="stat"><strong>Mode:</strong> {profile.mode}</div>
            <div className="stat"><strong>Concern:</strong> {profile.concern}</div>
          </div>
        </div>
      </div>

      {/* Storybank + Score Chart */}
      <div className="card-grid card-grid-60-40" style={{ marginBottom: 14 }}>
        {/* Storybank Summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconBook /> Storybank</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stories.length} stories</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Skill</th>
                  <th>Strength</th>
                  <th>Uses</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((story) => (
                  <tr key={story.id}>
                    <td><span className="story-id">{story.id}</span></td>
                    <td><span className="story-title">{story.title}</span></td>
                    <td>{story.primarySkill}</td>
                    <td><StrengthBar value={story.strength} /></td>
                    <td>{story.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Score History Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconTrending /> Score History</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{scores.length} sessions</span>
          </div>
          <div className="card-body">
            <ScoreChart scores={scores} />
          </div>
        </div>
      </div>

      {/* Kanban + Drill Progression */}
      <div className="card-grid card-grid-60-40" style={{ marginBottom: 14 }}>
        {/* Interview Loops Kanban */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconCompass /> Interview Loops</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{workspaces.length} active</span>
          </div>
          <div className="card-body">
            <KanbanBoard workspaces={workspaces} />
          </div>
        </div>

        {/* Drill Progression */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconTarget /> Drill Progression</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Stage {drillProgression?.currentStage ?? 1}/{drillProgression?.stages.length ?? 8}
            </span>
          </div>
          <div className="card-body">
            {drillProgression && (
              <DrillStepper
                currentStage={drillProgression.currentStage}
                stages={drillProgression.stages}
              />
            )}
            {coachingStrategy && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Coaching Strategy
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text)' }}>Bottleneck:</strong> {coachingStrategy.bottleneck}
                  <br />
                  <strong style={{ color: 'var(--text)' }}>Approach:</strong> {coachingStrategy.approach}
                  <br />
                  <strong style={{ color: 'var(--text)' }}>Calibration:</strong> {coachingStrategy.calibration}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Banner */}
      <div className="action-banner">
        <div className="action-icon">
          <svg viewBox="0 0 18 18"><polygon points="10 1 3 10 9 10 8 17 15 8 9 8" /></svg>
        </div>
        <div className="action-text">
          <div className="action-title">Build Your Storybank</div>
          <div className="action-desc">You have 8 story seeds from your resume. Stories are the foundation for everything.</div>
        </div>
        <button className="btn btn-primary btn-sm">Start Stories</button>
      </div>
    </div>
  );
}

/* ── Job Dashboard View ── */

function JobDashboard() {
  const { activeWorkspace } = useWorkspace();
  const { jobDashboard, isLoading } = useDashboard();

  if (isLoading || !jobDashboard) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title"><IconGrid /> Dashboard</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  const companyName = activeWorkspace?.company_name ?? jobDashboard.company;
  const roleTitle = activeWorkspace?.role_title ?? jobDashboard.role;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><IconGrid /> Dashboard</h1>
        <p className="page-subtitle">{companyName} — {roleTitle}</p>
      </div>

      {/* Job Header Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body">
          <div className="job-header">
            <div className="job-logo">{jobDashboard.logoInitial}</div>
            <div className="job-info">
              <div className="job-company">{companyName}</div>
              <div className="job-role-title">{roleTitle}</div>
            </div>
            <div className="profile-tags">
              <span className="tag tag-green">{jobDashboard.fit}</span>
              <span className="tag tag-primary">{jobDashboard.status}</span>
              <span className="tag tag-neutral">{jobDashboard.band}</span>
            </div>
          </div>
          <div className="stat-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
            <div className="stat"><strong>Next Round:</strong> {jobDashboard.nextRound}</div>
            <div className="stat"><strong>Fit Confidence:</strong> {jobDashboard.fitConfidence}</div>
            <div className="stat"><strong>Stories Mapped:</strong> {jobDashboard.storiesMapped}</div>
          </div>
        </div>
      </div>

      {/* Prep Checklist + Round Timeline */}
      <div className="card-grid card-grid-2" style={{ marginBottom: 14 }}>
        {/* Prep Checklist */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconClipboard /> Prep Checklist</span>
          </div>
          <div className="card-body">
            <ul className="checklist">
              {jobDashboard.prepChecklist.map((item) => (
                <li key={item.label}>
                  {item.done ? (
                    <span className="check-done"><IconCheck /></span>
                  ) : (
                    <span className="check-pending" />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Round Timeline */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconTrending /> Round Timeline</span>
          </div>
          <div className="card-body">
            <ul className="round-timeline">
              {jobDashboard.roundTimeline.map((round) => (
                <li key={round.name} className="round-item">
                  {round.status === 'completed' ? (
                    <span className="round-dot completed">
                      <svg style={{ width: 12, height: 12, stroke: 'white', strokeWidth: 2.5, fill: 'none' }} viewBox="0 0 18 18">
                        <polyline points="4 9 7.5 12.5 14 5.5" />
                      </svg>
                    </span>
                  ) : (
                    <span className={`round-dot${round.status === 'upcoming' ? ' upcoming' : ''}`}>
                      {round.number}
                    </span>
                  )}
                  <div className="round-info">
                    <div className="round-name">{round.name}</div>
                    <div className="round-meta">{round.meta}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Action Banner */}
      <div className="action-banner">
        <div className="action-icon">
          <svg viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7" />
            <polygon points="7.5 5.5 13 9 7.5 12.5" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="action-text">
          <div className="action-title">Run a Mock System Design</div>
          <div className="action-desc">Your Round 2 is in 7 days. Practice communicating your design thinking with voice.</div>
        </div>
        <button className="btn btn-primary btn-sm">Start Mock</button>
      </div>
    </div>
  );
}

/* ── Main export ── */

export function Dashboard() {
  const { isJobWorkspace } = useWorkspace();
  const { hasProfile, isLoading } = useDashboard();

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  // New user — redirect to onboarding
  if (!hasProfile) {
    window.location.href = '/onboarding';
    return null;
  }

  if (isJobWorkspace) {
    return <JobDashboard />;
  }

  return <GeneralDashboard />;
}
