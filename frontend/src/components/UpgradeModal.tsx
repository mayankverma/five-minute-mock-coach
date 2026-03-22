import { useState } from 'react';
import api from '../lib/api';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/billing/checkout');
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <div className="modal-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h3>Upgrade to Premium</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '8px 0 20px', lineHeight: 1.5 }}>
          You've reached the free plan limit of 1 job workspace.
          Upgrade to Premium for unlimited workspaces, voice mock interviews, and more.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="mock-btn"
            style={{ flex: 1, background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            onClick={onClose}
          >
            Maybe Later
          </button>
          <button
            className="mock-btn mock-btn-primary"
            style={{ flex: 1 }}
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? 'Redirecting...' : 'Upgrade — $29/mo'}
          </button>
        </div>
      </div>
    </div>
  );
}
