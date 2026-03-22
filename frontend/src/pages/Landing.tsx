import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import './landing.css';

export function Landing() {
  const { user, loading, signInWithEmail, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="landing-loading">Loading...</div>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setSuccess('Check your email for a confirmation link.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing">
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

      <div className="landing-hero">
        <span className="landing-badge">AI-Powered Interview Coaching</span>
        <h1 className="landing-headline">
          Your entire job search,<br /><em>coached</em> from first story to final offer
        </h1>
        <p className="landing-sub">
          Build your storybank, practice with voice, track progress across companies,
          and get smarter coaching with every session.
        </p>

        <div className="landing-stats">
          <div className="landing-stat">
            <strong>253</strong>
            <span>Interview Questions</span>
          </div>
          <div className="landing-stat">
            <strong>51</strong>
            <span>Company Profiles</span>
          </div>
          <div className="landing-stat">
            <strong>5</strong>
            <span>Scoring Dimensions</span>
          </div>
        </div>

        <div className="landing-auth-card">
          <div className="landing-auth-tabs">
            <button
              className={`landing-auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
            >
              Sign Up
            </button>
            <button
              className={`landing-auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              Log In
            </button>
          </div>

          <button className="landing-google-btn" onClick={signInWithGoogle} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="landing-divider">
            <span>or</span>
          </div>

          <form onSubmit={handleSubmit} className="landing-form">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="landing-input"
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="landing-input"
            />
            <button type="submit" className="landing-submit" disabled={submitting}>
              {submitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
            </button>
          </form>

          {error && <div className="landing-error">{error}</div>}
          {success && <div className="landing-success">{success}</div>}
        </div>

        <p className="landing-free-note">
          Free plan includes full access to 1 job workspace. No credit card required.
        </p>
      </div>

      <div className="landing-features">
        <div className="landing-feature">
          <div className="landing-feature-icon" style={{ background: '#e4f2ef' }}>
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none" stroke="#4a9e8f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3.5h5a2 2 0 0 1 2 2v10l-2.5-1.5L4 15.5v-10a2 2 0 0 0-2-2z"/><path d="M16 3.5h-5a2 2 0 0 0-2 2v10l2.5-1.5L14 15.5v-10a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <h3>Storybank</h3>
          <p>Build interview-ready STAR stories with earned secrets and gap analysis</p>
        </div>
        <div className="landing-feature">
          <div className="landing-feature-icon" style={{ background: '#eeecfb' }}>
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none" stroke="#7668d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="1" width="6" height="10" rx="3"/><path d="M3 8a6 6 0 0 0 12 0"/><line x1="9" y1="14" x2="9" y2="17"/><line x1="6" y1="17" x2="12" y2="17"/>
            </svg>
          </div>
          <h3>Voice Practice</h3>
          <p>Mock interviews with AI voice, 5-dimension scoring, and interviewer perspective</p>
        </div>
        <div className="landing-feature">
          <div className="landing-feature-icon" style={{ background: '#fef3e2' }}>
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none" stroke="#d4864a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 14 6.5 9 10 11.5 16 4"/><polyline points="12.5 4 16 4 16 7.5"/>
            </svg>
          </div>
          <h3>Smart Progress</h3>
          <p>Track scores, detect patterns, calibrate self-assessment across companies</p>
        </div>
      </div>

      <footer className="landing-footer">
        Five Minute Mock Coach &middot; AI-Powered Interview Coaching
      </footer>
    </div>
  );
}
