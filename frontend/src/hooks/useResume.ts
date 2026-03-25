import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export interface ResumeSection {
  id: string;
  resume_id: string;
  section_type: 'summary' | 'experience' | 'education' | 'skills' | 'certifications';
  sort_order: number;
  content: Record<string, any>;
  updated_at: string;
}

export interface ResumeAnalysis {
  id: string;
  resume_id: string;
  depth_level: string;
  overall_grade: string;
  ats_compatibility: string;
  recruiter_scan: string;
  bullet_quality: string;
  seniority_calibration: string;
  keyword_coverage: string;
  structure_layout: string;
  consistency_polish: string;
  concern_management: string;
  top_fixes: { severity: string; dimension: string; text: string; fix: string }[];
  concern_mitigations: { concern: string; mitigation_language: string }[];
  positioning_strengths: string;
  likely_concerns: string;
  career_narrative_gaps: string;
  story_seeds: { title: string; source_bullet: string; potential_skill: string }[];
  cross_surface_gaps: any[];
}

export interface Resume {
  id: string;
  user_id: string;
  job_id: string | null;
  name: string;
  original_file_name: string | null;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeData {
  resume: Resume | null;
  sections: ResumeSection[];
  analysis: ResumeAnalysis | null;
}

export function useResume() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ResumeData>({
    queryKey: ['resume', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/api/resume');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/resume/upload', formData, {
        timeout: 120000, // 2 min for AI analysis
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: Record<string, any> }) => {
      const { data } = await api.put(`/api/resume/sections/${sectionId}`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      const { data } = await api.delete(`/api/resume/${resumeId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      const { data } = await api.post(`/api/resume/${resumeId}/analyze`, {}, {
        timeout: 120000,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
    },
  });

  return {
    resume: query.data?.resume ?? null,
    sections: query.data?.sections ?? [],
    analysis: query.data?.analysis ?? null,
    isLoading: authLoading || query.isLoading,
    hasResume: !!query.data?.resume,
    upload: uploadMutation,
    updateSection,
    deleteResume: deleteMutation,
    analyze: analyzeMutation,
  };
}
