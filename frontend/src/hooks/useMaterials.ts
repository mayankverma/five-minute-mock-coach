import { useState } from 'react';

export type MaterialTab = 'resume' | 'linkedin' | 'pitch' | 'outreach' | 'salary';

export interface ResumeFix {
  severity: 'red' | 'amber' | 'neutral';
  text: string;
}

export interface ResumeData {
  grade: string;
  dimensions: {
    ats: string;
    recruiterScan: string;
    bulletQuality: string;
    seniority: string;
    keywords: string;
  };
  topFixes: ResumeFix[];
}

export interface PitchData {
  hook10s: string;
  fullStatement: string;
}

const MOCK_RESUME: ResumeData = {
  grade: 'B+',
  dimensions: {
    ats: 'Ready',
    recruiterScan: 'Strong',
    bulletQuality: 'Moderate',
    seniority: 'Aligned',
    keywords: 'Moderate',
  },
  topFixes: [
    {
      severity: 'red',
      text: 'DoorDash bullets lack quantification \u2014 add call volume, cost savings, timeline',
    },
    {
      severity: 'amber',
      text: 'Missing "Director-level" language \u2014 add strategy, portfolio, executive stakeholders',
    },
    {
      severity: 'neutral',
      text: 'Add a 2-line summary that anchors your positioning statement',
    },
  ],
};

const MOCK_PITCH: PitchData = {
  hook10s:
    '\u201CI build AI platforms that replace entire vendor ecosystems \u2014 my latest handles a million support calls a month at half the cost.\u201D',
  fullStatement:
    '\u201CI\u2019m an engineering leader who specializes in taking nascent AI capabilities and turning them into production platforms at scale. At DoorDash, I built a voice AI system from scratch that now handles over a million customer support calls monthly \u2014 50% cheaper than the vendor it replaced, with 25% fewer escalations. Before that, I spent 5 years at Lyft scaling a marketplace engineering org from 8 to 27 engineers across 4 countries, owning a $200M revenue platform. I\u2019m looking for a Director role where I can apply that same build-and-scale pattern to a bigger canvas.\u201D',
};

export function useMaterials(initialTab: MaterialTab = 'resume') {
  const [activeTab, setActiveTab] = useState<MaterialTab>(initialTab);
  const [isLoading] = useState(false);

  const resume: ResumeData = MOCK_RESUME;
  const linkedin: null = null;
  const pitch: PitchData = MOCK_PITCH;
  const outreach: null = null;
  const salary: null = null;

  return {
    activeTab,
    setActiveTab,
    resume,
    linkedin,
    pitch,
    outreach,
    salary,
    isLoading,
  };
}
