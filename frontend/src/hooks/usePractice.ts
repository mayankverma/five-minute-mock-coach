import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

// ─── Type Definitions ────────────────────────────────────────────────────────

export type PracticeTier = 'atomic' | 'session' | 'round_prep';
export type PracticeMode = 'quick' | 'guided';
export type InputMode = 'voice' | 'text';
export type QuestionSource = 'bank' | 'job_specific' | 'story_specific' | 'resume_gap';

export interface PracticeQuestion {
  id: string;
  question_text: string;
  title: string;
  _source: QuestionSource;
  _source_detail: string;
  theme: string;
  variations: string[];
  difficulty: string;
}

export interface ScoreResult {
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
  presence: number | null;
  hire_signal: string;
  feedback: string;
  strongest_dimension: string;
  weakest_dimension: string;
  improvement_suggestion: string;
  coaching_bullets: string[];
  exemplar_answer: string | null;
  micro_drill: string | null;
}

export interface AttemptScore {
  attemptNumber: number;
  average: number;
  scores: ScoreResult;
}

export interface StageInfo {
  name: string;
  difficulty: string;
  gate_dim: string;
  gate_score: number;
  time_limit: number | null;
  include_followups: boolean;
}

export interface GateResult {
  passed: boolean;
  stage: number;
  gate_dim: string;
  gate_score: number;
  next_stage: number;
}

export interface DailyStats {
  today: { questions_answered: number };
  streak: number;
  practiced_today: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePractice() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<PracticeMode>('quick');
  const [tier, setTier] = useState<PracticeTier>('atomic');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attempts, setAttempts] = useState<AttemptScore[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [answerText, setAnswerText] = useState('');
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [gateResult, setGateResult] = useState<GateResult | null>(null);
  const [debrief, setDebrief] = useState<any | null>(null);
  const [usedVariations, setUsedVariations] = useState<string[]>([]);

  // ─── React Query ──────────────────────────────────────────────────────────
  const { data: progression } = useQuery({
    queryKey: ['practice', 'progression'],
    queryFn: async () => {
      const res = await api.get('/api/practice/guided/progression');
      return res.data;
    },
    enabled: mode === 'guided',
  });

  const { data: dailyStats } = useQuery<DailyStats>({
    queryKey: ['practice', 'daily'],
    queryFn: async () => {
      const res = await api.get('/api/practice/daily');
      return res.data;
    },
  });

  // ─── Actions ──────────────────────────────────────────────────────────────

  const startQuick = useCallback(async (opts?: {
    tier?: PracticeTier;
    workspace_id?: string;
    theme?: string;
    source_filter?: QuestionSource;
    round_id?: string;
    question_count?: number;
  }) => {
    try {
      const payload: Record<string, unknown> = {
        tier: opts?.tier ?? tier,
      };
      if (opts?.workspace_id) payload.workspace_id = opts.workspace_id;
      if (opts?.theme) payload.theme = opts.theme;
      if (opts?.source_filter) payload.source_filter = opts.source_filter;
      if (opts?.round_id) payload.round_id = opts.round_id;
      if (opts?.question_count) payload.question_count = opts.question_count;

      const res = await api.post('/api/practice/quick/start', payload);
      const { session_id, questions: qs } = res.data;

      setSessionId(session_id);
      setQuestions(qs);
      setCurrentQuestionIndex(0);
      setAttempts([]);
      setAnswerText('');
      setGateResult(null);
      setDebrief(null);
      setUsedVariations([]);
      setStageInfo(null);
      setMode('quick');
    } catch (err) {
      console.error('startQuick failed', err);
    }
  }, [tier]);

  const startGuided = useCallback(async (stage: number, opts?: { workspace_id?: string; question_count?: number }) => {
    try {
      const payload: Record<string, unknown> = { stage };
      if (opts?.workspace_id) payload.workspace_id = opts.workspace_id;
      if (opts?.question_count) payload.question_count = opts.question_count;

      const res = await api.post('/api/practice/guided/start', payload);
      const { session_id, questions: qs, stage_info } = res.data;

      setSessionId(session_id);
      setQuestions(qs);
      setCurrentQuestionIndex(0);
      setAttempts([]);
      setAnswerText('');
      setGateResult(null);
      setDebrief(null);
      setUsedVariations([]);
      setStageInfo(stage_info ?? null);
      setMode('guided');
    } catch (err) {
      console.error('startGuided failed', err);
    }
  }, []);

  const submitAnswer = useCallback(async () => {
    if (!sessionId || !questions[currentQuestionIndex]) return;

    const question = questions[currentQuestionIndex];
    const attemptNumber = attempts.length + 1;

    setIsScoring(true);
    try {
      const res = await api.post(`/api/practice/${sessionId}/submit`, {
        question_id: question.id,
        question_text: question.question_text,
        answer: answerText,
        input_mode: inputMode,
        attempt_number: attemptNumber,
      });

      const { scores, average, gate_result } = res.data;

      const newAttempt: AttemptScore = {
        attemptNumber,
        average,
        scores,
      };

      setAttempts((prev) => [...prev, newAttempt]);

      if (gate_result) {
        setGateResult(gate_result);
      }
    } catch (err) {
      console.error('submitAnswer failed', err);
    } finally {
      setIsScoring(false);
    }
  }, [sessionId, questions, currentQuestionIndex, attempts, answerText, inputMode]);

  const tryAgain = useCallback(() => {
    setAnswerText('');
  }, []);

  const shuffle = useCallback(async () => {
    if (!sessionId || !questions[currentQuestionIndex]) return;

    const question = questions[currentQuestionIndex];
    try {
      const res = await api.post(`/api/practice/${sessionId}/shuffle`, {
        question_id: question.id,
        question_text: question.question_text,
        used_variations: usedVariations,
      });

      const { variation } = res.data;

      setUsedVariations((prev) => [...prev, question.question_text]);

      setQuestions((prev) => {
        const updated = [...prev];
        updated[currentQuestionIndex] = {
          ...updated[currentQuestionIndex],
          question_text: variation,
        };
        return updated;
      });
    } catch (err) {
      console.error('shuffle failed', err);
    }
  }, [sessionId, questions, currentQuestionIndex, usedVariations]);

  const nextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => prev + 1);
    setAttempts([]);
    setAnswerText('');
    setGateResult(null);
    setUsedVariations([]);
  }, []);

  const endSession = useCallback(() => {
    setSessionId(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAttempts([]);
    setIsScoring(false);
    setAnswerText('');
    setStageInfo(null);
    setGateResult(null);
    setDebrief(null);
    setUsedVariations([]);
  }, []);

  const requestDebrief = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await api.post(`/api/practice/${sessionId}/debrief`, {});
      setDebrief(res.data);
    } catch (err) {
      console.error('requestDebrief failed', err);
    }
  }, [sessionId]);

  // ─── Return ───────────────────────────────────────────────────────────────
  return {
    // state
    mode,
    tier,
    sessionId,
    questions,
    currentQuestionIndex,
    currentQuestion: questions[currentQuestionIndex] ?? null,
    attempts,
    isScoring,
    inputMode,
    answerText,
    stageInfo,
    gateResult,
    debrief,
    usedVariations,
    // react query
    progression,
    dailyStats,
    // setters
    setMode,
    setTier,
    setInputMode,
    setAnswerText,
    // actions
    startQuick,
    startGuided,
    submitAnswer,
    tryAgain,
    shuffle,
    nextQuestion,
    endSession,
    requestDebrief,
  };
}
