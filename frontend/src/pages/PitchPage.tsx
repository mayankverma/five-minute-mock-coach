import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useResume } from '../hooks/useResume';
import api from '../lib/api';
import './pages.css';

export function PitchPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasResume } = useResume();
  const queryClient = useQueryClient();

  const pitchQuery = useQuery({
    queryKey: ['pitch', user?.id],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/materials/pitch');
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/materials/pitch/generate');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitch'] });
    },
  });

  const pitch = pitchQuery.data;

  if (!hasResume) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Pitch</h1>
          <p className="page-subtitle">Your positioning statement — the consistency anchor for LinkedIn, outreach, and interviews.</p>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-title">Upload your resume to unlock Pitch</div>
            <div className="empty-state-desc">Your positioning statement is generated from your resume analysis.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.href = '/resume'}>Go to Resume</button>
          </div>
        </div>
      </div>
    );
  }

  if (generateMutation.isPending) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">Pitch</h1></div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Generating your positioning statement...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!pitch) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Pitch</h1>
          <p className="page-subtitle">Generate your positioning statement from your resume analysis.</p>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-title">Ready to generate your pitch</div>
            <div className="empty-state-desc">We'll use your resume analysis to create a core positioning statement with context variants.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => generateMutation.mutate()}>Generate Pitch</button>
          </div>
        </div>
      </div>
    );
  }

  const variants = pitch.variants || {};
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pitch</h1>
        <p className="page-subtitle">Your positioning statement and context variants</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">Core Statement</span>
          <button className="btn btn-sm" onClick={() => generateMutation.mutate()}>Regenerate</button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>{pitch.core_statement}</p>
          {pitch.key_differentiator && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Differentiator:</strong> {pitch.key_differentiator}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><span className="card-title">10-Second Hook</span></div>
        <div className="card-body"><p style={{ fontSize: 13 }}>{pitch.hook_10s}</p></div>
      </div>

      {variants.networking && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">Networking Variant</span></div>
          <div className="card-body"><p style={{ fontSize: 13 }}>{variants.networking}</p></div>
        </div>
      )}

      {variants.interview_opener && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">Interview Opener (TMAY)</span></div>
          <div className="card-body"><p style={{ fontSize: 13 }}>{variants.interview_opener}</p></div>
        </div>
      )}

      {variants.linkedin_headline && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">LinkedIn Headline</span></div>
          <div className="card-body"><p style={{ fontSize: 13 }}>{variants.linkedin_headline}</p></div>
        </div>
      )}
    </div>
  );
}
