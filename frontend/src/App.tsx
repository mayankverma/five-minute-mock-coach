import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Storybank } from './pages/Storybank';
import { Practice } from './pages/Practice';
import { MockInterview } from './pages/MockInterview';
import { InterviewPrep } from './pages/InterviewPrep';
import { Progress } from './pages/Progress';
import { Hype } from './pages/Hype';
import { Debrief } from './pages/Debrief';
import { Pricing } from './pages/Pricing';
import { ResumePage } from './pages/ResumePage';
import { LinkedInPage } from './pages/LinkedInPage';
import { PitchPage } from './pages/PitchPage';
import { OutreachPage } from './pages/OutreachPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Landing />} />

              {/* Protected — onboarding (no sidebar/topbar) */}
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              {/* Protected app */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/stories" element={<Storybank />} />
                <Route path="/practice" element={<Practice />} />
                <Route path="/mock" element={<MockInterview />} />
                <Route path="/prep" element={<InterviewPrep />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/materials" element={<Navigate to="/resume" replace />} />
                <Route path="/resume" element={<ResumePage />} />
                <Route path="/linkedin" element={<LinkedInPage />} />
                <Route path="/pitch" element={<PitchPage />} />
                <Route path="/outreach" element={<OutreachPage />} />
                <Route path="/hype" element={<Hype />} />
                <Route path="/debrief" element={<Debrief />} />
                <Route path="/billing" element={<Pricing />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
