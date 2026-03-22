import './pages.css';
import { useMock } from '../hooks/useMock';
import { MockSession } from '../components/MockSession';
import { useState } from 'react';

export function MockInterview() {
  const {
    formats,
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
  } = useMock();

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Select a format and immediately start the session
  const handleSelectFormat = (id: string) => {
    selectFormat(id);
    // startSession runs on next tick so selectedFormat state is set first
    setTimeout(() => startSession(), 0);
  };

  // Session active view
  if (sessionActive && activeFormat && currentQuestion) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
            </svg>
            Mock Interview
          </h1>
          <p className="page-subtitle">
            {activeFormat.name} — Question {currentQuestion.questionNumber} of{' '}
            {currentQuestion.totalQuestions}
          </p>
        </div>

        <MockSession
          format={activeFormat}
          currentQuestion={currentQuestion}
          isRecording={isRecording}
          elapsedSeconds={elapsedSeconds}
          onToggleRecording={toggleRecording}
          onSkip={skipQuestion}
          onNext={nextQuestion}
          onEnd={endSession}
        />
      </div>
    );
  }

  // Format selector view
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <svg
            className="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
          </svg>
          Mock Interview
        </h1>
        <p className="page-subtitle">
          Full simulated interview with voice. Choose a format to begin.
        </p>
      </div>

      <div className="card-grid card-grid-3" style={{ marginBottom: 14 }}>
        {formats.map((format) => (
          <div
            key={format.id}
            className="card"
            style={{
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              borderColor:
                hoveredCard === format.id
                  ? 'var(--primary)'
                  : 'var(--border-light)',
            }}
            onMouseEnter={() => setHoveredCard(format.id)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleSelectFormat(format.id)}
          >
            <div
              className="card-body"
              style={{ textAlign: 'center', padding: 24 }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                {format.emoji}
              </div>
              <div
                style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}
              >
                {format.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                {format.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
