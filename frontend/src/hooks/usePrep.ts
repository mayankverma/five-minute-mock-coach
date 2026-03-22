import { useState } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';

/* ── Type definitions ── */

export interface CompanyOverview {
  description: string;
  cultureSignals: string[];
  interviewProcess: string[];
}

export interface FitAssessment {
  verdict: string;
  confidence: string;
  fitSignals: string[];
  structuralGaps: { severity: string; text: string }[];
}

export interface JdAnalysis {
  competencies: { rank: number; name: string; description: string }[];
  storyCoverage: { status: string; competency: string; story: string }[];
}

export interface Concern {
  severity: 'high' | 'med' | 'low';
  title: string;
  counter: string;
}

export type PrepTab = 'research' | 'decode' | 'brief' | 'concerns' | 'questions' | 'present';

/* ── Hook ── */

export function usePrep() {
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<PrepTab>('research');

  // All null/empty — populated when user runs prep commands via API
  return {
    companyOverview: null as CompanyOverview | null,
    fitAssessment: null as FitAssessment | null,
    jdAnalysis: null as JdAnalysis | null,
    concerns: [] as Concern[],
    questionsToAsk: [] as string[],
    prepBrief: null as null,
    presentation: null as null,
    activeTab,
    setActiveTab,
    isLoading: false,
    subtitle: activeWorkspace
      ? `${activeWorkspace.company_name} — ${activeWorkspace.role_title}`
      : 'No job workspace selected',
  };
}
