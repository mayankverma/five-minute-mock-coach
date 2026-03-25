import { useRef, useState, type DragEvent } from 'react';
import { useResume } from '../hooks/useResume';
import type { ResumeSection, ResumeAnalysis } from '../hooks/useResume';
import './resume-page.css';

/* -- Icons -- */
function UploadIcon() {
  return (
    <svg className="resume-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* -- Analysis Card -- */
function AnalysisCard({ analysis }: { analysis: ResumeAnalysis }) {
  const dims = [
    { label: 'ATS', value: analysis.ats_compatibility },
    { label: 'Recruiter Scan', value: analysis.recruiter_scan },
    { label: 'Bullet Quality', value: analysis.bullet_quality },
    { label: 'Seniority', value: analysis.seniority_calibration },
    { label: 'Keywords', value: analysis.keyword_coverage },
    { label: 'Structure', value: analysis.structure_layout },
    { label: 'Concerns', value: analysis.concern_management },
    { label: 'Polish', value: analysis.consistency_polish },
  ];

  function dimValue(raw: any): string {
    if (!raw) return 'N/A';
    if (typeof raw === 'object' && raw.status) return raw.status;
    if (typeof raw === 'string') {
      // Try parsing JSON strings like '{"status":"ATS-Broken","rationale":"..."}'
      if (raw.startsWith('{')) {
        try { const parsed = JSON.parse(raw); return parsed.status || raw; } catch { /* fall through */ }
      }
      return raw.split(' ')[0];
    }
    return 'N/A';
  }

  function dimClass(val: any) {
    const v = dimValue(val).toLowerCase();
    if (v.includes('strong') || v.includes('ready') || v.includes('aligned')) return 'strong';
    if (v.includes('moderate') || v.includes('risky')) return 'moderate';
    if (v.includes('weak') || v.includes('broken') || v.includes('mismatched')) return 'weak';
    return '';
  }

  return (
    <div className="ra-card">
      <div className="ra-grade-row">
        <div className="ra-grade-circle">{analysis.overall_grade || '?'}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Resume Score</div>
          <div className="ra-grade-label">{analysis.depth_level} analysis</div>
        </div>
      </div>

      <div className="ra-dims">
        {dims.map((d) => (
          <div key={d.label} className="ra-dim">
            <span className="ra-dim-label">{d.label}</span>
            <span className={`ra-dim-value ${dimClass(d.value)}`}>
              {dimValue(d.value)}
            </span>
          </div>
        ))}
      </div>

      {analysis.top_fixes && analysis.top_fixes.length > 0 && (
        <>
          <div className="ra-fixes-title">Top Fixes</div>
          {analysis.top_fixes.map((fix, i) => (
            <div key={i} className="ra-fix">
              <span className={`ra-fix-severity ${fix.severity || 'neutral'}`}>
                {fix.severity === 'red' ? 'Fix' : fix.severity === 'amber' ? 'Improve' : 'Nice'}
              </span>
              <span className="ra-fix-text">{fix.text || fix.fix}</span>
            </div>
          ))}
        </>
      )}

      {analysis.story_seeds && analysis.story_seeds.length > 0 && (
        <>
          <div className="ra-seeds-title">Story Seeds</div>
          {analysis.story_seeds.map((seed, i) => (
            <div key={i} className="ra-seed">
              <span className="ra-seed-text">{seed.title || seed.source_bullet}</span>
              <button className="ra-seed-btn">Add to Storybank</button>
            </div>
          ))}
        </>
      )}

      <button className="ra-refine-btn">Refine with Coach</button>
    </div>
  );
}

/* -- Builder Section -- */
function BuilderSection({ section }: { section: ResumeSection }) {
  const { content, section_type } = section;

  if (section_type === 'summary') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Summary</span>
          <button className="rb-section-edit">edit</button>
        </div>
        <p className="rb-text">{content.text}</p>
      </div>
    );
  }

  if (section_type === 'experience') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Experience</span>
          <button className="rb-section-edit">edit</button>
        </div>
        <div className="rb-company">{content.company}</div>
        <div className="rb-title">{content.title}</div>
        <div className="rb-dates">
          {content.start_date} — {content.end_date || 'Present'}
          {content.location && ` · ${content.location}`}
        </div>
        {content.bullets && (
          <ul className="rb-bullets">
            {content.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>
    );
  }

  if (section_type === 'education') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Education</span>
          <button className="rb-section-edit">edit</button>
        </div>
        <div className="rb-company">{content.institution}</div>
        <div className="rb-title">{content.degree}{content.field ? ` — ${content.field}` : ''}</div>
        {content.graduation_date && <div className="rb-dates">{content.graduation_date}</div>}
      </div>
    );
  }

  if (section_type === 'skills') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Skills</span>
          <button className="rb-section-edit">edit</button>
        </div>
        {content.categories?.map((cat: { name: string; skills: string[] }, i: number) => (
          <div key={i} className="rb-skills-group">
            <div className="rb-skills-label">{cat.name}</div>
            <div className="rb-skill-tags">
              {cat.skills.map((s: string) => <span key={s} className="rb-skill-tag">{s}</span>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section_type === 'certifications') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Certifications</span>
          <button className="rb-section-edit">edit</button>
        </div>
        {content.items?.map((c: { name: string; issuer: string; date: string }, i: number) => (
          <div key={i} className="rb-text">{c.name} — {c.issuer} ({c.date})</div>
        ))}
      </div>
    );
  }

  return null;
}

/* -- Main Page -- */
export function ResumePage() {
  const { resume, sections, analysis, isLoading, hasResume, upload, deleteResume, analyze } = useResume();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx'))) {
      upload.mutate(file);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (isLoading) {
    return <div className="resume-page"><div className="resume-uploading"><div className="resume-uploading-inner"><div className="resume-uploading-spinner" /><div className="resume-uploading-text">Loading...</div></div></div></div>;
  }

  // Uploading state
  if (upload.isPending) {
    return (
      <div className="resume-page">
        <div className="resume-uploading">
          <div className="resume-uploading-inner">
            <div className="resume-uploading-spinner" />
            <div className="resume-uploading-text">Analyzing your resume...</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Parsing sections, running 8-dimension audit, and extracting story seeds.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no resume uploaded
  if (!hasResume) {
    return (
      <div className="resume-page">
        <div className="resume-header"><h1>Resume</h1></div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <div
          className={`resume-dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="resume-dropzone-inner">
            <UploadIcon />
            <div className="resume-dropzone-title">Upload your resume to get started</div>
            <div className="resume-dropzone-desc">
              Get an ATS compatibility audit, story seeds for your storybank, and a structured resume you can iterate on with your AI coach.
            </div>
            <button className="btn btn-primary">Upload Resume</button>
            <div className="resume-dropzone-hint">Accepts PDF and DOCX — or drag and drop</div>
          </div>
        </div>
      </div>
    );
  }

  // Main state — split pane with builder (left) + analysis (right)
  return (
    <div className="resume-page">
      <div className="resume-header">
        <h1>Resume</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12 }}
            onClick={() => inputRef.current?.click()}
          >
            Re-upload
          </button>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, color: '#c0392b', borderColor: '#c0392b' }}
            onClick={() => {
              if (resume && window.confirm('Delete this resume? This will remove all sections, analysis, and coaching history.')) {
                deleteResume.mutate(resume.id);
              }
            }}
            disabled={deleteResume.isPending}
          >
            {deleteResume.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="resume-split">
        <div className="resume-builder-panel">
          {sections.map((section) => (
            <BuilderSection key={section.id} section={section} />
          ))}
          {sections.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              No sections parsed yet.
            </div>
          )}
        </div>

        <div className="resume-right-panel">
          {analysis ? (
            <AnalysisCard analysis={analysis} />
          ) : analyze.isPending ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="resume-uploading-spinner" style={{ width: 32, height: 32, margin: '0 auto 12px', border: '3px solid var(--border-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Running 8-dimension analysis...</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No analysis yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Run an AI-powered audit covering ATS compatibility, bullet quality, seniority calibration, and more.
              </div>
              <button
                className="ra-refine-btn"
                style={{ maxWidth: 240, margin: '0 auto' }}
                onClick={() => resume && analyze.mutate(resume.id)}
              >
                Analyze Resume
              </button>
              {analyze.isError && (
                <div style={{ fontSize: 12, color: '#c0392b', marginTop: 8 }}>
                  Analysis failed. Try again.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
