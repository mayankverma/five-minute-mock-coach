import { useWorkspace } from '../contexts/WorkspaceContext';

export function Dashboard() {
  const { isJobWorkspace, activeWorkspace } = useWorkspace();

  if (isJobWorkspace && activeWorkspace) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{activeWorkspace.company_name} — {activeWorkspace.role_title}</p>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>Job workspace dashboard — prep checklist, round timeline, filtered scores. (Task 13)</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back. Here's your coaching overview.</p>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>General dashboard — profile, storybank, scores, kanban, drill stepper. (Task 13)</p>
    </div>
  );
}
