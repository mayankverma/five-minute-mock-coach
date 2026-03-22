import { useState } from 'react';
import api from '../lib/api';
import './landing.css';
import './pages.css';

const SENIORITY_OPTIONS = [
  { value: 'early', label: 'Early Career (0-3 years)', desc: 'Just starting out or transitioning into tech' },
  { value: 'mid', label: 'Mid-Career (4-8 years)', desc: 'Solid experience, growing into senior roles' },
  { value: 'senior', label: 'Senior / Lead (8-15 years)', desc: 'Leading teams, driving technical direction' },
  { value: 'executive', label: 'Executive (15+ years)', desc: 'Director, VP, or C-level roles' },
];

const DIRECTNESS_OPTIONS = [
  { value: 1, label: 'Gentle', desc: 'Maximum encouragement, growth-focused framing' },
  { value: 3, label: 'Balanced', desc: 'Equal weight to strengths and gaps' },
  { value: 5, label: 'Direct', desc: 'No softening — tell me exactly what I need to fix' },
];

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [seniority, setSeniority] = useState('');
  const [directness, setDirectness] = useState(3);
  const [biggestConcern, setBiggestConcern] = useState('');

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.post('/api/auth/profile', {
        full_name: fullName,
        target_roles: targetRole ? [targetRole] : [],
        seniority_band: seniority,
        feedback_directness: directness,
        biggest_concern: biggestConcern,
        track: 'full',
        coaching_mode: 'full',
      });
      // Force refetch of profile data
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to save profile:', err);
      setSaving(false);
    }
  };

  return (
    <div className="landing" style={{ minHeight: '100vh' }}>
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="landing-logo-mark">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="9" r="7" /><circle cx="9" cy="9" r="4" /><circle cx="9" cy="9" r="1" />
            </svg>
          </span>
          Five Minute Mock Coach
        </div>
      </nav>

      <div className="landing-hero" style={{ maxWidth: 520 }}>
        <h1 className="landing-headline" style={{ fontSize: 32, marginBottom: 8 }}>
          Welcome{fullName ? `, ${fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="landing-sub" style={{ marginBottom: 32 }}>
          {step === 1 && "Let's set up your coaching profile. This takes about a minute."}
          {step === 2 && "What role are you targeting?"}
          {step === 3 && "Almost done — how should I coach you?"}
        </p>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: s <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div className="landing-auth-card">
          {/* Step 1: Name */}
          {step === 1 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Your full name
              </label>
              <input
                className="landing-input"
                type="text"
                placeholder="e.g., Mayank Verma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
              <button
                className="landing-submit"
                style={{ marginTop: 16 }}
                onClick={() => setStep(2)}
                disabled={!fullName.trim()}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Target role + seniority */}
          {step === 2 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                What role are you targeting?
              </label>
              <input
                className="landing-input"
                type="text"
                placeholder="e.g., Senior Software Engineer, Director of Engineering"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                autoFocus
              />

              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 18, marginBottom: 8 }}>
                Experience level
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SENIORITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${seniority === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                      background: seniority === opt.value ? 'var(--primary-lighter)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="seniority"
                      value={opt.value}
                      checked={seniority === opt.value}
                      onChange={() => setSeniority(opt.value)}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="landing-submit" style={{ flex: 1, background: 'var(--bg-alt)', color: 'var(--text)' }} onClick={() => setStep(1)}>Back</button>
                <button className="landing-submit" style={{ flex: 2 }} onClick={() => setStep(3)} disabled={!seniority}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Directness + concern */}
          {step === 3 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                How direct should coaching feedback be?
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DIRECTNESS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      flex: 1, textAlign: 'center', padding: '12px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${directness === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                      background: directness === opt.value ? 'var(--primary-lighter)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input type="radio" name="directness" value={opt.value} checked={directness === opt.value} onChange={() => setDirectness(opt.value)} style={{ display: 'none' }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </label>
                ))}
              </div>

              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 18, marginBottom: 6 }}>
                What's your biggest interview concern? (optional)
              </label>
              <input
                className="landing-input"
                type="text"
                placeholder="e.g., Executive presence, technical depth, storytelling"
                value={biggestConcern}
                onChange={(e) => setBiggestConcern(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="landing-submit" style={{ flex: 1, background: 'var(--bg-alt)', color: 'var(--text)' }} onClick={() => setStep(2)}>Back</button>
                <button className="landing-submit" style={{ flex: 2 }} onClick={handleFinish} disabled={saving}>
                  {saving ? 'Setting up...' : 'Start Coaching'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>
          <div className="landing-feature" style={{ padding: '16px 12px' }}>
            <div className="landing-feature-icon" style={{ background: '#e4f2ef', width: 36, height: 36 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4a9e8f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3.5h5a2 2 0 0 1 2 2v10l-2.5-1.5L4 15.5v-10a2 2 0 0 0-2-2z" /><path d="M16 3.5h-5a2 2 0 0 0-2 2v10l2.5-1.5L14 15.5v-10a2 2 0 0 1 2-2z" />
              </svg>
            </div>
            <h3 style={{ fontSize: 13 }}>Build Stories</h3>
          </div>
          <div className="landing-feature" style={{ padding: '16px 12px' }}>
            <div className="landing-feature-icon" style={{ background: '#eeecfb', width: 36, height: 36 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#7668d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="1" width="6" height="10" rx="3" /><path d="M3 8a6 6 0 0 0 12 0" /><line x1="9" y1="14" x2="9" y2="17" /><line x1="6" y1="17" x2="12" y2="17" />
              </svg>
            </div>
            <h3 style={{ fontSize: 13 }}>Voice Practice</h3>
          </div>
          <div className="landing-feature" style={{ padding: '16px 12px' }}>
            <div className="landing-feature-icon" style={{ background: '#fef3e2', width: 36, height: 36 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#d4864a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 14 6.5 9 10 11.5 16 4" /><polyline points="12.5 4 16 4 16 7.5" />
              </svg>
            </div>
            <h3 style={{ fontSize: 13 }}>Track Progress</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
