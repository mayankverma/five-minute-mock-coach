import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../lib/api';

export interface MockFormat {
  id: string;
  emoji: string;
  name: string;
  description: string;
  totalQuestions: number;
  durationMin: number;
}

export interface MockQuestion {
  id: string;
  text: string;
  question_number: number;
  total_questions: number;
  label: string;
}

export type InputMode = 'text' | 'voice';

export interface DimensionScores {
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
}

export interface QuestionDebrief {
  question_id: string;
  question_text: string;
  question_number: number;
  scores: DimensionScores;
  feedback: string;
  hire_signal: string;
}

export interface Debrief {
  session_id: string;
  overall_hire_signal: string;
  question_debriefs: QuestionDebrief[];
  arc_analysis: string;
  story_diversity: string;
  holistic_patterns: string;
  interviewers_inner_monologue: string;
  top_3_changes: string[];
}

const MOCK_FORMATS: MockFormat[] = [
  {
    id: 'behavioral_screen',
    emoji: '💬',
    name: 'Behavioral Screen',
    description: 'Recruiter-style assessment',
    totalQuestions: 4,
    durationMin: 30,
  },
  {
    id: 'deep_behavioral',
    emoji: '🧠',
    name: 'Deep Behavioral',
    description: 'Hiring manager depth',
    totalQuestions: 6,
    durationMin: 45,
  },
  {
    id: 'system_design',
    emoji: '🎯',
    name: 'System Design',
    description: 'Communication-focused',
    totalQuestions: 4,
    durationMin: 60,
  },
  {
    id: 'panel',
    emoji: '👥',
    name: 'Panel',
    description: 'Multiple personas',
    totalQuestions: 5,
    durationMin: 45,
  },
  {
    id: 'bar_raiser',
    emoji: '⚡',
    name: 'Bar Raiser',
    description: 'High-pressure',
    totalQuestions: 6,
    durationMin: 50,
  },
  {
    id: 'tech_behavioral',
    emoji: '🔄',
    name: 'Technical + Behavioral',
    description: 'Mixed format',
    totalQuestions: 5,
    durationMin: 45,
  },
];

export function useMock() {
  const [activeFormat, setActiveFormat] = useState<MockFormat | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [isLoadingDebrief, setIsLoadingDebrief] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const currentQuestion: MockQuestion | null = questions[currentQuestionIndex] ?? null;

  const selectFormat = useCallback((id: string) => {
    const format = MOCK_FORMATS.find((f) => f.id === id) ?? null;
    setActiveFormat(format);
  }, []);

  const startSession = useCallback(async () => {
    if (!activeFormat) return;
    try {
      const response = await api.post('/api/mock/start', {
        format_id: activeFormat.id,
      });
      const data = response.data;
      const rawQuestions = data.questions ?? [];
      const total = rawQuestions.length;
      const mapped: MockQuestion[] = rawQuestions.map(
        (q: { id?: string; text?: string; question_number?: number }, idx: number) => ({
          id: q.id ?? String(idx),
          text: q.text ?? '',
          question_number: q.question_number ?? idx + 1,
          total_questions: total,
          label: `Question ${q.question_number ?? idx + 1} of ${total} — ${activeFormat.name}`,
        })
      );
      setSessionId(data.session_id);
      setQuestions(mapped);
      setCurrentQuestionIndex(0);
      setAnswerText('');
      setElapsedSeconds(0);
      setIsRecording(false);
      setDebrief(null);
      setSessionActive(true);
    } catch (err) {
      console.error('Failed to start session', err);
    }
  }, [activeFormat]);

  const submitAnswer = useCallback(async () => {
    if (!sessionId || !currentQuestion) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/mock/${sessionId}/submit`, {
        question_id: currentQuestion.id,
        question_text: currentQuestion.text,
        answer: answerText,
        input_mode: inputMode,
        question_number: currentQuestion.question_number,
      });
    } catch (err) {
      console.error('Failed to submit answer', err);
    } finally {
      setIsSubmitting(false);
    }
    setAnswerText('');
    setElapsedSeconds(0);
    setIsRecording(false);
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [sessionId, currentQuestion, answerText, inputMode, currentQuestionIndex, questions.length]);

  const skipQuestion = useCallback(() => {
    setAnswerText('');
    setElapsedSeconds(0);
    setIsRecording(false);
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions.length]);

  const nextQuestion = useCallback(() => {
    setAnswerText('');
    setElapsedSeconds(0);
    setIsRecording(false);
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions.length]);

  const requestDebrief = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingDebrief(true);
    try {
      const response = await api.post(`/api/mock/${sessionId}/debrief`);
      setDebrief(response.data);
    } catch (err) {
      console.error('Failed to load debrief', err);
    } finally {
      setIsLoadingDebrief(false);
    }
  }, [sessionId]);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setSessionId(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswerText('');
    setElapsedSeconds(0);
    setIsRecording(false);
    setIsSubmitting(false);
    setDebrief(null);
    setIsLoadingDebrief(false);
  }, []);

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  return {
    formats: MOCK_FORMATS,
    activeFormat,
    sessionActive,
    sessionId,
    questions,
    currentQuestionIndex,
    currentQuestion,
    isRecording,
    elapsedSeconds,
    answerText,
    inputMode,
    isSubmitting,
    debrief,
    isLoadingDebrief,
    selectFormat,
    startSession,
    submitAnswer,
    skipQuestion,
    nextQuestion,
    endSession,
    requestDebrief,
    toggleRecording,
    setAnswerText,
    setInputMode,
  };
}
