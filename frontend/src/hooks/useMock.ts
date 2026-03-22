import { useState, useCallback, useEffect, useRef } from 'react';

export interface MockFormat {
  id: string;
  emoji: string;
  name: string;
  description: string;
  totalQuestions: number;
  durationMin: number;
}

export interface MockQuestion {
  label: string;
  text: string;
  questionNumber: number;
  totalQuestions: number;
}

const MOCK_FORMATS: MockFormat[] = [
  {
    id: 'behavioral-screen',
    emoji: '\u{1F4AC}',
    name: 'Behavioral Screen',
    description: '4 questions, 30 min\nRecruiter-style',
    totalQuestions: 4,
    durationMin: 30,
  },
  {
    id: 'deep-behavioral',
    emoji: '\u{1F9E0}',
    name: 'Deep Behavioral',
    description: '6 questions, 45 min\nHiring manager depth',
    totalQuestions: 6,
    durationMin: 45,
  },
  {
    id: 'system-design',
    emoji: '\u{1F3AF}',
    name: 'System Design',
    description: 'Communication coaching\n60 min session',
    totalQuestions: 4,
    durationMin: 60,
  },
  {
    id: 'panel',
    emoji: '\u{1F465}',
    name: 'Panel',
    description: 'Multiple personas\n5 questions, 45 min',
    totalQuestions: 5,
    durationMin: 45,
  },
  {
    id: 'bar-raiser',
    emoji: '\u{26A1}',
    name: 'Bar Raiser',
    description: 'High-pressure\n6 questions, 50 min',
    totalQuestions: 6,
    durationMin: 50,
  },
  {
    id: 'technical-behavioral',
    emoji: '\u{1F504}',
    name: 'Technical + Behavioral',
    description: 'Mixed format\n5 questions, 45 min',
    totalQuestions: 5,
    durationMin: 45,
  },
];

const SAMPLE_QUESTIONS: Record<string, string[]> = {
  'behavioral-screen': [
    'Tell me about yourself and why you are interested in this role.',
    'Describe a time you had to influence a decision without having direct authority.',
    'Give me an example of a project where you had to deal with ambiguity.',
    'What is the most impactful thing you have accomplished in your career so far?',
  ],
  'deep-behavioral': [
    'Walk me through a time you had to rebuild trust with a key stakeholder after a major setback.',
    'Tell me about a time you made a difficult trade-off between speed and quality.',
    'Describe a situation where you had to lead through significant organizational change.',
    'Give me an example of when you had to deliver difficult feedback to a high performer.',
    'Tell me about a time your team failed to meet a critical deadline. What did you do?',
    'Describe how you have built and scaled a team from scratch.',
  ],
  'system-design': [
    'Design a real-time notification system that scales to millions of users.',
    'How would you architect a distributed job scheduling system?',
    'Walk me through designing a content recommendation engine.',
    'Design an API rate limiting service for a multi-tenant platform.',
  ],
  'panel': [
    'How do you prioritize competing requests from multiple stakeholders?',
    'Tell us about a time you drove alignment across engineering, product, and design.',
    'Describe your approach to building an inclusive team culture.',
    'Give an example of how you handled a major production incident.',
    'What is your philosophy on technical debt and how do you manage it?',
  ],
  'bar-raiser': [
    'Tell me about a time you had to make a critical decision with incomplete information under extreme time pressure.',
    'Describe a situation where you disagreed with your leadership and what you did about it.',
    'Give me an example of a time you had to pivot your entire strategy mid-execution.',
    'How have you handled a situation where a team member was consistently underperforming?',
    'Tell me about the most complex cross-functional initiative you have led.',
    'Describe a time when you had to say no to a senior leader. How did you handle it?',
  ],
  'technical-behavioral': [
    'Walk me through a complex system you designed and the key trade-offs you made.',
    'Tell me about a time you had to debug a critical production issue under pressure.',
    'How do you balance hands-on technical work with leadership responsibilities?',
    'Describe a time you introduced a new technology or practice to your organization.',
    'Give me an example of how you have mentored engineers to grow into senior roles.',
  ],
};

export function useMock() {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeFormat = MOCK_FORMATS.find((f) => f.id === selectedFormat) ?? null;

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

  const currentQuestion: MockQuestion | null =
    activeFormat && sessionActive
      ? {
          label: `Question ${currentQuestionIndex + 1} of ${activeFormat.totalQuestions} — ${activeFormat.name}`,
          text:
            SAMPLE_QUESTIONS[activeFormat.id]?.[currentQuestionIndex] ??
            'Tell me about a challenging situation you faced and how you handled it.',
          questionNumber: currentQuestionIndex + 1,
          totalQuestions: activeFormat.totalQuestions,
        }
      : null;

  const selectFormat = useCallback((id: string) => {
    setSelectedFormat(id);
  }, []);

  const startSession = useCallback(() => {
    setSessionActive(true);
    setCurrentQuestionIndex(0);
    setElapsedSeconds(0);
    setIsRecording(false);
    setIsLoading(false);
  }, []);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setSelectedFormat(null);
    setCurrentQuestionIndex(0);
    setElapsedSeconds(0);
    setIsRecording(false);
    setIsLoading(false);
  }, []);

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  const nextQuestion = useCallback(() => {
    if (!activeFormat) return;
    setIsRecording(false);
    setElapsedSeconds(0);
    if (currentQuestionIndex + 1 < activeFormat.totalQuestions) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [activeFormat, currentQuestionIndex]);

  const skipQuestion = useCallback(() => {
    nextQuestion();
  }, [nextQuestion]);

  return {
    formats: MOCK_FORMATS,
    selectedFormat,
    selectFormat,
    activeFormat,
    sessionActive,
    startSession,
    endSession,
    currentQuestion,
    isRecording,
    elapsedSeconds,
    toggleRecording,
    nextQuestion,
    skipQuestion,
    isLoading,
  };
}
