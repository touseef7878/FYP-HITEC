import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import HeatmapPage from "./pages/HeatmapPage";
import PredictionsPage from "./pages/PredictionsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogs from "./pages/AdminLogs";
import AdminUsers from "./pages/AdminUsers";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-600">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// User-only Route Component (prevents admin access and redirects them)
const UserOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Automatically redirect admins to admin panel
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route 
        path="/auth" 
        element={
          isAuthenticated ? (
            <Navigate to={isAdmin ? "/admin" : "/"} replace />
          ) : (
            <AuthPage />
          )
        } 
      />
      <Route 
        path="/upload" 
        element={
          <UserOnlyRoute>
            <UploadPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/results" 
        element={
          <UserOnlyRoute>
            <ResultsPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/results/:detectionId" 
        element={
          <UserOnlyRoute>
            <ResultsPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <UserOnlyRoute>
            <DashboardPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/history" 
        element={
          <UserOnlyRoute>
            <HistoryPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/heatmap" 
        element={
          <UserOnlyRoute>
            <HeatmapPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/predictions" 
        element={
          <UserOnlyRoute>
            <ErrorBoundary>
              <PredictionsPage />
            </ErrorBoundary>
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <UserOnlyRoute>
            <ReportsPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <UserOnlyRoute>
            <SettingsPage />
          </UserOnlyRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/logs" 
        element={
          <ProtectedRoute requireAdmin>
            <AdminLogs />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <ProtectedRoute requireAdmin>
            <AdminUsers />
          </ProtectedRoute>
        } 
      />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
