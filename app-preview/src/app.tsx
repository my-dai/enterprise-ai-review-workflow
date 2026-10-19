import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';

import Layout from '@/pages/_layout';
import { queryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from '@/components/system/error-boundary';

import HomePage from '@/pages/index';
import NewLessonPage from '@/pages/new';
import ImportLessonsPage from '@/pages/import-lessons';
import LessonDetailPage from '@/pages/lesson-detail';
import PipelinePage from '@/pages/pipeline';
import AdminPage from '@/pages/admin';
import LessonsLibraryPage from '@/pages/lessons-library';
import WorkflowPage from '@/pages/workflow';
import { WorkflowProvider } from '@/lib/workflow-data';
import NotFoundPage from '@/pages/not-found';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary resetQueryCache>
        <JotaiProvider>
          <WorkflowProvider>
            <Toaster richColors />
            <Router>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="new" element={<NewLessonPage />} />
                  <Route path="import" element={<ImportLessonsPage />} />
                  <Route path="lessons/:id" element={<LessonDetailPage />} />
                  <Route path="pipeline" element={<PipelinePage />} />
                  <Route path="review" element={<Navigate to="/" replace />} />
                  <Route path="approvals" element={<Navigate to="/" replace />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="library" element={<LessonsLibraryPage />} />
                  <Route path="lessons-library" element={<Navigate to="/library" replace />} />
                  <Route path="workflow" element={<WorkflowPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Router>
          </WorkflowProvider>
        </JotaiProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
