import { NavLink } from 'react-router-dom';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import './layout.css';

interface NavItem {
  to: string;
  label: string;
  badge?: string;
}

const GENERAL_NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Coaching', items: [{ to: '/', label: 'Dashboard' }] },
  {
    group: 'Build',
    items: [
      { to: '/resume', label: 'Resume' },
      { to: '/stories', label: 'Storybank', badge: 'Next' },
      { to: '/linkedin', label: 'LinkedIn' },
      { to: '/pitch', label: 'Pitch' },
      { to: '/outreach', label: 'Outreach' },
    ],
  },
  { group: 'Practice', items: [{ to: '/practice', label: 'Practice' }, { to: '/mock', label: 'Mock Interview' }] },
  { group: 'Track', items: [{ to: '/progress', label: 'Progress' }] },
];

const JOB_NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Coaching', items: [{ to: '/', label: 'Dashboard' }] },
  {
    group: 'Build',
    items: [
      { to: '/resume', label: 'Resume' },
      { to: '/stories', label: 'Storybank' },
    ],
  },
  { group: 'Prepare', items: [{ to: '/prep', label: 'Interview Prep' }] },
  { group: 'Practice', items: [{ to: '/practice', label: 'Practice' }, { to: '/mock', label: 'Mock Interview' }, { to: '/hype', label: 'Hype' }] },
  { group: 'Track', items: [{ to: '/debrief', label: 'Debrief' }, { to: '/progress', label: 'Progress' }] },
];

export function Sidebar() {
  const { isJobWorkspace } = useWorkspace();
  const { user } = useAuth();
  const nav = isJobWorkspace ? JOB_NAV : GENERAL_NAV;
  const initials = user?.email?.slice(0, 2).toUpperCase() || '?';

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {nav.map(({ group, items }) => (
          <div className="sb-group" key={group}>
            <div className="sb-label">{group}</div>
            {items.map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}
                end={item.to === '/'}
              >
                {item.label}
                {item.badge && <span className="sb-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-bottom">
        <div className="sb-user">
          <div className="sb-user-avatar">{initials}</div>
          <div>
            <div className="sb-user-name">{user?.email?.split('@')[0] || 'User'}</div>
            <div className="sb-user-plan">Free Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
