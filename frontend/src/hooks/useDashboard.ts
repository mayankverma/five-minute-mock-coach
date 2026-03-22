import { useQuery } from '@tanstack/react-query';

/* ── Type definitions ── */

export interface ProfileData {
  name: string;
  role: string;
  track: string;
  timeline: string;
  mode: string;
  concern: string;
  tags: { label: string; variant: string }[];
  initials: string;
}

export interface StoryData {
  id: string;
  title: string;
  primarySkill: string;
  strength: number; // 1-5
  uses: number;
}

export interface ScorePoint {
  session: number;
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
}

export interface KanbanWorkspace {
  company: string;
  role: string;
  status: string;
  fit: string;
  color: string;
  stage: 'researched' | 'applied' | 'interviewing' | 'offer';
  tagBg: string;
  tagColor: string;
}

export interface DrillProgression {
  currentStage: number;
  stages: string[];
}

export interface CoachingStrategy {
  bottleneck: string;
  approach: string;
  calibration: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface RoundItem {
  name: string;
  meta: string;
  status: 'completed' | 'upcoming' | 'pending';
  number: number;
}

export interface JobDashboardData {
  company: string;
  role: string;
  logoInitial: string;
  fit: string;
  status: string;
  band: string;
  nextRound: string;
  fitConfidence: string;
  storiesMapped: string;
  prepChecklist: ChecklistItem[];
  roundTimeline: RoundItem[];
}

export interface DashboardData {
  profile: ProfileData;
  stories: StoryData[];
  scores: ScorePoint[];
  workspaces: KanbanWorkspace[];
  drillProgression: DrillProgression;
  coachingStrategy: CoachingStrategy;
  jobDashboard: JobDashboardData;
}

/* ── Mock data matching the reference HTML ── */

const mockData: DashboardData = {
  profile: {
    name: 'Mayank Verma',
    role: 'Director of Engineering, Product Engineering',
    track: 'Full System',
    timeline: '~2 months',
    mode: 'Full coaching',
    concern: 'Executive presence',
    tags: [
      { label: 'Full System', variant: 'tag-primary' },
      { label: 'Level 5', variant: 'tag-neutral' },
      { label: 'Stage 1', variant: 'tag-neutral' },
      { label: 'May 2026', variant: 'tag-amber' },
    ],
    initials: 'MV',
  },

  stories: [
    { id: 'S001', title: 'Scaling Eng 8 to 27 Post-Layoffs', primarySkill: 'Team Building', strength: 4, uses: 3 },
    { id: 'S002', title: 'Voice AI Platform — 1M+ Calls', primarySkill: 'Technical Vision', strength: 5, uses: 5 },
    { id: 'S003', title: '$200M Marketplace Platform', primarySkill: 'Business Impact', strength: 4, uses: 2 },
    { id: 'S004', title: 'LLM Solutions Saving $10M+', primarySkill: 'Innovation', strength: 4, uses: 1 },
  ],

  scores: [
    { session: 1, substance: 3.0, structure: 2.5, relevance: 3.5, credibility: 3.0, differentiation: 2.0 },
    { session: 2, substance: 3.3, structure: 3.0, relevance: 3.6, credibility: 3.2, differentiation: 2.3 },
    { session: 3, substance: 3.6, structure: 3.2, relevance: 4.0, credibility: 3.5, differentiation: 2.5 },
    { session: 4, substance: 3.8, structure: 3.5, relevance: 4.0, credibility: 3.7, differentiation: 3.0 },
    { session: 5, substance: 4.1, structure: 3.8, relevance: 4.2, credibility: 4.0, differentiation: 3.2 },
    { session: 6, substance: 4.3, structure: 4.0, relevance: 4.5, credibility: 4.2, differentiation: 3.5 },
  ],

  workspaces: [
    { company: 'Stripe', role: 'Sr. Dir., Platform Eng', status: 'Strong Fit', fit: 'strong', color: '#635BFF', stage: 'researched', tagBg: '#eeecfb', tagColor: '#5a4dbf' },
    { company: 'Google', role: 'Dir. Eng, AI/ML', status: 'Round 2', fit: 'high', color: '#4285F4', stage: 'interviewing', tagBg: 'var(--primary-light)', tagColor: 'var(--primary-dark)' },
    { company: 'Meta', role: 'Dir., Product Eng', status: 'Round 1', fit: 'medium', color: '#1877F2', stage: 'interviewing', tagBg: 'var(--primary-light)', tagColor: 'var(--primary-dark)' },
  ],

  drillProgression: {
    currentStage: 1,
    stages: ['Ladder', 'Pushback', 'Pivot', 'Gap', 'Role', 'Panel', 'Stress', 'Tech'],
  },

  coachingStrategy: {
    bottleneck: 'TBD',
    approach: 'Building foundation',
    calibration: 'Uncalibrated',
  },

  jobDashboard: {
    company: 'Google',
    role: 'Director of Engineering, AI/ML',
    logoInitial: 'G',
    fit: 'Strong Fit',
    status: 'Interviewing',
    band: 'Executive Band',
    nextRound: 'Mar 28 — System Design',
    fitConfidence: 'High',
    storiesMapped: '4/5 competencies',
    prepChecklist: [
      { label: 'Company research completed', done: true },
      { label: 'JD decoded — 5 competencies identified', done: true },
      { label: 'Prep brief generated', done: true },
      { label: 'Stories mapped to top questions', done: true },
      { label: 'Mock system design interview', done: false },
      { label: 'Hype plan for interview day', done: false },
    ],
    roundTimeline: [
      { name: 'R1: Behavioral Screen', meta: 'Mar 15 — 45 min, Recruiter — Advanced', status: 'completed', number: 1 },
      { name: 'R2: System Design', meta: 'Mar 28 — 60 min, Hiring Manager', status: 'upcoming', number: 2 },
      { name: 'R3: Bar Raiser', meta: 'TBD', status: 'pending', number: 3 },
      { name: 'R4: Team Match', meta: 'TBD', status: 'pending', number: 4 },
    ],
  },
};

/* ── Hook ── */

async function fetchDashboard(): Promise<DashboardData> {
  // Simulate network delay for realistic loading state
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockData;
}

export function useDashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
  });

  return {
    profile: query.data?.profile ?? null,
    stories: query.data?.stories ?? [],
    scores: query.data?.scores ?? [],
    workspaces: query.data?.workspaces ?? [],
    drillProgression: query.data?.drillProgression ?? null,
    coachingStrategy: query.data?.coachingStrategy ?? null,
    jobDashboard: query.data?.jobDashboard ?? null,
    isLoading: query.isLoading,
  };
}
