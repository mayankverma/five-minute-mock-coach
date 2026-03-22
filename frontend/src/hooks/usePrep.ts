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

export interface Competency {
  rank: number;
  name: string;
  description: string;
}

export interface StoryCoverage {
  status: 'covered' | 'gap';
  competency: string;
  story: string;
}

export interface JdAnalysis {
  competencies: Competency[];
  storyCoverage: StoryCoverage[];
}

export interface Concern {
  severity: 'high' | 'med' | 'low';
  title: string;
  counter: string;
}

export type PrepTab = 'research' | 'decode' | 'brief' | 'concerns' | 'questions' | 'present';

/* ── Mock data matching the reference HTML (Google workspace) ── */

const mockCompanyOverview: CompanyOverview = {
  description:
    "Google's AI/ML division is undergoing rapid expansion. The Director of Engineering role reports to a VP and owns a 50-80 person org building foundational ML infrastructure.",
  cultureSignals: [
    'Data-driven decision making is non-negotiable',
    'Strong IC culture — Directors must stay technical',
    'Consensus-oriented but expects leaders to drive alignment',
  ],
  interviewProcess: [
    'R1: Behavioral screen (recruiter, 45 min)',
    'R2: System design (HM, 60 min)',
    'R3: Bar raiser / leadership deep-dive',
    'R4: Team match',
  ],
};

const mockFitAssessment: FitAssessment = {
  verdict: 'Strong Fit',
  confidence: 'High confidence',
  fitSignals: [
    'ML/AI platform leadership aligns directly with DoorDash voice AI work',
    "Scale experience (1M+ calls/month) matches Google's infrastructure expectations",
    'Berkeley MBA + technical depth = rare Director profile',
  ],
  structuralGaps: [
    { severity: 'Frameable', text: 'No Google/FAANG pedigree — counter with scale metrics' },
    { severity: 'Minor', text: 'Title gap (Sr. EM vs Director) — counter with scope evidence' },
  ],
};

const mockJdAnalysis: JdAnalysis = {
  competencies: [
    { rank: 1, name: 'Technical Vision at Scale', description: 'designing ML systems for billions of queries' },
    { rank: 2, name: 'Org Building', description: 'hiring and growing 50+ person engineering orgs' },
    { rank: 3, name: 'Cross-functional Leadership', description: 'partnering with PM, Research, and Infra' },
    { rank: 4, name: 'Execution Under Ambiguity', description: 'shipping in fast-moving AI landscape' },
    { rank: 5, name: 'Stakeholder Management', description: 'VP-level communication and influence' },
  ],
  storyCoverage: [
    { status: 'covered', competency: 'Technical Vision', story: 'S002 (Voice AI Platform)' },
    { status: 'covered', competency: 'Org Building', story: 'S001 (Scaling 8 to 27)' },
    { status: 'covered', competency: 'Cross-functional', story: 'S003 ($200M Marketplace)' },
    { status: 'covered', competency: 'Execution', story: 'S004 (LLM Solutions)' },
    { status: 'gap', competency: 'Stakeholder Management', story: 'need a dedicated story' },
  ],
};

const mockConcerns: Concern[] = [
  {
    severity: 'high',
    title: 'Title Gap:',
    counter:
      'Sr. EM seeking Director. Counter: "I\'ve been operating at Director scope for 2+ years — 35 person org, 3 managers, P&L ownership."',
  },
  {
    severity: 'med',
    title: 'No FAANG:',
    counter:
      'Lyft/DoorDash vs Google. Counter: "I\'ve built systems at comparable scale — 1M+ daily calls, $200M revenue platform."',
  },
  {
    severity: 'low',
    title: 'Short DoorDash tenure:',
    counter:
      '~10 months. Counter: "Deliberate scope expansion — took broader role to prove Director readiness."',
  },
];

const mockQuestionsToAsk: string[] = [
  '"What does success look like for this role in the first 6 months — and what\'s the biggest risk you see in getting there?"',
  '"How does the team balance foundational ML infrastructure work with product-facing feature development?"',
  '"What\'s the biggest technical bet the org is making right now, and how is that decision being made?"',
  '"How much latitude does a Director have to reshape team structure and hiring priorities?"',
  '"What happened to the last person in this role — or is this a new position?"',
];

/* ── Hook ── */

export function usePrep() {
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<PrepTab>('research');

  // In a real app this would fetch from the API based on activeWorkspace.
  // For now return mock data (Google workspace).
  const isLoading = false;

  return {
    companyOverview: mockCompanyOverview,
    fitAssessment: mockFitAssessment,
    jdAnalysis: mockJdAnalysis,
    concerns: mockConcerns,
    questionsToAsk: mockQuestionsToAsk,
    prepBrief: null as null,
    presentation: null as null,
    activeTab,
    setActiveTab,
    isLoading,
    /** Convenience: the company/role string for the subtitle */
    subtitle: activeWorkspace
      ? `${activeWorkspace.company_name} — ${activeWorkspace.role_title}`
      : 'Google — Director of Engineering, AI/ML',
  };
}
