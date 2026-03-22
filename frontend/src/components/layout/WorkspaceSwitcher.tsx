import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';

export function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const label = activeWorkspace ? activeWorkspace.company_name : 'General Prep';
  const dotColor = activeWorkspace ? activeWorkspace.color : 'var(--primary)';

  return (
    <div className={`ws-selector ${open ? 'open' : ''}`} ref={ref}>
      <button className="ws-btn" onClick={() => setOpen(!open)}>
        <span className="ws-dot" style={{ background: dotColor }} />
        <span>{label}</span>
        <svg className="ws-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      {open && (
        <div className="ws-dropdown">
          <div
            className={`ws-option ${!activeWorkspace ? 'active' : ''}`}
            onClick={() => { setActiveWorkspace(null); setOpen(false); }}
          >
            <span className="ws-dot" style={{ background: 'var(--primary)' }} />
            <div className="ws-option-meta">
              <div className="ws-option-name">General Prep</div>
              <div className="ws-option-role">Default workspace</div>
            </div>
          </div>
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`ws-option ${activeWorkspace?.id === ws.id ? 'active' : ''}`}
              onClick={() => { setActiveWorkspace(ws); setOpen(false); }}
            >
              <span className="ws-dot" style={{ background: ws.color }} />
              <div className="ws-option-meta">
                <div className="ws-option-name">{ws.company_name}</div>
                <div className="ws-option-role">{ws.role_title}</div>
              </div>
              <span className="ws-option-status">{ws.status}</span>
            </div>
          ))}
          <div className="ws-option ws-add" onClick={() => setOpen(false)}>
            + Add Job
          </div>
        </div>
      )}
    </div>
  );
}
