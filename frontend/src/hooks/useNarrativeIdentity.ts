import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export interface CoreTheme {
  theme: string;
  description: string;
  story_ids: string[];
}

export interface OrphanStory {
  story_id: string;
  title: string;
  suggestion: string;
}

export interface NarrativeIdentity {
  core_themes: CoreTheme[];
  sharpest_edge: string;
  orphan_stories: OrphanStory[];
  fragile_themes: { theme: string; story_count: number }[];
  how_to_use: string;
}

async function fetchNarrative(): Promise<NarrativeIdentity | null> {
  try {
    const { data } = await api.get('/api/stories/narrative');
    return data?.narrative || data || null;
  } catch {
    return null;
  }
}

export function useNarrativeIdentity(storyCount: number) {
  const { user, loading: authLoading } = useAuth();

  const narrativeQuery = useQuery({
    queryKey: ['narrative-identity', user?.id],
    queryFn: fetchNarrative,
    staleTime: 5 * 60_000,
    enabled: !!user && !authLoading && storyCount >= 3,
  });

  return {
    narrative: narrativeQuery.data ?? null,
    isLoading: narrativeQuery.isLoading,
  };
}
