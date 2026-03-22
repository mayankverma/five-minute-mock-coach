import '../pages/pages.css';
import { VoiceRecorder } from './VoiceRecorder';
import type { MockFormat, MockQuestion } from '../hooks/useMock';

interface MockSessionProps {
  format: MockFormat;
  currentQuestion: MockQuestion;
  isRecording: boolean;
  elapsedSeconds: number;
  onToggleRecording: () => void;
  onSkip: () => void;
  onNext: () => void;
  onEnd: () => void;
}

export function MockSession({
  format,
  currentQuestion,
  isRecording,
  elapsedSeconds,
  onToggleRecording,
  onSkip,
  onNext,
  onEnd,
}: MockSessionProps) {
  const isLastQuestion =
    currentQuestion.questionNumber === currentQuestion.totalQuestions;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <svg
            className="icon"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="1" width="6" height="10" rx="3" />
            <path d="M3 8a6 6 0 0 0 12 0" />
            <line x1="9" y1="14" x2="9" y2="17" />
            <line x1="6" y1="17" x2="12" y2="17" />
          </svg>
          {format.name} Interview
        </span>
        <span className="tag tag-primary">
          {currentQuestion.questionNumber} / {currentQuestion.totalQuestions}
        </span>
      </div>
      <div className="card-body">
        {/* Progress indicator */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 20,
          }}
        >
          {Array.from({ length: currentQuestion.totalQuestions }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background:
                  i < currentQuestion.questionNumber
                    ? 'var(--primary)'
                    : 'var(--border)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <div className="voice-area">
          {/* Question Display */}
          <div className="voice-question">
            <div className="voice-question-label">{currentQuestion.label}</div>
            <div className="voice-question-text">{currentQuestion.text}</div>
          </div>

          {/* Voice Recorder */}
          <VoiceRecorder
            isRecording={isRecording}
            onToggle={onToggleRecording}
            elapsedSeconds={elapsedSeconds}
          />

          {/* Controls */}
          <div className="voice-controls">
            <button className="btn btn-outline btn-sm" onClick={onSkip}>
              Skip
            </button>
            {!isLastQuestion ? (
              <button className="btn btn-primary btn-sm" onClick={onNext}>
                Next Question
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={onEnd}>
                Finish Interview
              </button>
            )}
          </div>

          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: 8, color: 'var(--text-muted)' }}
            onClick={onEnd}
          >
            End Interview Early
          </button>
        </div>
      </div>
    </div>
  );
}
