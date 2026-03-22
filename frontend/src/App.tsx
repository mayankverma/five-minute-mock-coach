import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Storybank } from './pages/Storybank';
import { Practice } from './pages/Practice';
import { MockInterview } from './pages/MockInterview';
import { InterviewPrep } from './pages/InterviewPrep';
import { Progress } from './pages/Progress';
import { Materials } from './pages/Materials';
import { Hype } from './pages/Hype';
import { Debrief } from './pages/Debrief';
import { Pricing } from './pages/Pricing';

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

              {/* Protected app */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/stories" element={<Storybank />} />
                <Route path="/practice" element={<Practice />} />
                <Route path="/mock" element={<MockInterview />} />
                <Route path="/prep" element={<InterviewPrep />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/materials" element={<Materials />} />
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
