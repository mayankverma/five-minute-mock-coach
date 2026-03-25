import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import './pages.css';

export function LinkedInPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [profileText, setProfileText] = useState('');

  const linkedinQuery = useQuery({
    queryKey: ['linkedin', user?.id],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/materials/linkedin');
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const auditMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post('/api/materials/linkedin/audit', { linkedin_text: text });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin'] });
    },
  });

  const analysis = linkedinQuery.data;

  if (!analysis && !auditMutation.isPending) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">LinkedIn</h1>
          <p className="page-subtitle">Get a section-by-section audit calibrated to how recruiters search and scan profiles.</p>
        </div>
        <div className="card">
          <div className="card-body">
            <textarea
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              placeholder="Paste your LinkedIn profile text here..."
              rows={8}
              style={{ width: '100%', fontSize: 13, padding: 12, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', resize: 'vertical', fontFamily: 'var(--ff-body)' }}
            />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => auditMutation.mutate(profileText)}
              disabled={!profileText.trim()}
            >
              Start Audit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (auditMutation.isPending) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">LinkedIn</h1></div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Auditing your LinkedIn profile...</div>
          </div>
        </div>
      </div>
    );
  }

  const dims = [
    { label: 'Recruiter Discoverability', value: analysis.recruiter_discoverability },
    { label: 'Credibility', value: analysis.credibility_score },
    { label: 'Differentiation', value: analysis.differentiation_score },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">LinkedIn</h1>
        <p className="page-subtitle">Profile audit results</p>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Audit Results</span>
          <button className="btn btn-sm" onClick={() => { queryClient.removeQueries({ queryKey: ['linkedin'] }); setProfileText(''); }}>Re-audit</button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, marginBottom: 16 }}>{analysis.overall}</p>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            {dims.map((d) => (
              <div key={d.label} style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{d.label}: </span>
                <span style={{ fontWeight: 600 }}>{d.value}</span>
              </div>
            ))}
          </div>
          {analysis.top_fixes && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>Top Fixes</div>
              {analysis.top_fixes.map((fix: any, i: number) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.6 }}>
                  <strong>{fix.section}:</strong> {fix.issue} — <em>{fix.fix}</em>
                </div>
              ))}
            </>
          )}
          {analysis.positioning_gaps && (
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Positioning Gaps:</strong> {analysis.positioning_gaps}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
