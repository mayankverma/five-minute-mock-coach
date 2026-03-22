import { useAuth } from '../../contexts/AuthContext';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import './layout.css';

export function Topbar() {
  const { user } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() || '?';

  return (
    <header className="topbar">
      <a className="topbar-logo" href="/">
        <span className="topbar-logo-mark">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="7" /><circle cx="9" cy="9" r="4" /><circle cx="9" cy="9" r="1" />
          </svg>
        </span>
        Five Minute Mock Coach
      </a>
      <WorkspaceSwitcher />
      <div className="topbar-spacer" />
      <div className="topbar-avatar">{initials}</div>
    </header>
  );
}
