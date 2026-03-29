import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import './pages.css';
import { usePractice } from '../hooks/usePractice';
import type { PracticeTier, PracticeMode, QuestionSource } from '../hooks/usePractice';
import { useStarredQuestions } from '../hooks/useStarredQuestions';
import { Scorecard } from '../components/Scorecard';
import { SourceIndicator } from '../components/SourceIndicator';
import api from '../lib/api';

const THEME_OPTIONS = [
  'All',
  'leadership',
  'teamwork',
  'communication',
  'execution',
  'innovation',
  'adaptability',
  'problem_solving',
  'conflict_resolution',
  'self_awareness',
  'customer_focus',
  'motivation',
  'ethics',
];

const STAGE_NAMES: Record<number, string> = {
  1: 'Ladder',
  2: 'Pushback',
  3: 'Pivot',
  4: 'Gap',
  5: 'Role',
  6: 'Panel',
  7: 'Stress',
  8: 'Technical',
};

export function Practice() {
  const [searchParams] = useSearchParams();
  const [themeFilter, setThemeFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [selectedStage, setSelectedStage] = useState(1);
  const [activeView, setActiveView] = useState<'practice' | 'history'>('practice');
  const [starredOnly, setStarredOnly] = useState(false);

  const { isStarred, toggleStar, starredIds } = useStarredQuestions();

  const {
    mode,
    tier,
    sessionId,
    questions,
    currentQuestion,
    currentQuestionIndex,
    attempts,
    allAttempts,
    isScoring,
    inputMode,
    answerText,
    stageInfo,
    gateResult,
    debrief,
    dailyStats,
    progression,
    setMode,
    setTier,
    setInputMode,
    setAnswerText,
    startQuick,
    startGuided,
    startWithQuestions,
    submitAnswer,
    tryAgain,
    shuffle,
    nextQuestion,
    goToQuestion,
    endSession,
    requestDebrief,
    generateQuestions,
  } = usePractice();

  const [practiceMode, setPracticeMode] = useState<'single' | 'multi'>('single');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewOffset, setPreviewOffset] = useState(0);
  const [loadedQuestions, setLoadedQuestions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ story_questions: number; gap_questions: number } | null>(null);

  const { data: activityData } = useQuery({
    queryKey: ['practice', 'activity'],
    queryFn: async () => {
      const res = await api.get('/api/practice/activity?limit=50');
      return res.data;
    },
  });
  const activity = activityData?.activity ?? [];

  // Pre-fetch questions for quick practice preview
  const PAGE_SIZE = 10;

  const quickThemeParam = themeFilter !== 'All' ? `&theme=${themeFilter}` : '';
  const quickSourceParam = sourceFilter !== 'All Sources' ? `&source_filter=${sourceFilter}` : '';
  const { data: quickPreviewData, isLoading: quickPreviewLoading } = useQuery({
    queryKey: ['practice', 'quick-preview', themeFilter, sourceFilter, previewOffset],
    queryFn: async () => {
      const res = await api.get(
        `/api/practice/quick/preview?count=${PAGE_SIZE}&offset=${previewOffset}${quickThemeParam}${quickSourceParam}`
      );
      return res.data;
    },
    enabled: mode === 'quick' && activeView === 'practice' && !sessionId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (quickPreviewData?.questions) {
      if (previewOffset === 0) {
        setLoadedQuestions(quickPreviewData.questions);
      } else {
        setLoadedQuestions(prev => {
          const existingIds = new Set(prev.map((q: any) => q.id));
          const newOnes = quickPreviewData.questions.filter((q: any) => !existingIds.has(q.id));
          return [...prev, ...newOnes];
        });
      }
    }
  }, [quickPreviewData, previewOffset]);

  useEffect(() => {
    setPreviewOffset(0);
    setLoadedQuestions([]);
    setSelectedIds(new Set());
  }, [themeFilter, sourceFilter]);

  // Pre-fetch questions for the selected guided stage
  const { data: stagePreview, isLoading: stagePreviewLoading } = useQuery({
    queryKey: ['practice', 'stage-preview', selectedStage],
    queryFn: async () => {
      const res = await api.get(`/api/practice/guided/preview?stage=${selectedStage}&count=10`);
      return res.data;
    },
    enabled: mode === 'guided' && activeView === 'practice' && !sessionId,
    staleTime: 5 * 60 * 1000,
  });
  const previewQuestions = stagePreview?.questions ?? [];

  const hasSession = sessionId !== null;
  const isLastQuestion = currentQuestionIndex >= questions.length - 1;
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const hasScored = latestAttempt !== null;

  // Auto-start from URL params (e.g., ?tier=round_prep&round_id=xxx)
  useEffect(() => {
    const urlTier = searchParams.get('tier') as PracticeTier | null;
    const roundId = searchParams.get('round_id');
    if (urlTier && !hasSession) {
      setTier(urlTier);
      startQuick({ tier: urlTier, round_id: roundId ?? undefined });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progression data
  const currentUnlocked = progression?.progression?.current_stage ?? 1;
  const gatesPassed: string[] = progression?.progression?.gates_passed ?? [];
  const stages: Record<string, { name: string; difficulty: string; gate_dim: string; gate_score: number; time_limit?: number; include_followups?: boolean }> = progression?.stages ?? {};

  // Sync selectedStage to current unlocked on load
  useEffect(() => {
    if (mode === 'guided' && currentUnlocked) {
      setSelectedStage(currentUnlocked);
    }
  }, [mode, currentUnlocked]);

  const handleStartGuided = () => {
    startGuided(selectedStage, { question_count: 10 });
  };

  const handleFinishOrNext = () => {
    if (isLastQuestion) {
      if (questions.length > 1) {
        requestDebrief();
      }
      endSession();
    } else {
      nextQuestion();
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Sharpen your interview answers with scored practice and guided drills.
          </p>
          <div style={{ display: 'flex', gap: 12, padding: '4px 12px', background: 'var(--bg-muted)', borderRadius: 6, fontSize: 13 }}>
            <span><strong>{dailyStats?.streak ?? 0}</strong> day streak</span>
            <span><strong>{dailyStats?.today?.questions_answered ?? 0}</strong> questions today</span>
          </div>
        </div>
      </div>

      {/* Generate personalized questions — shared across all tabs */}
      {!dailyStats?.has_generated_questions && !generateResult && !hasSession && (
        <div style={{ marginBottom: 14, padding: '12px 18px', background: 'var(--bg-muted)', borderRadius: 8, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Personalize your practice</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Generate questions from your stories and resume gaps for targeted practice.</div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={isGenerating}
            onClick={async () => {
              setIsGenerating(true);
              const result = await generateQuestions();
              setGenerateResult(result);
              setIsGenerating(false);
              if (result) {
                setPreviewOffset(0);
                setLoadedQuestions([]);
              }
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Questions'}
          </button>
        </div>
      )}
      {generateResult && (
        <div style={{ marginBottom: 14, padding: '10px 18px', background: '#f0faf4', borderRadius: 8, border: '1px solid #c6e9d4', fontSize: 13, color: '#1d7a3f' }}>
          Generated {generateResult.story_questions} story questions and {generateResult.gap_questions} gap questions.
        </div>
      )}

      {/* Mode Selector Tabs */}
      <div className="tabs">
        <button
          className={`tab${activeView === 'practice' && mode === 'quick' ? ' active' : ''}`}
          onClick={() => { if (hasSession) endSession(); setMode('quick'); setActiveView('practice'); }}
        >
          Quick Practice
        </button>
        <button
          className={`tab${activeView === 'practice' && mode === 'guided' ? ' active' : ''}`}
          onClick={() => { if (hasSession) endSession(); setMode('guided'); setActiveView('practice'); }}
        >
          Guided Practice
        </button>
        <button
          className={`tab${activeView === 'history' ? ' active' : ''}`}
          onClick={() => setActiveView(activeView === 'history' ? 'practice' : 'history')}
        >
          History
        </button>
      </div>

      {/* ────────── Quick Practice Mode ────────── */}
      {activeView === 'practice' && mode === 'quick' && (
        <>
          {/* Filter Bar */}
          {!hasSession && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={themeFilter}
                onChange={(e) => setThemeFilter(e.target.value)}
                style={{ fontSize: 13, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
              >
                {THEME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t === 'All' ? 'All Themes' : t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{ fontSize: 13, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
              >
                <option value="All Sources">All Sources</option>
                <option value="bank">Question Bank</option>
                <option value="job">Job-Specific</option>
                <option value="story">Story-Specific</option>
                <option value="gap">Resume Gap</option>
              </select>
              <button
                className={`btn btn-sm ${starredOnly ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStarredOnly(!starredOnly)}
                title="Show only starred questions"
              >
                {starredOnly ? '\u2605 Starred' : '\u2606 Starred'}
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  // Keep starred questions, fetch fresh random ones for the rest
                  const kept = loadedQuestions.filter((q: any) => isStarred(q.id));
                  const keptIds = kept.map((q: any) => q.id);
                  const needed = Math.max(10 - kept.length, 5);
                  try {
                    const params = new URLSearchParams({
                      count: String(needed),
                      shuffle: 'true',
                      exclude_ids: keptIds.join(','),
                    });
                    if (themeFilter !== 'All') params.set('theme', themeFilter);
                    if (sourceFilter !== 'All Sources') params.set('source_filter', sourceFilter);
                    const res = await api.get(`/api/practice/quick/preview?${params}`);
                    const fresh = res.data.questions || [];
                    setLoadedQuestions([...kept, ...fresh]);
                  } catch {
                    // Fallback: just shuffle what we have
                    setLoadedQuestions(prev => {
                      const shuffled = [...prev];
                      for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                      }
                      return shuffled;
                    });
                  }
                }}
                title="Keep starred, replace others with fresh random questions"
              >
                Shuffle
              </button>
            </div>
          )}

          {/* Question Browser (when no active session) */}
          {!hasSession && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  Questions
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {quickPreviewData?.total_count ?? loadedQuestions.length}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button
                    className={`btn btn-sm ${practiceMode === 'single' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setPracticeMode('single'); setSelectedIds(new Set()); }}
                    style={{ borderRadius: 0 }}
                  >
                    Practice Single
                  </button>
                  <button
                    className={`btn btn-sm ${practiceMode === 'multi' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPracticeMode('multi')}
                    style={{ borderRadius: 0 }}
                  >
                    Practice Multiple
                  </button>
                </div>
              </div>

              {/* Multi-mode action bar */}
              {practiceMode === 'multi' && selectedIds.size > 0 && (
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => startWithQuestions([...selectedIds])}
                  >
                    Start Session ({selectedIds.size} selected)
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Question Rows */}
              <div className="card-body" style={{ padding: 0 }}>
                {(() => {
                  const displayQuestions = starredOnly
                    ? loadedQuestions.filter((q: any) => isStarred(q.id))
                    : loadedQuestions;
                  return displayQuestions.length > 0 ? (
                  displayQuestions.map((q: any, i: number) => (
                    <div
                      key={q.id || i}
                      className="question-row"
                    >
                      {/* Star */}
                      <button
                        className={`star-btn${isStarred(q.id) ? ' starred' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleStar(q.id, q._source || 'bank'); }}
                        title={isStarred(q.id) ? 'Unstar' : 'Star this question'}
                      >
                        {isStarred(q.id) ? '\u2605' : '\u2606'}
                      </button>

                      {/* Question text + badges */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {q.question_text || q.title}
                        </span>
                        {q.frequency === 'very_high' && (
                          <span className="tag tag-green" style={{ fontSize: 9, marginLeft: 8 }}>Common</span>
                        )}
                        {q.theme && (
                          <span className="tag" style={{ fontSize: 9, marginLeft: 8 }}>
                            {q.theme.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                        )}
                      </div>

                      {/* Action: Practice button or checkbox */}
                      {practiceMode === 'single' ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => startWithQuestions([q.id])}
                        >
                          Practice
                        </button>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(q.id)}
                          onChange={(e) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(q.id);
                              else next.delete(q.id);
                              return next;
                            });
                          }}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                      )}
                    </div>
                  ))
                ) : quickPreviewLoading ? (
                  <p style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>Loading questions...</p>
                ) : starredOnly ? (
                  <p style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>No starred questions yet. Star questions with ☆ to find them here.</p>
                ) : (
                  <p style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>No questions available for this filter.</p>
                );
                })()}
              </div>

              {/* Load More */}
              {quickPreviewData && loadedQuestions.length < (quickPreviewData.total_count ?? 0) && (
                <div style={{ padding: '12px 18px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setPreviewOffset(prev => prev + PAGE_SIZE)}
                    disabled={quickPreviewLoading}
                  >
                    {quickPreviewLoading ? 'Loading...' : `Load More (${loadedQuestions.length} of ${quickPreviewData.total_count})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Session */}
          {hasSession && currentQuestion && (
            <ActiveSession
              currentQuestion={currentQuestion}
              questions={questions}
              allAttempts={allAttempts}
              currentQuestionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              goToQuestion={goToQuestion}
              onBackToList={endSession}
              pastActivity={currentQuestion ? activity.filter((a: any) => a.question_id === currentQuestion.id) : []}
              inputMode={inputMode}
              setInputMode={setInputMode}
              answerText={answerText}
              setAnswerText={setAnswerText}
              submitAnswer={submitAnswer}
              isScoring={isScoring}
              latestAttempt={latestAttempt}
              hasScored={hasScored}
              attempts={attempts}
              tryAgain={tryAgain}
              shuffle={shuffle}
              handleFinishOrNext={handleFinishOrNext}
              isLastQuestion={isLastQuestion}
              endSession={endSession}
              stageInfo={null}
              gateResult={gateResult}
              debrief={debrief}
              tier={tier}
            />
          )}
        </>
      )}

      {/* ────────── Guided Practice Mode ────────── */}
      {activeView === 'practice' && mode === 'guided' && (
        <>
          {/* Stage Stepper */}
          {!hasSession && (
            <>
              {/* Combined: Stage selector + info + questions — all in one card */}
              <div className="card" style={{ marginBottom: 14 }}>
                {/* Stage header with name + gate info */}
                <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Stage {selectedStage}: {stages[String(selectedStage)]?.name || STAGE_NAMES[selectedStage]}
                    <InfoPopover label="">
                      <strong style={{ display: 'block', marginBottom: 8 }}>Guided Practice</strong>
                      <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5 }}>
                        Each stage builds a specific interview skill. Master one to unlock the next.
                      </p>
                      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                        <tbody>
                          {Object.entries(STAGE_DETAILS).map(([num, s]) => (
                            <tr key={num} style={{ borderTop: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{num}. {s.name}</td>
                              <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{s.tests}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </InfoPopover>
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    {stages[String(selectedStage)] && (
                      <>
                        <span>{stages[String(selectedStage)].difficulty}</span>
                        <span>·</span>
                        <span>Gate: {stages[String(selectedStage)].gate_dim} &ge; {stages[String(selectedStage)].gate_score}</span>
                        {stages[String(selectedStage)].time_limit && (
                          <><span>·</span><span>{stages[String(selectedStage)].time_limit}s limit</span></>
                        )}
                      </>
                    )}
                    {selectedStage > currentUnlocked && (
                      <span className="tag tag-amber" style={{ fontSize: 10 }}>Skipping ahead</span>
                    )}
                  </div>
                </div>

                {/* Compact stepper + learn more */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-light)' }}>
                  <div className="stepper" style={{ margin: 0 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((stageNum) => {
                      const isPassed = gatesPassed.includes(String(stageNum));
                      const isActive = stageNum === selectedStage;
                      const isDone = isPassed;
                      const className = `step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`;
                      return (
                        <div className={className} key={stageNum} onClick={() => setSelectedStage(stageNum)} style={{ cursor: 'pointer' }} title={STAGE_DETAILS[stageNum]?.description || ''}>
                          <div className="step-dot">{stageNum}</div>
                          <div className="step-label">
                            {STAGE_NAMES[stageNum]}
                            {isPassed && <span className="tag tag-green" style={{ fontSize: 8, marginLeft: 3, padding: '1px 4px' }}>Done</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Questions header with Practice Single/Multiple toggle */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Questions
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {stagePreviewLoading ? '...' : previewQuestions.length}
                    </span>
                  </span>
                  <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button
                      className={`btn btn-sm ${practiceMode === 'single' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => { setPracticeMode('single'); setSelectedIds(new Set()); }}
                      style={{ borderRadius: 0 }}
                    >
                      Practice Single
                    </button>
                    <button
                      className={`btn btn-sm ${practiceMode === 'multi' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPracticeMode('multi')}
                      style={{ borderRadius: 0 }}
                    >
                      Practice Multiple
                    </button>
                  </div>
                </div>

                {/* Multi-mode action bar */}
                {practiceMode === 'multi' && selectedIds.size > 0 && (
                  <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => startWithQuestions([...selectedIds])}
                    >
                      Practice Selected ({selectedIds.size})
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                )}

                <div className="card-body" style={{ padding: 0 }}>
                  {previewQuestions.length > 0 ? (
                    previewQuestions.map((q: any, i: number) => (
                      <div key={q.id || i} className="question-row">
                        {/* Star */}
                        <button
                          className={`star-btn${isStarred(q.id) ? ' starred' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleStar(q.id, q._source || 'bank'); }}
                          title={isStarred(q.id) ? 'Unstar' : 'Star this question'}
                        >
                          {isStarred(q.id) ? '\u2605' : '\u2606'}
                        </button>

                        {/* Question text + badges */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {q.question_text || q.title}
                          </span>
                          {q.frequency === 'very_high' && (
                            <span className="tag tag-green" style={{ fontSize: 9, marginLeft: 8 }}>Common</span>
                          )}
                          {q.theme && (
                            <span className="tag" style={{ fontSize: 9, marginLeft: 8 }}>
                              {q.theme.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                            </span>
                          )}
                        </div>

                        {/* Action: Practice button or checkbox */}
                        {practiceMode === 'single' ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => startWithQuestions([q.id])}
                          >
                            Practice
                          </button>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(q.id)}
                            onChange={(e) => {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(q.id);
                                else next.delete(q.id);
                                return next;
                              });
                            }}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                        )}
                      </div>
                    ))
                  ) : stagePreviewLoading ? (
                    <p style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>Loading questions...</p>
                  ) : (
                    <p style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>No questions available for this stage.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Active Guided Session */}
          {hasSession && currentQuestion && (
            <ActiveSession
              currentQuestion={currentQuestion}
              questions={questions}
              allAttempts={allAttempts}
              currentQuestionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              goToQuestion={goToQuestion}
              onBackToList={endSession}
              pastActivity={currentQuestion ? activity.filter((a: any) => a.question_id === currentQuestion.id) : []}
              inputMode={inputMode}
              setInputMode={setInputMode}
              answerText={answerText}
              setAnswerText={setAnswerText}
              isScoring={isScoring}
              submitAnswer={submitAnswer}
              latestAttempt={latestAttempt}
              attempts={attempts}
              hasScored={hasScored}
              tryAgain={tryAgain}
              shuffle={shuffle}
              handleFinishOrNext={handleFinishOrNext}
              isLastQuestion={isLastQuestion}
              endSession={endSession}
              gateResult={gateResult}
              debrief={debrief}
              tier={tier}
              stageInfo={stageInfo}
            />
          )}
        </>
      )}
      {/* ────────── History View ────────── */}
      {activeView === 'history' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Practice History
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({activity.length} entries)</span>
            </span>
          </div>
          {/* Column headers */}
          <HistoryColumnHeaders />
          <div className="card-body" style={{ padding: 0 }}>
            {activity.length === 0 ? (
              <p style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>No practice history yet. Start practicing to see your activity here.</p>
            ) : (
              activity.map((entry: any) => (
                <HistoryEntry key={entry.id} entry={entry} onPracticeAgain={(qId: string) => { startWithQuestions([qId]); setActiveView('practice'); setMode('quick'); }} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ────────── PreviousAttempts Sub-component ────────── */

function PreviousAttempts({ attempts }: { attempts: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'coaching' | 'exemplar' | 'drill'>>({});

  if (attempts.length === 0) return null;

  const best = Math.max(...attempts.map((a: any) => a.average ?? 0));

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <span className="card-title">
          Previous Attempts
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({attempts.length})</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Best: {best.toFixed(1)}</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {attempts.map((a: any, i: number) => {
          const avg = a.average ?? 0;
          const time = new Date(a.created_at).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          });
          const scoreColor = avg >= 4 ? '#1d7a3f' : avg >= 3 ? '#2d8a4e' : avg >= 2 ? '#e6a817' : 'var(--text-danger)';
          const scoreLabel = avg >= 4 ? 'Great' : avg >= 3 ? 'Good' : avg >= 2 ? 'Needs Work' : 'Weak';
          const isOpen = expandedId === (a.id || String(i));
          const tabKey = a.id || String(i);
          const tab = activeTab[tabKey] || 'coaching';
          const hasBullets = a.coaching_bullets?.length > 0;
          const hasExemplar = Boolean(a.exemplar_answer);
          const hasDrill = Boolean(a.micro_drill);

          return (
            <div key={a.id || i} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div
                onClick={() => setExpandedId(isOpen ? null : (a.id || String(i)))}
                style={{ padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                className="history-entry"
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 60 }}>{time}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Attempt {attempts.length - i}</span>
                <span style={{ flex: 1 }} />
                <span className={`tag ${avg >= 3 ? 'tag-green' : ''}`} style={{ fontSize: 10 }}>{scoreLabel}</span>
                <span style={{ fontWeight: 700, color: scoreColor, fontSize: 16, minWidth: 30, textAlign: 'right' }}>{avg.toFixed(1)}</span>
              </div>
              {isOpen && (
                <div style={{ padding: '0 18px 14px' }} onClick={(e) => e.stopPropagation()}>
                  {/* User's answer */}
                  {a.answer_text && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Your answer:</div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{a.answer_text}</p>
                    </div>
                  )}

                  {/* Score bars */}
                  <div className="score-dims" style={{ marginBottom: 12 }}>
                    {['substance', 'structure', 'relevance', 'credibility', 'differentiation'].map((dim) => {
                      const val = a.scores?.[dim] ?? 0;
                      return (
                        <div className="score-dim" key={dim}>
                          <span className="score-dim-label">{dim.charAt(0).toUpperCase() + dim.slice(1)}</span>
                          <div className="score-dim-bar">
                            <div className="score-dim-fill" style={{ width: `${(val / 5) * 100}%`, background: `var(--c-${dim})` }} />
                          </div>
                          <span className="score-dim-val">{val.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Feedback */}
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 8 }}>{a.feedback}</p>

                  {a.suggestion && (
                    <p style={{ fontSize: 13, color: 'var(--primary)', margin: '8px 0' }}>
                      <strong>Tip:</strong> {a.suggestion}
                    </p>
                  )}

                  {/* Tabs */}
                  {(hasBullets || hasExemplar || hasDrill) && (
                    <>
                      <div className="scorecard-tabs">
                        {hasBullets && <button className={`scorecard-tab${tab === 'coaching' ? ' active' : ''}`} onClick={() => setActiveTab(p => ({ ...p, [tabKey]: 'coaching' }))}>Coaching Notes</button>}
                        {hasExemplar && <button className={`scorecard-tab${tab === 'exemplar' ? ' active' : ''}`} onClick={() => setActiveTab(p => ({ ...p, [tabKey]: 'exemplar' }))}>Exemplar Answer</button>}
                        {hasDrill && <button className={`scorecard-tab${tab === 'drill' ? ' active' : ''}`} onClick={() => setActiveTab(p => ({ ...p, [tabKey]: 'drill' }))}>Quick Drill</button>}
                      </div>
                      <div className="scorecard-tab-panel">
                        {tab === 'coaching' && hasBullets && (
                          <ul className="scorecard-bullets">{a.coaching_bullets.map((b: string, j: number) => <li key={j}>{b}</li>)}</ul>
                        )}
                        {tab === 'exemplar' && hasExemplar && (
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{a.exemplar_answer}</p>
                        )}
                        {tab === 'drill' && hasDrill && (
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{a.micro_drill}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── GuidedPracticeInfo Sub-component ────────── */

const STAGE_DETAILS: Record<number, { name: string; description: string; tests: string; gate: string }> = {
  1: { name: 'Ladder', description: 'Tell the same story at 30s, 60s, 90s, and 3 minutes', tests: 'Can you structure an answer at all?', gate: 'Structure >= 3.5' },
  2: { name: 'Pushback', description: 'Handle skepticism, interruption, "so what?" pressure', tests: 'Can you hold up when challenged?', gate: 'Credibility >= 3.5' },
  3: { name: 'Pivot', description: 'Redirect when a question doesn\'t match your prep', tests: 'Can you adapt on the fly?', gate: 'Relevance >= 3.5' },
  4: { name: 'Gap', description: 'Handle "I don\'t have an example for that" gracefully', tests: 'Can you be honest without crumbling?', gate: 'Credibility >= 4.0' },
  5: { name: 'Role', description: 'Handle role-specific specialist scrutiny', tests: 'Can you go deep under expert questioning?', gate: 'Substance >= 4.0' },
  6: { name: 'Panel', description: 'Multiple interviewer personas simultaneously', tests: 'Can you manage competing dynamics?', gate: 'All dims >= 4.0' },
  7: { name: 'Stress', description: 'High-pressure simulation with time crunch and curveballs', tests: 'Can you perform under maximum pressure?', gate: 'All dims >= 4.0' },
  8: { name: 'Technical', description: 'Thinking out loud, clarification-seeking, tradeoff articulation', tests: 'Can you communicate technical decisions?', gate: 'Structure + Substance >= 4.5' },
};

function GuidedPracticeInfo() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-body" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>&#127919;</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Build interview skills progressively</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Each stage builds on the last. Master structuring answers before handling pushback. Handle pushback before pivoting under pressure. Earn your way through — or skip ahead if you're ready.
            </p>
            <button
              className="scorecard-expand-btn"
              onClick={() => setShowDetails(!showDetails)}
              style={{ marginTop: 8 }}
            >
              {showDetails ? 'Hide stage details' : 'Learn about each stage'}
            </button>
          </div>
        </div>

        {showDetails && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Stage</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>What you practice</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Why this order</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Gate to advance</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STAGE_DETAILS).map(([num, stage]) => (
                  <tr key={num} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {num}. {stage.name}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                      {stage.description}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {stage.tests}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span className="tag" style={{ fontSize: 10 }}>{stage.gate}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.5 }}>
              Score 1-5 on each dimension after every answer. Meet the gate threshold on 3 consecutive rounds to unlock the next stage. You can skip ahead, but mastery badges are only earned through the gates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────── HistoryColumnHeaders Sub-component ────────── */

function InfoPopover({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {label}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '50%', width: 16, height: 16, fontSize: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}
        aria-label={`${label} info`}
      >
        i
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.2)' }} onClick={() => setOpen(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', zIndex: 9999, width: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            {children}
            <button onClick={() => setOpen(false)} style={{ marginTop: 12, width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </>
      )}
    </span>
  );
}

function HistoryColumnHeaders() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
      <div style={{ flex: 1 }}>Question</div>
      <div style={{ width: 90, textAlign: 'center' }}>
        <InfoPopover label="Rating">
          <strong style={{ display: 'block', marginBottom: 4 }}>Rating Scale</strong>
          <div><span style={{ color: 'var(--text-danger)' }}>Weak</span> — Score 0 to 2</div>
          <div><span style={{ color: '#e6a817' }}>Needs Work</span> — Score 2 to 3</div>
          <div><span style={{ color: '#2d8a4e' }}>Good Score</span> — Score 3 to 4</div>
          <div><span style={{ color: '#1d7a3f' }}>Great Score</span> — Score 4 to 5</div>
        </InfoPopover>
      </div>
      <div style={{ width: 50, textAlign: 'right' }}>
        <InfoPopover label="Score">
          <strong style={{ display: 'block', marginBottom: 4 }}>Score (1-5)</strong>
          <div>Average of 5 dimensions:</div>
          <div style={{ marginTop: 4 }}>
            <div>Substance</div>
            <div>Structure</div>
            <div>Relevance</div>
            <div>Credibility</div>
            <div>Differentiation</div>
          </div>
        </InfoPopover>
      </div>
    </div>
  );
}

/* ────────── HistoryEntry Sub-component ────────── */

function HistoryEntry({ entry, onPracticeAgain }: { entry: any; onPracticeAgain: (questionId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'coaching' | 'exemplar' | 'drill'>('coaching');

  const avg = entry.average ?? 0;
  const time = new Date(entry.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  // Score label and color based on average
  let scoreLabel: string;
  let scoreTagClass: string;
  if (avg >= 4) {
    scoreLabel = 'Great Score';
    scoreTagClass = 'tag-green';
  } else if (avg >= 3) {
    scoreLabel = 'Good Score';
    scoreTagClass = 'tag-green';
  } else if (avg >= 2) {
    scoreLabel = 'Needs Work';
    scoreTagClass = '';
  } else {
    scoreLabel = 'Weak';
    scoreTagClass = '';
  }
  const scoreColor = avg >= 4 ? '#1d7a3f' : avg >= 3 ? '#2d8a4e' : avg >= 2 ? '#e6a817' : 'var(--text-danger)';

  const hasExemplar = Boolean(entry.exemplar_answer);
  const hasDrill = Boolean(entry.micro_drill);
  const hasBullets = entry.coaching_bullets?.length > 0;

  return (
    <div className="history-entry" onClick={() => setExpanded(!expanded)}>
      <div className="history-entry-header">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{entry.question_text}</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 4, alignItems: 'center' }}>
            <span>{time}</span>
            <span>Attempt {entry.attempt_number}</span>
            <span>{entry.input_mode}</span>
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }}
              onClick={(e) => { e.stopPropagation(); onPracticeAgain(entry.question_id); }}
            >
              Practice Again
            </button>
          </div>
        </div>
        <div style={{ width: 90, textAlign: 'center', flexShrink: 0 }}>
          <span className={`tag ${scoreTagClass}`} style={{ fontSize: 11 }}>
            {scoreLabel}
          </span>
        </div>
        <div className="history-entry-score" style={{ color: scoreColor, width: 50, textAlign: 'right', flexShrink: 0 }}>
          {avg.toFixed(1)}
        </div>
      </div>

      {expanded && (
        <div className="history-entry-detail" onClick={(e) => e.stopPropagation()}>
          {/* User's answer */}
          {entry.answer_text && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Your answer:</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{entry.answer_text}</p>
            </div>
          )}

          <div className="score-dims" style={{ marginBottom: 12 }}>
            {['substance', 'structure', 'relevance', 'credibility', 'differentiation'].map((dim) => {
              const val = entry.scores?.[dim] ?? 0;
              return (
                <div className="score-dim" key={dim}>
                  <span className="score-dim-label">{dim.charAt(0).toUpperCase() + dim.slice(1)}</span>
                  <div className="score-dim-bar">
                    <div className="score-dim-fill" style={{ width: `${(val / 5) * 100}%`, background: `var(--c-${dim})` }} />
                  </div>
                  <span className="score-dim-val">{val.toFixed(1)}</span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {entry.feedback}
          </p>

          {entry.suggestion && (
            <p style={{ fontSize: 13, color: 'var(--primary)', margin: '8px 0' }}>
              <strong>Tip:</strong> {entry.suggestion}
            </p>
          )}

          {/* Tabs: Coaching Notes | Exemplar Answer | Quick Drill */}
          {(hasBullets || hasExemplar || hasDrill) && (
            <>
              <div className="scorecard-tabs">
                {hasBullets && (
                  <button className={`scorecard-tab${activeTab === 'coaching' ? ' active' : ''}`} onClick={() => setActiveTab('coaching')}>
                    Coaching Notes
                  </button>
                )}
                {hasExemplar && (
                  <button className={`scorecard-tab${activeTab === 'exemplar' ? ' active' : ''}`} onClick={() => setActiveTab('exemplar')}>
                    Exemplar Answer
                  </button>
                )}
                {hasDrill && (
                  <button className={`scorecard-tab${activeTab === 'drill' ? ' active' : ''}`} onClick={() => setActiveTab('drill')}>
                    Quick Drill
                  </button>
                )}
              </div>
              <div className="scorecard-tab-panel">
                {activeTab === 'coaching' && hasBullets && (
                  <ul className="scorecard-bullets">
                    {entry.coaching_bullets.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {activeTab === 'exemplar' && hasExemplar && (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{entry.exemplar_answer}</p>
                )}
                {activeTab === 'drill' && hasDrill && (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{entry.micro_drill}</p>
                )}
              </div>
            </>
          )}

          {/* Practice Again button */}
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={(e) => { e.stopPropagation(); onPracticeAgain(entry.question_id); }}
            >
              Practice Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ────────── Active Session Sub-component ────────── */

interface ActiveSessionProps {
  currentQuestion: {
    id: string;
    question_text: string;
    title: string;
    _source: QuestionSource;
    _source_detail: string;
    theme: string;
  };
  questions: { id: string; question_text: string; title: string; theme: string }[];
  allAttempts: Record<number, { attemptNumber: number; average: number; scores: any }[]>;
  currentQuestionIndex: number;
  totalQuestions: number;
  goToQuestion: (index: number) => void;
  onBackToList: () => void;
  pastActivity: any[];
  inputMode: 'voice' | 'text';
  setInputMode: (m: 'voice' | 'text') => void;
  answerText: string;
  setAnswerText: (t: string) => void;
  isScoring: boolean;
  submitAnswer: () => void;
  latestAttempt: { attemptNumber: number; average: number; scores: any } | null;
  attempts: { attemptNumber: number; average: number; scores: any }[];
  hasScored: boolean;
  tryAgain: () => void;
  shuffle: () => void;
  handleFinishOrNext: () => void;
  isLastQuestion: boolean;
  endSession: () => void;
  gateResult: { passed: boolean; stage: number; gate_dim: string; gate_score: number; next_stage: number } | null;
  debrief: any;
  tier: PracticeTier;
  stageInfo?: { name: string; difficulty: string; gate_dim: string; gate_score: number; time_limit: number | null; include_followups: boolean } | null;
}

function ActiveSession({
  currentQuestion,
  questions,
  allAttempts,
  currentQuestionIndex,
  totalQuestions,
  goToQuestion,
  onBackToList,
  pastActivity,
  inputMode,
  setInputMode,
  answerText,
  setAnswerText,
  isScoring,
  submitAnswer,
  latestAttempt,
  attempts,
  hasScored,
  tryAgain,
  shuffle,
  handleFinishOrNext,
  isLastQuestion,
  endSession,
  gateResult,
  debrief,
  tier,
  stageInfo,
}: ActiveSessionProps) {
  return (
    <>
      {/* Back button + Stage Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button className="btn btn-outline btn-sm" onClick={onBackToList}>
          &larr; Back to Questions
        </button>
        {stageInfo && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Stage: {stageInfo.name} | Gate: {stageInfo.gate_dim} &ge; {stageInfo.gate_score}
          </span>
        )}
      </div>

      {/* Question Navigator (for multi-question sessions) */}
      {totalQuestions > 1 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body" style={{ padding: '8px 14px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Questions:</span>
              {questions.map((q, i) => {
                const qAttempts = allAttempts[i] || [];
                const lastScore = qAttempts.length > 0 ? qAttempts[qAttempts.length - 1].average : null;
                const hasAttempt = qAttempts.length > 0;
                return (
                <button
                  key={q.id || i}
                  className={`btn btn-sm ${i === currentQuestionIndex ? 'btn-primary' : hasAttempt ? 'btn-outline' : 'btn-outline'}`}
                  onClick={() => goToQuestion(i)}
                  style={{ minWidth: 32, padding: '4px 8px', fontSize: 12, position: 'relative', borderColor: hasAttempt && i !== currentQuestionIndex ? (lastScore! >= 3 ? '#2d8a4e' : '#e6a817') : undefined }}
                  title={hasAttempt ? `${q.question_text?.substring(0, 40)}... (Score: ${lastScore?.toFixed(1)})` : q.question_text?.substring(0, 60)}
                >
                  {i + 1}
                  {hasAttempt && i !== currentQuestionIndex && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: lastScore! >= 3 ? '#2d8a4e' : '#e6a817' }} />
                  )}
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Question Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <SourceIndicator
            source={currentQuestion._source}
            detail={currentQuestion._source_detail}
          />
        </div>
        <div className="card-body">
          {/* Question Text */}
          <p style={{ fontFamily: 'var(--ff-display)', fontSize: 20, lineHeight: 1.5, marginBottom: 18, marginTop: 0 }}>
            {currentQuestion.question_text}
          </p>

          {currentQuestion.theme && (
            <span className="tag tag-primary" style={{ marginBottom: 14, display: 'inline-block' }}>
              {currentQuestion.theme.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          )}

          {/* Input Mode Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 8 }}>
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

          {/* Text Input */}
          {inputMode === 'text' && (
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your answer here..."
              rows={6}
              style={{
                width: '100%',
                fontSize: 14,
                lineHeight: 1.6,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                resize: 'vertical',
                fontFamily: 'var(--ff-body)',
                boxSizing: 'border-box',
              }}
              disabled={isScoring}
            />
          )}

          {/* Voice placeholder */}
          {inputMode === 'voice' && (
            <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Voice recording coming soon — use text mode for now.
            </div>
          )}

          {/* Submit Button */}
          {!hasScored && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={submitAnswer}
                disabled={isScoring || (inputMode === 'text' && answerText.trim().length === 0)}
              >
                {isScoring ? 'Scoring...' : 'Submit Answer'}
              </button>
              {isScoring && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Evaluating your response...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scorecard */}
      {hasScored && latestAttempt && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Score</span>
          </div>
          <div className="card-body">
            <Scorecard
              scores={{
                substance: latestAttempt.scores.substance,
                structure: latestAttempt.scores.structure,
                relevance: latestAttempt.scores.relevance,
                credibility: latestAttempt.scores.credibility,
                differentiation: latestAttempt.scores.differentiation,
                presence: latestAttempt.scores.presence ?? null,
              }}
              hireSignal={latestAttempt.scores.hire_signal}
              feedback={latestAttempt.scores.feedback}
              coachingBullets={latestAttempt.scores.coaching_bullets}
              exemplarAnswer={latestAttempt.scores.exemplar_answer}
              microDrill={latestAttempt.scores.micro_drill}
              attempts={attempts.map((a) => ({ attemptNumber: a.attemptNumber, average: a.average }))}
            />
          </div>
        </div>
      )}

      {/* Stage Feedback (guided mode) */}
      {hasScored && latestAttempt?.scores?.stage_feedback && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Stage Coaching</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
              {latestAttempt.scores.stage_feedback}
            </p>
          </div>
        </div>
      )}

      {/* Follow-up Challenge (stages 2, 3, 5, 6, 7, 8) */}
      {hasScored && latestAttempt?.scores?.follow_up_challenge && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title">Follow-up Challenge</span>
            <span className="tag" style={{ fontSize: 10 }}>Interviewer pushback</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 16, lineHeight: 1.5, fontFamily: 'var(--ff-display)', margin: '0 0 12px' }}>
              {latestAttempt.scores.follow_up_challenge}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Answer this follow-up to practice handling pushback. Click "Try Again" and address this challenge in your response.
            </p>
          </div>
        </div>
      )}

      {/* Gate Result (guided mode) */}
      {gateResult && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            {gateResult.passed ? (
              <div style={{ color: '#1d7a3f', fontWeight: 600, fontSize: 14 }}>
                Stage passed! Unlocked Stage {gateResult.next_stage}.
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Not yet — need {gateResult.gate_dim} &ge; {gateResult.gate_score} on 3 consecutive rounds.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons (after scoring) */}
      {hasScored && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="btn btn-outline btn-sm" onClick={tryAgain} title="Same question, refine your answer">
            Try Again
          </button>
          <button className="btn btn-outline btn-sm" onClick={shuffle} title="Same topic, different phrasing">
            Shuffle
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleFinishOrNext}>
            {isLastQuestion ? 'Finish' : 'Next Question'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={endSession}
            style={{ marginLeft: 'auto' }}
          >
            End Session
          </button>
        </div>
      )}

      {/* Previous Attempts for this question */}
      {pastActivity.length > 0 && (
        <PreviousAttempts attempts={pastActivity} />
      )}

      {/* Session Debrief */}
      {debrief && (tier === 'session' || tier === 'round_prep') && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Session Debrief</span>
          </div>
          <div className="card-body">
            {typeof debrief === 'string' ? (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{debrief}</p>
            ) : (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {debrief.summary && <p style={{ margin: '0 0 12px' }}>{debrief.summary}</p>}
                {debrief.strengths && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>Strengths:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                      {(Array.isArray(debrief.strengths) ? debrief.strengths : [debrief.strengths]).map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {debrief.areas_to_improve && (
                  <div>
                    <strong>Areas to Improve:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                      {(Array.isArray(debrief.areas_to_improve) ? debrief.areas_to_improve : [debrief.areas_to_improve]).map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
