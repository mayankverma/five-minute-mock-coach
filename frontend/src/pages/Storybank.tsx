import { useState } from 'react';
import { useStories } from '../hooks/useStories';
import { StoryForm } from '../components/StoryForm';
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
  const { stories, gaps, narrativeIdentity, addStory, isLoading } = useStories();
  const [showForm, setShowForm] = useState(false);

  const storyCount = stories.length;
  const gapCount = gaps.length;

  if (isLoading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading stories...</div>
    );
  }

  return (
    <div>
      {/* ── Header row ── */}
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

      {/* ── Story form (toggled) ── */}
      {showForm && (
        <StoryForm
          onSave={(data) => {
            addStory({
              title: data.title,
              primarySkill: data.primarySkill,
              secondarySkill: data.secondarySkill,
              earnedSecret: data.earnedSecret,
              strength: data.strength,
            });
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── Story table ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Primary Skill</th>
                <th>Secondary Skill</th>
                <th>Earned Secret</th>
                <th>Strength</th>
                <th>Uses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stories.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="story-id">{s.id}</span>
                  </td>
                  <td>
                    <span className="story-title">{s.title}</span>
                  </td>
                  <td>{s.primarySkill}</td>
                  <td>{s.secondarySkill}</td>
                  <td>{s.earnedSecret}</td>
                  <td>
                    <StrengthBar value={s.strength} />
                  </td>
                  <td>{s.uses}</td>
                  <td>
                    <button className="btn btn-outline btn-sm">
                      {s.status === 'view' ? 'View' : 'Improve'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Two-column grid: Gap Analysis + Narrative Identity ── */}
      <div className="card-grid card-grid-2">
        {/* Gap Analysis */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <SearchIcon /> Gap Analysis
            </span>
          </div>
          <div className="card-body">
            <div className="prep-list">
              {gaps.map((gap, i) => (
                <li key={i}>
                  <span
                    className={`tag ${gap.severity === 'missing' ? 'tag-red' : 'tag-amber'}`}
                    style={{ fontSize: 10 }}
                  >
                    {gap.severity === 'missing' ? 'Missing' : 'Weak'}
                  </span>{' '}
                  {gap.description}
                </li>
              ))}
            </div>
          </div>
        </div>

        {/* Narrative Identity */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <CompassIcon /> Narrative Identity
            </span>
          </div>
          <div className="card-body">
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}
            >
              <strong>Core themes:</strong> {narrativeIdentity}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
