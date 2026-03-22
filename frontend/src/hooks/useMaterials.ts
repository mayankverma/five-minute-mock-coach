import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

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

async function fetchMaterials() {
  try {
    const { data } = await api.get('/api/materials/resume');
    return data;
  } catch {
    return null;
  }
}

async function fetchPitch() {
  try {
    const { data } = await api.get('/api/materials/pitch');
    return data;
  } catch {
    return null;
  }
}

export function useMaterials(initialTab: MaterialTab = 'resume') {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<MaterialTab>(initialTab);

  const resumeQuery = useQuery({
    queryKey: ['resume', user?.id],
    queryFn: fetchMaterials,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const pitchQuery = useQuery({
    queryKey: ['pitch', user?.id],
    queryFn: fetchPitch,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const rawResume = resumeQuery.data;
  const resume: ResumeData | null = rawResume ? {
    grade: rawResume.overall || 'N/A',
    dimensions: {
      ats: rawResume.ats_compatibility || 'Not assessed',
      recruiterScan: rawResume.recruiter_scan || 'Not assessed',
      bulletQuality: rawResume.bullet_quality || 'Not assessed',
      seniority: rawResume.seniority_calibration || 'Not assessed',
      keywords: rawResume.keyword_coverage || 'Not assessed',
    },
    topFixes: (rawResume.top_fixes || []).map((f: any) => ({
      severity: f.severity || 'neutral',
      text: f.text || f,
    })),
  } : null;

  const rawPitch = pitchQuery.data;
  const pitch: PitchData | null = rawPitch?.core_statement ? {
    hook10s: rawPitch.hook_10s || '',
    fullStatement: rawPitch.core_statement || '',
  } : null;

  return {
    activeTab,
    setActiveTab,
    resume,
    linkedin: null,
    pitch,
    outreach: null,
    salary: null,
    isLoading: authLoading || resumeQuery.isLoading,
  };
}
