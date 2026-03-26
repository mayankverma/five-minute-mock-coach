import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  created_at?: string;
}

export function useStoryGaps(workspaceId?: string) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // GET — reads from cache (instant)
  const gapsQuery = useQuery<GapAnalysis | null>({
    queryKey: ['story-gaps', user?.id, workspaceId],
    queryFn: async () => {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const { data } = await api.get(`/api/stories/gaps${params}`);
      return data;
    },
    staleTime: 5 * 60_000,
    enabled: !!user && !authLoading,
  });

  // POST — triggers AI analysis, caches result
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const { data } = await api.post(`/api/stories/gaps/analyze${params}`, {}, {
        timeout: 120000,
      });
      return data as GapAnalysis;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['story-gaps', user?.id, workspaceId], data);
    },
  });

  return {
    gapAnalysis: gapsQuery.data ?? null,
    isLoading: gapsQuery.isLoading,
    refetch: gapsQuery.refetch,
    analyze: analyzeMutation,
    isAnalyzing: analyzeMutation.isPending,
  };
}
