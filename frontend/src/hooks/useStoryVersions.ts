import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export interface StoryVersion {
  id: string;
  version_num: number;
  fields: Record<string, unknown>;
  change_summary: string | null;
  created_at: string;
  session_id: string | null;
}

async function fetchVersions(storyId: string): Promise<StoryVersion[]> {
  try {
    const { data } = await api.get(`/api/stories/${storyId}/versions`);
    return data?.versions || [];
  } catch {
    return [];
  }
}

export function useStoryVersions(storyId?: string) {
  const { user, loading: authLoading } = useAuth();

  const versionsQuery = useQuery({
    queryKey: ['story-versions', storyId],
    queryFn: () => fetchVersions(storyId!),
    staleTime: 30_000,
    enabled: !!storyId && !!user && !authLoading,
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    refetch: versionsQuery.refetch,
  };
}
