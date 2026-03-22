import '../pages/pages.css';

interface VoiceRecorderProps {
  isRecording: boolean;
  onToggle: () => void;
  elapsedSeconds: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({ isRecording, onToggle, elapsedSeconds }: VoiceRecorderProps) {
  return (
    <>
      <div className="voice-bars">
        <span className="voice-bar"></span>
        <span className="voice-bar"></span>
        <span className="voice-bar"></span>
        <span className="voice-bar"></span>
        <span className="voice-bar"></span>
        <span className="voice-bar"></span>
        <span className="voice-bar"></span>
      </div>

      <button
        className={`mic-btn${isRecording ? ' recording' : ''}`}
        onClick={onToggle}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <svg viewBox="0 0 18 18" width="32" height="32" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="1" width="6" height="10" rx="3" />
          <path d="M3 8a6 6 0 0 0 12 0" />
          <line x1="9" y1="14" x2="9" y2="17" />
          <line x1="6" y1="17" x2="12" y2="17" />
        </svg>
      </button>

      <div className="voice-timer">{formatTime(elapsedSeconds)}</div>
    </>
  );
}
