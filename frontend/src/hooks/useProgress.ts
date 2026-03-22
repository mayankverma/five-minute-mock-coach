import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

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
  calibration: Calibration | null;
  effectivePatterns: PatternItem[];
  ineffectivePatterns: PatternItem[];
}

/* ── Hook ── */

async function fetchProgress(): Promise<ProgressData> {
  try {
    const { data } = await api.get('/api/progress');
    return {
      scoreHistory: (data.scores || []).map((s: any) => ({
        substance: s.substance,
        structure: s.structure,
        relevance: s.relevance,
        credibility: s.credibility,
        differentiation: s.differentiation,
      })),
      calibration: data.calibration || null,
      effectivePatterns: (data.effective_patterns || []).map((p: any) => ({
        detected: p.evidence || '',
        text: p.description || '',
      })),
      ineffectivePatterns: (data.ineffective_patterns || []).map((p: any) => ({
        detected: p.evidence || '',
        text: p.description || '',
      })),
    };
  } catch {
    return { scoreHistory: [], calibration: null, effectivePatterns: [], ineffectivePatterns: [] };
  }
}

export function useProgress() {
  const { user, loading: authLoading } = useAuth();
  const [activeFilter, setFilter] = useState<string>('all');

  const query = useQuery({
    queryKey: ['progress', user?.id],
    queryFn: fetchProgress,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  return {
    scoreHistory: query.data?.scoreHistory ?? [],
    calibration: query.data?.calibration ?? null,
    effectivePatterns: query.data?.effectivePatterns ?? [],
    ineffectivePatterns: query.data?.ineffectivePatterns ?? [],
    activeFilter,
    setFilter,
    isLoading: authLoading || query.isLoading,
  };
}
