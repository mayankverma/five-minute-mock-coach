import { MockSession } from '../components/MockSession';

export function MockInterview() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mock Interview</h1>
        <p className="page-subtitle">Full simulated interview with voice.</p>
      </div>
      <MockSession />
    </div>
  );
}
