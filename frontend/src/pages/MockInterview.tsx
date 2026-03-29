import './pages.css';
import { useMock } from '../hooks/useMock';
import type { QuestionDebrief } from '../hooks/useMock';
import { useState } from 'react';

const HIRE_SIGNAL_COLOR: Record<string, string> = {
  'Strong Hire': 'tag-green',
  Hire: 'tag-green',
  'Lean Hire': 'tag-yellow',
  'No Hire': 'tag-red',
  'Strong No Hire': 'tag-red',
};

function hireSignalClass(signal: string): string {
  return HIRE_SIGNAL_COLOR[signal] ?? 'tag-primary';
}

const DIMENSIONS: { key: keyof QuestionDebrief['scores']; label: string; color: string }[] = [
  { key: 'substance', label: 'Substance', color: 'var(--c-substance)' },
  { key: 'structure', label: 'Structure', color: 'var(--c-structure)' },
  { key: 'relevance', label: 'Relevance', color: 'var(--c-relevance)' },
  { key: 'credibility', label: 'Credibility', color: 'var(--c-credibility)' },
  { key: 'differentiation', label: 'Differentiation', color: 'var(--c-differentiation)' },
];

export function MockInterview() {
  const {
    formats,
    activeFormat,
    sessionActive,
    currentQuestion,
    questions,
    currentQuestionIndex,
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
    endSession,
    requestDebrief,
    toggleRecording,
    setAnswerText,
    setInputMode,
  } = useMock();

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const isLastQuestion = currentQuestion
    ? currentQuestion.question_number === currentQuestion.total_questions
    : false;

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- Debrief View ---
  if (debrief) {
    const overallClass = hireSignalClass(debrief.overall_hire_signal);
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
            Interview Debrief
          </h1>
          <p className="page-subtitle">Full evaluation of your mock interview session.</p>
        </div>

        {/* Overall Signal */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              Overall Hire Signal
            </div>
            <span
              className={`tag ${overallClass}`}
              style={{ fontSize: 20, fontWeight: 700, padding: '6px 18px' }}
            >
              {debrief.overall_hire_signal}
            </span>
          </div>
        </div>

        {/* Per-question scores */}
        <div style={{ marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 10,
            }}
          >
            Question Scores
          </h2>
          {debrief.question_debriefs.map((qd) => {
            const signalClass = hireSignalClass(qd.hire_signal);
            const avg =
              (qd.scores.substance +
                qd.scores.structure +
                qd.scores.relevance +
                qd.scores.credibility +
                qd.scores.differentiation) /
              5;
            return (
              <div key={qd.question_id} className="card" style={{ marginBottom: 10 }}>
                <div className="card-header">
                  <span className="card-title" style={{ fontSize: 13 }}>
                    Q{qd.question_number}: {qd.question_text}
                  </span>
                  <span className={`tag ${signalClass}`} style={{ flexShrink: 0 }}>
                    {qd.hire_signal}
                  </span>
                </div>
                <div className="card-body">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div
                        style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}
                      >
                        {avg.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ 5</div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                      {qd.feedback}
                    </p>
                  </div>
                  <div className="score-dims">
                    {DIMENSIONS.map((dim) => {
                      const value = qd.scores[dim.key];
                      return (
                        <div className="score-dim" key={dim.key}>
                          <span className="score-dim-label">{dim.label}</span>
                          <div className="score-dim-bar">
                            <div
                              className="score-dim-fill"
                              style={{
                                width: `${(value / 5) * 100}%`,
                                background: dim.color,
                              }}
                            />
                          </div>
                          <span className="score-dim-val">{value.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Analysis sections */}
        <div className="card-grid card-grid-3" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Arc Analysis</span>
            </div>
            <div className="card-body">
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                {debrief.arc_analysis}
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Story Diversity</span>
            </div>
            <div className="card-body">
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                {debrief.story_diversity}
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Holistic Patterns</span>
            </div>
            <div className="card-body">
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                {debrief.holistic_patterns}
              </p>
            </div>
          </div>
        </div>

        {/* Interviewer's inner monologue */}
        <div
          className="card"
          style={{ marginBottom: 16, borderColor: 'var(--primary)', background: 'var(--bg-highlight, #f0f4ff)' }}
        >
          <div className="card-header">
            <span className="card-title">Interviewer's Inner Monologue</span>
          </div>
          <div className="card-body">
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
              }}
            >
              {debrief.interviewers_inner_monologue}
            </p>
          </div>
        </div>

        {/* Top 3 changes */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Top 3 Changes to Make</span>
          </div>
          <div className="card-body">
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {debrief.top_3_changes.map((change, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginBottom: i < debrief.top_3_changes.length - 1 ? 8 : 0,
                  }}
                >
                  {change}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <button className="btn btn-outline" onClick={endSession}>
          Back to Formats
        </button>
      </div>
    );
  }

  // --- Session Active View ---
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
            {activeFormat.name} — Question {currentQuestion.question_number} of{' '}
            {currentQuestion.total_questions}
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{activeFormat.name} Interview</span>
            <span className="tag tag-primary">
              {currentQuestion.question_number} / {currentQuestion.total_questions}
            </span>
          </div>
          <div className="card-body">
            {/* Progress bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
              {Array.from({ length: currentQuestion.total_questions }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background:
                      i < currentQuestion.question_number
                        ? 'var(--primary)'
                        : 'var(--border)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>

            {/* Question text */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                {currentQuestion.label}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                {currentQuestion.text}
              </div>
            </div>

            {/* Input mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                className={`btn btn-sm ${inputMode === 'text' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInputMode('text')}
              >
                Text
              </button>
              <button
                className={`btn btn-sm ${inputMode === 'voice' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInputMode('voice')}
              >
                Voice
              </button>
            </div>

            {inputMode === 'text' ? (
              <textarea
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: '10px 12px',
                  fontSize: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-input, #fff)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  marginBottom: 12,
                }}
                placeholder="Type your answer here..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                  padding: '16px 0',
                }}
              >
                <button
                  className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
                  onClick={toggleRecording}
                  style={{ minWidth: 140 }}
                >
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
                {(isRecording || elapsedSeconds > 0) && (
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: isRecording ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  >
                    {formatElapsed(elapsedSeconds)}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={submitAnswer}
                disabled={isSubmitting || (!answerText.trim() && inputMode === 'text')}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={skipQuestion}>
                Skip
              </button>
              {isLastQuestion ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={requestDebrief}
                  disabled={isLoadingDebrief}
                >
                  {isLoadingDebrief ? 'Loading Debrief...' : 'Finish & Get Debrief'}
                </button>
              ) : null}
              <button
                className="btn btn-outline btn-sm"
                style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}
                onClick={requestDebrief}
                disabled={isLoadingDebrief}
              >
                {isLoadingDebrief ? 'Loading...' : 'End & Get Debrief'}
              </button>
            </div>

            {/* Question list preview */}
            {questions.length > 0 && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  Questions
                </div>
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    style={{
                      fontSize: 13,
                      color:
                        i === currentQuestionIndex
                          ? 'var(--primary)'
                          : i < currentQuestionIndex
                          ? 'var(--text-muted)'
                          : 'var(--text-secondary)',
                      fontWeight: i === currentQuestionIndex ? 600 : 400,
                      marginBottom: 4,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ flexShrink: 0, width: 20 }}>{i + 1}.</span>
                    <span>{q.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Format Selection View ---
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
          Full simulated interview with real questions. Choose a format to begin.
        </p>
      </div>

      <div className="card-grid card-grid-3" style={{ marginBottom: 14 }}>
        {formats.map((format) => {
          const isSelected = activeFormat?.id === format.id;
          return (
            <div
              key={format.id}
              className="card"
              style={{
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                borderColor:
                  isSelected
                    ? 'var(--primary)'
                    : hoveredCard === format.id
                    ? 'var(--primary)'
                    : 'var(--border-light)',
                background: isSelected ? 'var(--bg-selected, #f0f4ff)' : undefined,
              }}
              onMouseEnter={() => setHoveredCard(format.id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => selectFormat(format.id)}
            >
              <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{format.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {format.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {format.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {format.totalQuestions} questions · {format.durationMin} min
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeFormat && (
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={startSession} style={{ minWidth: 200 }}>
            Start {activeFormat.name} Interview
          </button>
        </div>
      )}
    </div>
  );
}
