import { useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import './pricing.css';

const FEATURES = [
  { name: 'General Prep Workspace', free: true, premium: true },
  { name: '253 Practice Questions', free: true, premium: true },
  { name: 'AI Coaching Feedback', free: true, premium: true },
  { name: 'Storybank (5 stories)', free: true, premium: false },
  { name: 'Storybank (unlimited)', free: false, premium: true },
  { name: '1 Job Workspace', free: true, premium: true },
  { name: 'Unlimited Job Workspaces', free: false, premium: true },
  { name: 'Voice Mock Interviews', free: false, premium: true },
  { name: 'Interview Prep Briefs', free: false, premium: true },
  { name: 'Resume & LinkedIn Audit', free: false, premium: true },
  { name: 'Salary Negotiation Coach', free: false, premium: true },
];

export function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/billing/checkout');
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Upgrade to Premium</h1>
        <p>Get unlimited access to all coaching features.</p>
      </div>
      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-card-header">
            <h3>Free</h3>
            <div className="pricing-price">$0</div>
            <div className="pricing-period">forever</div>
          </div>
          <ul className="pricing-features">
            {FEATURES.map(f => (
              <li key={f.name} className={f.free ? '' : 'disabled'}>
                <span className="pricing-check">{f.free ? '\u2713' : '\u2717'}</span>
                {f.name}
              </li>
            ))}
          </ul>
          <button className="pricing-cta pricing-cta-secondary" disabled>Current Plan</button>
        </div>
        <div className="pricing-card pricing-card-featured">
          <div className="pricing-card-badge">Most Popular</div>
          <div className="pricing-card-header">
            <h3>Premium</h3>
            <div className="pricing-price">$29</div>
            <div className="pricing-period">per month</div>
          </div>
          <ul className="pricing-features">
            {FEATURES.map(f => (
              <li key={f.name} className={f.premium ? '' : 'disabled'}>
                <span className="pricing-check">{f.premium || f.free ? '\u2713' : '\u2717'}</span>
                {f.name}
              </li>
            ))}
          </ul>
          <button
            className="pricing-cta pricing-cta-primary"
            onClick={handleCheckout}
            disabled={loading || !user}
          >
            {loading ? 'Redirecting...' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
