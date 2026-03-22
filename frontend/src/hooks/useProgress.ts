import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

/* ── Type definitions ── */

export interface ScoreHistoryPoint {
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
}

export interface Calibration {
  tendency: string;
  delta: number;
  latestScores: {
    substance: number;
    structure: number;
    relevance: number;
    credibility: number;
    differentiation: number;
  };
}

export interface PatternItem {
  detected: string;
  text: string;
}

export interface ProgressData {
  scoreHistory: ScoreHistoryPoint[];
  calibration: Calibration;
  effectivePatterns: PatternItem[];
  ineffectivePatterns: PatternItem[];
}

/* ── Mock data matching the reference HTML ── */

const mockData: ProgressData = {
  scoreHistory: [
    { substance: 3.0, structure: 2.5, relevance: 3.5, credibility: 3.0, differentiation: 2.0 },
    { substance: 3.3, structure: 3.0, relevance: 3.6, credibility: 3.2, differentiation: 2.3 },
    { substance: 3.6, structure: 3.2, relevance: 4.0, credibility: 3.5, differentiation: 2.5 },
    { substance: 3.8, structure: 3.5, relevance: 4.0, credibility: 3.7, differentiation: 3.0 },
    { substance: 4.1, structure: 3.8, relevance: 4.2, credibility: 4.0, differentiation: 3.2 },
    { substance: 4.3, structure: 4.0, relevance: 4.5, credibility: 4.2, differentiation: 3.5 },
  ],

  calibration: {
    tendency: 'Over-rater',
    delta: 0.8,
    latestScores: {
      substance: 4.3,
      structure: 4.0,
      relevance: 4.5,
      credibility: 4.2,
      differentiation: 3.5,
    },
  },

  effectivePatterns: [
    {
      detected: 'across 4 sessions',
      text: 'Leading with counterintuitive choices in prioritization stories consistently scores 4+ on Differentiation.',
    },
    {
      detected: 'across 3 sessions',
      text: 'Opening with a specific metric (\u201C1M calls/month\u201D) immediately anchors Credibility at 4+.',
    },
  ],

  ineffectivePatterns: [
    {
      detected: 'across 3 uses',
      text: 'Generic \u201CI aligned stakeholders\u201D language without naming the actual tension consistently scores below 3 on Differentiation.',
    },
    {
      detected: 'across 2 sessions',
      text: 'Answers exceeding 4 minutes lose Structure points \u2014 the narrative starts strong but meanders in the second half.',
    },
  ],
};

/* ── Hook ── */

async function fetchProgress(): Promise<ProgressData> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockData;
}

export function useProgress() {
  const [activeFilter, setFilter] = useState<string>('all');

  const query = useQuery({
    queryKey: ['progress'],
    queryFn: fetchProgress,
    staleTime: 5 * 60 * 1000,
  });

  return {
    scoreHistory: query.data?.scoreHistory ?? [],
    calibration: query.data?.calibration ?? null,
    effectivePatterns: query.data?.effectivePatterns ?? [],
    ineffectivePatterns: query.data?.ineffectivePatterns ?? [],
    activeFilter,
    setFilter,
    isLoading: query.isLoading,
  };
}
