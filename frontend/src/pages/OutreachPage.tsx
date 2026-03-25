import { useState } from 'react';
import { useResume } from '../hooks/useResume';
import './pages.css';

const MESSAGE_TYPES = [
  { key: 'cold_linkedin', label: 'Cold LinkedIn Connection', limit: '300 chars' },
  { key: 'cold_email', label: 'Cold Email', limit: '75-125 words' },
  { key: 'warm_intro', label: 'Warm Intro Request', limit: 'Forwardable blurb' },
  { key: 'informational', label: 'Informational Interview Ask', limit: '' },
  { key: 'recruiter_reply', label: 'Recruiter Reply', limit: '' },
  { key: 'follow_up', label: 'Follow-Up', limit: '' },
  { key: 'post_meeting', label: 'Post-Meeting Follow-Up', limit: '' },
  { key: 'referral', label: 'Referral Request', limit: '' },
];

export function OutreachPage() {
  const { hasResume } = useResume();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  if (!hasResume) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Outreach</h1>
          <p className="page-subtitle">Craft personalized networking messages with your AI coach.</p>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-title">Upload your resume to unlock Outreach</div>
            <div className="empty-state-desc">Outreach messages are personalized using your resume and positioning.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.href = '/resume'}>Go to Resume</button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedType) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Outreach</h1>
          <p className="page-subtitle">Select a message type to draft.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {MESSAGE_TYPES.map((type) => (
            <div
              key={type.key}
              className="card"
              style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
              onClick={() => setSelectedType(type.key)}
            >
              <div className="card-body" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{type.label}</div>
                {type.limit && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{type.limit}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const typeInfo = MESSAGE_TYPES.find((t) => t.key === selectedType);
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Outreach</h1>
        <p className="page-subtitle">{typeInfo?.label}</p>
      </div>
      <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={() => setSelectedType(null)}>
        Back to message types
      </button>
      <div className="card">
        <div className="card-body empty-state">
          <div className="empty-state-title">Coach chat for {typeInfo?.label}</div>
          <div className="empty-state-desc">
            The AI coach will ask for target context and draft a personalized message.
            Coach chat integration coming next.
          </div>
        </div>
      </div>
    </div>
  );
}
