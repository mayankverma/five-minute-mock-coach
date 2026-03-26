import '../pages/pages.css';

interface TextAnswerProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}

export function TextAnswer({ value, onChange, onSubmit, disabled, placeholder }: TextAnswerProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey && !disabled && value.trim()) {
      onSubmit();
    }
  };

  return (
    <div className="text-answer">
      <textarea
        className="text-answer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type your answer here... (Cmd+Enter to submit)"}
        disabled={disabled}
        rows={6}
      />
      <div className="text-answer-footer">
        <span className="text-answer-hint">Cmd+Enter to submit</span>
        <span className="text-answer-count">{value.length} chars</span>
      </div>
    </div>
  );
}
