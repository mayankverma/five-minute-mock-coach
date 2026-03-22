import { useState } from 'react';

export interface Story {
  id: string;
  title: string;
  primarySkill: string;
  secondarySkill: string;
  earnedSecret: string;
  strength: number; // 1-5
  uses: number;
  status: 'improve' | 'view';
}

export interface Gap {
  severity: 'missing' | 'weak';
  description: string;
}

const MOCK_STORIES: Story[] = [
  {
    id: 'S001',
    title: 'Scaling Eng Org 8 to 27 Post-Layoffs',
    primarySkill: 'Team Building',
    secondarySkill: 'Change Mgmt',
    earnedSecret: 'Hiring during crisis builds loyalty',
    strength: 4,
    uses: 3,
    status: 'improve',
  },
  {
    id: 'S002',
    title: 'Voice AI Platform — 1M+ Calls/Month',
    primarySkill: 'Technical Vision',
    secondarySkill: 'Strategic Thinking',
    earnedSecret: 'Build vs buy flips at scale',
    strength: 5,
    uses: 5,
    status: 'view',
  },
  {
    id: 'S003',
    title: '$200M Marketplace Platform',
    primarySkill: 'Business Impact',
    secondarySkill: 'Cross-functional',
    earnedSecret: 'Finance data as competitive moat',
    strength: 4,
    uses: 2,
    status: 'improve',
  },
  {
    id: 'S004',
    title: 'LLM Solutions Saving $10M+',
    primarySkill: 'Innovation',
    secondarySkill: 'Cost Optimization',
    earnedSecret: 'LLM ROI requires infra, not models',
    strength: 4,
    uses: 1,
    status: 'improve',
  },
];

const MOCK_GAPS: Gap[] = [
  { severity: 'missing', description: 'Failure / learning story (critical for Director)' },
  { severity: 'missing', description: 'Conflict resolution story' },
  { severity: 'weak', description: 'Stakeholder management (S003 partially covers)' },
];

const NARRATIVE_IDENTITY =
  'Builder who scales through ambiguity. Takes broken/nascent systems and builds them into platforms. Each story shows progressively larger scope \u2014 from infra ($5M) to org (27 engineers) to business ($200M) to company strategy (voice AI).';

export function useStories() {
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [isLoading] = useState(false);

  const gaps: Gap[] = MOCK_GAPS;
  const narrativeIdentity: string = NARRATIVE_IDENTITY;

  const addStory = (_story: Partial<Story>) => {
    // No-op for now — will integrate with backend later
    setStories((prev) => prev);
  };

  return { stories, gaps, narrativeIdentity, addStory, isLoading };
}
