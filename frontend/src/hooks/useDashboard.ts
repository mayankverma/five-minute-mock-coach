import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

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
  strength: number;
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

/* ── Fetch profile from API ── */

async function fetchProfile() {
  const { data } = await api.get('/api/auth/me');
  return data;
}

/* ── Hook ── */

export function useDashboard() {
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000,
  });

  const rawProfile = profileQuery.data;
  const hasProfile = rawProfile?.has_profile === true;

  // Build display data from real profile
  const profile: ProfileData | null = hasProfile ? {
    name: rawProfile.full_name || 'New User',
    role: rawProfile.target_roles?.[0] || 'Not set yet',
    track: rawProfile.track === 'quick_prep' ? 'Quick Prep' : 'Full System',
    timeline: rawProfile.interview_timeline || 'Not set',
    mode: rawProfile.coaching_mode || 'full',
    concern: rawProfile.biggest_concern || 'Not set',
    tags: [
      { label: rawProfile.track === 'quick_prep' ? 'Quick Prep' : 'Full System', variant: 'tag-primary' },
      { label: `Level ${rawProfile.feedback_directness || 3}`, variant: 'tag-neutral' },
      { label: 'Stage 1', variant: 'tag-neutral' },
    ],
    initials: (rawProfile.full_name || 'NU').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
  } : null;

  return {
    profile,
    hasProfile,
    stories: [] as StoryData[],
    scores: [] as ScorePoint[],
    workspaces: [] as KanbanWorkspace[],
    drillProgression: { currentStage: 1, stages: ['Ladder', 'Pushback', 'Pivot', 'Gap', 'Role', 'Panel', 'Stress', 'Tech'] } as DrillProgression,
    coachingStrategy: { bottleneck: 'TBD', approach: 'Building foundation', calibration: 'Uncalibrated' } as CoachingStrategy,
    jobDashboard: null as JobDashboardData | null,
    isLoading: profileQuery.isLoading,
  };
}
