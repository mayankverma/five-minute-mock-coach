import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export interface Story {
  id: string;
  fullId: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  primarySkill: string;
  secondarySkill: string;
  earnedSecret: string;
  strength: number; // 1-5
  uses: number;
  domain: string;
  deployFor: string;
  status: 'improve' | 'view';
  updatedAt: string;
}

export interface Gap {
  severity: 'missing' | 'weak';
  description: string;
}

async function fetchStories(): Promise<Story[]> {
  try {
    const { data } = await api.get('/api/stories');
    const stories = data?.stories || data || [];
    return (Array.isArray(stories) ? stories : []).map((s: any) => ({
      id: s.id?.substring(0, 8) || s.id,
      fullId: s.id,
      title: s.title,
      situation: s.situation || '',
      task: s.task || '',
      action: s.action || '',
      result: s.result || '',
      primarySkill: s.primary_skill || '',
      secondarySkill: s.secondary_skill || '',
      earnedSecret: s.earned_secret || '',
      strength: s.strength || 3,
      uses: s.use_count || 0,
      domain: s.domain || '',
      deployFor: s.deploy_for || '',
      status: (s.strength || 0) >= 5 ? 'view' as const : 'improve' as const,
      updatedAt: s.updated_at || s.created_at || '',
    }));
  } catch {
    return [];
  }
}

export function useStories() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const storiesQuery = useQuery({
    queryKey: ['stories', user?.id],
    queryFn: fetchStories,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const stories = storiesQuery.data ?? [];

  // Gaps are empty until we have stories — will be computed by AI later
  const gaps: Gap[] = [];
  const narrativeIdentity = '';

  const addMutation = useMutation({
    mutationFn: async (story: Record<string, unknown>) => {
      const { data } = await api.post('/api/stories', {
        title: story.title,
        situation: story.situation,
        task: story.task,
        action: story.action,
        result: story.result,
        primary_skill: story.primarySkill,
        secondary_skill: story.secondarySkill,
        earned_secret: story.earnedSecret,
        strength: story.strength,
        domain: story.domain,
        deploy_for: story.deployFor,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  const addStory = (story: Record<string, unknown>) => {
    addMutation.mutate(story);
  };

  const deleteMutation = useMutation({
    mutationFn: async (storyId: string) => {
      await api.delete(`/api/stories/${storyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  const deleteStory = (storyId: string) => {
    deleteMutation.mutate(storyId);
  };

  return {
    stories,
    gaps,
    narrativeIdentity,
    addStory,
    deleteStory,
    isLoading: authLoading || storiesQuery.isLoading,
  };
}
