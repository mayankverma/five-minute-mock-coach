import { useState, useCallback, useEffect, useRef } from 'react';

export interface CurrentQuestion {
  label: string;
  text: string;
  questionNumber: number;
  totalQuestions: number;
}

export interface ScorecardData {
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
  hireSignal: string;
  feedback: string;
}

const DRILL_STAGES = [
  'Ladder',
  'Pushback',
  'Pivot',
  'Gap',
  'Role',
  'Panel',
  'Stress',
  'Technical',
];

const DEFAULT_QUESTION: CurrentQuestion = {
  label: 'Question 1 of 3 — Leadership',
  text: 'Tell me about a time you had to rebuild a team during a period of significant organizational change.',
  questionNumber: 1,
  totalQuestions: 3,
};

const MOCK_SCORECARD: ScorecardData = {
  substance: 4.3,
  structure: 4.0,
  relevance: 4.5,
  credibility: 4.2,
  differentiation: 3.5,
  hireSignal: 'Strong Hire',
  feedback:
    'Excellent use of specific metrics and a clear STAR structure. The story demonstrated genuine leadership under pressure. Consider adding more about the long-term impact of the team rebuild to strengthen differentiation.',
};

export function usePractice() {
  const [currentStage, setCurrentStage] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion>(DEFAULT_QUESTION);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer: start/stop based on isRecording
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

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  const skipQuestion = useCallback(() => {
    setIsRecording(false);
    setElapsedSeconds(0);
    setCurrentQuestion((prev) => {
      const next = prev.questionNumber + 1;
      if (next > prev.totalQuestions) {
        return prev; // stay on last question
      }
      return {
        ...prev,
        label: `Question ${next} of ${prev.totalQuestions} — Leadership`,
        questionNumber: next,
      };
    });
  }, []);

  const submitAnswer = useCallback(() => {
    setIsRecording(false);
    setIsLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setScorecard(MOCK_SCORECARD);
      setIsLoading(false);
    }, 1200);
  }, []);

  return {
    drillStages: DRILL_STAGES,
    currentStage,
    currentQuestion,
    isRecording,
    elapsedSeconds,
    toggleRecording,
    skipQuestion,
    submitAnswer,
    scorecard,
    isLoading,
  };
}
