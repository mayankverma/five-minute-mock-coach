import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

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

async function fetchStories(): Promise<Story[]> {
  try {
    const { data } = await api.get('/api/stories');
    return (data || []).map((s: any) => ({
      id: s.id?.substring(0, 8) || s.id,
      title: s.title,
      primarySkill: s.primary_skill || '',
      secondarySkill: s.secondary_skill || '',
      earnedSecret: s.earned_secret || '',
      strength: s.strength || 3,
      uses: s.use_count || 0,
      status: (s.strength || 0) >= 5 ? 'view' as const : 'improve' as const,
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
    mutationFn: async (story: Partial<Story>) => {
      const { data } = await api.post('/api/stories', {
        title: story.title,
        primary_skill: story.primarySkill,
        secondary_skill: story.secondarySkill,
        earned_secret: story.earnedSecret,
        strength: story.strength,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  const addStory = (story: Partial<Story>) => {
    addMutation.mutate(story);
  };

  return {
    stories,
    gaps,
    narrativeIdentity,
    addStory,
    isLoading: authLoading || storiesQuery.isLoading,
  };
}
