import { createContext, useContext, useState, type ReactNode } from 'react';

export interface JobWorkspace {
  id: string;
  company_name: string;
  role_title: string;
  status: string;
  seniority_band?: string;
  fit_verdict?: string;
  color: string; // UI color for the workspace dot
}

interface WorkspaceContextType {
  /** null = General Prep workspace */
  activeWorkspace: JobWorkspace | null;
  workspaces: JobWorkspace[];
  setActiveWorkspace: (ws: JobWorkspace | null) => void;
  setWorkspaces: (ws: JobWorkspace[]) => void;
  isJobWorkspace: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<JobWorkspace | null>(null);
  const [workspaces, setWorkspaces] = useState<JobWorkspace[]>([]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        workspaces,
        setActiveWorkspace,
        setWorkspaces,
        isJobWorkspace: activeWorkspace !== null,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
