import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface StarredEntry {
  question_id: string;
  source: string;
}

export function useStarredQuestions() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['questions', 'starred'],
    queryFn: async () => {
      const res = await api.get('/api/questions/starred');
      const entries: StarredEntry[] = res.data.starred || [];
      return new Set(entries.map((s) => s.question_id));
    },
    staleTime: 5 * 60 * 1000,
  });

  const starredIds = data ?? new Set<string>();

  const toggleStar = useCallback(
    async (questionId: string, source = 'bank') => {
      const isCurrentlyStarred = starredIds.has(questionId);

      // Optimistic update
      queryClient.setQueryData(['questions', 'starred'], (old: Set<string> | undefined) => {
        const next = new Set(old);
        if (isCurrentlyStarred) {
          next.delete(questionId);
        } else {
          next.add(questionId);
        }
        return next;
      });

      try {
        if (isCurrentlyStarred) {
          await api.delete('/api/questions/star', {
            data: { question_id: questionId, source },
          });
        } else {
          await api.post('/api/questions/star', {
            question_id: questionId,
            source,
          });
        }
        // Invalidate preview queries so starred-first sorting updates
        queryClient.invalidateQueries({ queryKey: ['practice', 'quick-preview'] });
      } catch {
        // Revert optimistic update on failure
        queryClient.invalidateQueries({ queryKey: ['questions', 'starred'] });
      }
    },
    [starredIds, queryClient],
  );

  const isStarred = useCallback(
    (questionId: string) => starredIds.has(questionId),
    [starredIds],
  );

  return { starredIds, toggleStar, isStarred };
}
