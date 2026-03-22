import './pages.css';
import { usePractice } from '../hooks/usePractice';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { Scorecard } from '../components/Scorecard';

export function Practice() {
  const {
    drillStages,
    currentStage,
    currentQuestion,
    isRecording,
    elapsedSeconds,
    toggleRecording,
    skipQuestion,
    submitAnswer,
    scorecard,
    isLoading,
  } = usePractice();

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <svg className="icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="7" />
            <circle cx="9" cy="9" r="4" />
            <circle cx="9" cy="9" r="1" />
          </svg>
          Practice
        </h1>
        <p className="page-subtitle">
          8-stage drill system with 5-dimension scoring and interviewer perspective.
        </p>
      </div>

      {/* Drill Progression Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">Drill Progression</span>
        </div>
        <div className="card-body">
          <div className="stepper">
            {drillStages.map((stage, idx) => {
              const stepNum = idx + 1;
              const isActive = stepNum === currentStage;
              const isDone = stepNum < currentStage;
              const className = `step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`;
              return (
                <div className={className} key={stage}>
                  <div className="step-dot">{stepNum}</div>
                  <div className="step-label">{stage}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Practice Session Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <svg className="icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="1" width="6" height="10" rx="3" />
              <path d="M3 8a6 6 0 0 0 12 0" />
              <line x1="9" y1="14" x2="9" y2="17" />
              <line x1="6" y1="17" x2="12" y2="17" />
            </svg>
            Practice Session
          </span>
        </div>
        <div className="card-body">
          {scorecard ? (
            <Scorecard
              scores={{
                substance: scorecard.substance,
                structure: scorecard.structure,
                relevance: scorecard.relevance,
                credibility: scorecard.credibility,
                differentiation: scorecard.differentiation,
              }}
              hireSignal={scorecard.hireSignal}
              feedback={scorecard.feedback}
            />
          ) : (
            <div className="voice-area">
              {/* Question Display */}
              <div className="voice-question">
                <div className="voice-question-label">{currentQuestion.label}</div>
                <div className="voice-question-text">{currentQuestion.text}</div>
              </div>

              {/* Voice Recorder */}
              <VoiceRecorder
                isRecording={isRecording}
                onToggle={toggleRecording}
                elapsedSeconds={elapsedSeconds}
              />

              {/* Controls */}
              <div className="voice-controls">
                <button className="btn btn-outline btn-sm" onClick={skipQuestion}>
                  Skip
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={submitAnswer}
                  disabled={isLoading}
                >
                  {isLoading ? 'Scoring...' : 'Submit Answer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
