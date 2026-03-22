import { useState } from 'react';

interface StoryFormProps {
  onSave: (data: StoryFormData) => void;
  onCancel: () => void;
}

export interface StoryFormData {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  primarySkill: string;
  secondarySkill: string;
  earnedSecret: string;
  strength: number;
  domain: string;
  deployFor: string;
  notes: string;
}

const EMPTY_FORM: StoryFormData = {
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  primarySkill: '',
  secondarySkill: '',
  earnedSecret: '',
  strength: 3,
  domain: '',
  deployFor: '',
  notes: '',
};

export function StoryForm({ onSave, onCancel }: StoryFormProps) {
  const [form, setForm] = useState<StoryFormData>(EMPTY_FORM);

  const update = (field: keyof StoryFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <span className="card-title">
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
            <line x1="9" y1="3" x2="9" y2="15" />
            <line x1="3" y1="9" x2="15" y2="9" />
          </svg>{' '}
          Add New Story
        </span>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Scaling Eng Org 8 to 27"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontFamily: 'var(--ff-body)',
                background: 'var(--bg)',
              }}
            />
          </div>

          {/* STAR fields */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {(['situation', 'task', 'action', 'result'] as const).map((field) => (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {field}
                </label>
                <textarea
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  placeholder={`Describe the ${field}...`}
                  rows={3}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontFamily: 'var(--ff-body)',
                    background: 'var(--bg)',
                    resize: 'vertical',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Skill / Secret row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Primary Skill
              </label>
              <input
                type="text"
                value={form.primarySkill}
                onChange={(e) => update('primarySkill', e.target.value)}
                placeholder="e.g. Team Building"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontFamily: 'var(--ff-body)',
                  background: 'var(--bg)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Secondary Skill
              </label>
              <input
                type="text"
                value={form.secondarySkill}
                onChange={(e) => update('secondarySkill', e.target.value)}
                placeholder="e.g. Change Mgmt"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontFamily: 'var(--ff-body)',
                  background: 'var(--bg)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Earned Secret
              </label>
              <input
                type="text"
                value={form.earnedSecret}
                onChange={(e) => update('earnedSecret', e.target.value)}
                placeholder="Your unique insight..."
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontFamily: 'var(--ff-body)',
                  background: 'var(--bg)',
                }}
              />
            </div>
          </div>

          {/* Strength selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Strength (1-5)
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update('strength', n)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border)',
                      background: n <= form.strength ? 'var(--primary)' : 'var(--bg)',
                      color: n <= form.strength ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'var(--ff-body)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Domain
              </label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => update('domain', e.target.value)}
                placeholder="e.g. FinTech, SaaS"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontFamily: 'var(--ff-body)',
                  background: 'var(--bg)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Deploy For
              </label>
              <input
                type="text"
                value={form.deployFor}
                onChange={(e) => update('deployFor', e.target.value)}
                placeholder="e.g. Leadership, Technical"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontFamily: 'var(--ff-body)',
                  background: 'var(--bg)',
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontFamily: 'var(--ff-body)',
                background: 'var(--bg)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Story
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
