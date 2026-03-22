import { Outlet } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import './layout.css';

export function AppLayout() {
  return (
    <div className="app">
      <Topbar />
      <div className="app-body">
        <Sidebar />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
