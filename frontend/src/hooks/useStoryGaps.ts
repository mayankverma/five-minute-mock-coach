import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export interface MappedStory {
  story_id: string;
  title: string;
  competency: string;
  fit_level: 'strong' | 'workable' | 'stretch';
}

export interface StoryGap {
  competency: string;
  severity: 'critical' | 'important' | 'nice_to_have';
  reason: string;
  handling_pattern: 'build_new' | 'reframe_existing' | 'adjacent_bridge' | 'growth_narrative';
  recommendation: string;
  closest_story: { id: string; title: string; fit_level: string } | null;
}

export interface GapAnalysis {
  mode: 'universal' | 'workspace';
  coverage_score: number;
  mapped_stories: MappedStory[];
  gaps: StoryGap[];
  concentration_risk: string | null;
}

async function fetchGaps(workspaceId?: string): Promise<GapAnalysis> {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
  const { data } = await api.get(`/api/stories/gaps${params}`);
  return data;
}

export function useStoryGaps(workspaceId?: string) {
  const { user, loading: authLoading } = useAuth();

  const gapsQuery = useQuery({
    queryKey: ['story-gaps', user?.id, workspaceId],
    queryFn: () => fetchGaps(workspaceId),
    staleTime: 60_000,
    enabled: !!user && !authLoading,
  });

  return {
    gapAnalysis: gapsQuery.data ?? null,
    isLoading: gapsQuery.isLoading,
    refetch: gapsQuery.refetch,
  };
}
