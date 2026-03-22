import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import './layout.css';

const TABS = [
  { to: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { to: '/stories', label: 'Stories', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { to: '/practice', label: 'Practice', icon: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8' },
  { to: '/prep', label: 'Prep', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

const MORE_ITEMS = [
  { to: '/mock', label: 'Mock Interview' },
  { to: '/progress', label: 'Progress' },
  { to: '/materials', label: 'Materials' },
  { to: '/hype', label: 'Hype' },
  { to: '/debrief', label: 'Debrief' },
  { to: '/billing', label: 'Billing' },
];

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const isMoreActive = MORE_ITEMS.some(item => location.pathname === item.to);

  return (
    <>
      {showMore && (
        <div className="mobile-more-overlay" onClick={() => setShowMore(false)}>
          <div className="mobile-more-sheet" onClick={e => e.stopPropagation()}>
            <div className="mobile-more-header">
              <span>More</span>
              <button className="mobile-more-close" onClick={() => setShowMore(false)}>&times;</button>
            </div>
            {MORE_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `mobile-more-item ${isActive ? 'active' : ''}`}
                onClick={() => setShowMore(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <nav className="mobile-nav">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`}
            end={tab.to === '/'}
          >
            <svg className="mobile-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span className="mobile-tab-label">{tab.label}</span>
          </NavLink>
        ))}
        <button
          className={`mobile-tab ${isMoreActive ? 'active' : ''}`}
          onClick={() => setShowMore(!showMore)}
        >
          <svg className="mobile-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
          </svg>
          <span className="mobile-tab-label">More</span>
        </button>
      </nav>
    </>
  );
}
