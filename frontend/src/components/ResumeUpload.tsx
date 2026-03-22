import { useRef } from 'react';

interface ResumeUploadProps {
  onUpload: (file: File) => void;
}

export function ResumeUpload({ onUpload }: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onUpload(file);
          }
          // Reset so same file can be re-selected
          e.target.value = '';
        }}
      />
      <button
        className="btn btn-primary btn-sm"
        onClick={() => inputRef.current?.click()}
      >
        Upload Resume
      </button>
    </>
  );
}
