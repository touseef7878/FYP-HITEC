import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Suspense, lazy } from "react";

// Lazy load pages
const HomePage        = lazy(() => import("@/pages/Home"));
const UploadPage      = lazy(() => import("@/pages/user/Upload"));
const ResultsPage     = lazy(() => import("@/pages/user/Results"));
const DashboardPage   = lazy(() => import("@/pages/user/Dashboard"));
const HistoryPage     = lazy(() => import("@/pages/user/History"));
const HeatmapPage     = lazy(() => import("@/pages/user/Heatmap"));
const PredictionsPage = lazy(() => import("@/pages/user/Predictions"));
const ReportsPage     = lazy(() => import("@/pages/user/Reports"));
const SettingsPage    = lazy(() => import("@/pages/user/Settings"));
const AdminDashboard  = lazy(() => import("@/pages/admin/Dashboard"));
const AdminLogs       = lazy(() => import("@/pages/admin/Logs"));
const AdminUsers      = lazy(() => import("@/pages/admin/Users"));
const AdminSettings   = lazy(() => import("@/pages/admin/Settings"));
const PrivacyPolicy   = lazy(() => import("@/pages/PrivacyPolicy"));
const AuthPage        = lazy(() => import("@/pages/Auth"));
const NotFound        = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Spinner shown while lazy chunk loads
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

// ── Route guards ──────────────────────────────────────────────────────────
const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Admin privileges required.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

const UserOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

// ── Page fade wrapper ─────────────────────────────────────────────────────
// IMPORTANT: This must NOT wrap MainLayout (which contains the fixed sidebar).
// Instead it only wraps the *content area* rendered inside MainLayout.
// Each page calls this internally via the `usePageFade` pattern below.
// We expose it as a named export so pages can import it if needed,
// but the primary mechanism is the AnimatePresence key swap in AppRoutes.

/**
 * Thin overlay that fades in over the content area only.
 * Does NOT wrap fixed elements so the sidebar is unaffected.
 */
const FadeLayer = ({ children, routeKey }: { children: React.ReactNode; routeKey: string }) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={routeKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      // No transform — transform creates a stacking context that breaks fixed children.
      // Pure opacity fade is safe and still looks great.
      style={{ minHeight: "100%" }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

// ── Routes ────────────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const key = location.pathname;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={key}>

        <Route path="/" element={
          <FadeLayer routeKey={key}><HomePage /></FadeLayer>
        } />

        <Route path="/auth" element={
          isAuthenticated
            ? <Navigate to={isAdmin ? "/admin" : "/"} replace />
            : <FadeLayer routeKey={key}><AuthPage /></FadeLayer>
        } />

        <Route path="/upload" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><UploadPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/results" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><ResultsPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/results/:detectionId" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><ResultsPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/dashboard" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><DashboardPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/history" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><HistoryPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/heatmap" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><HeatmapPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/predictions" element={
          <UserOnlyRoute>
            <ErrorBoundary>
              <FadeLayer routeKey={key}><PredictionsPage /></FadeLayer>
            </ErrorBoundary>
          </UserOnlyRoute>
        } />

        <Route path="/reports" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><ReportsPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/settings" element={
          <UserOnlyRoute>
            <FadeLayer routeKey={key}><SettingsPage /></FadeLayer>
          </UserOnlyRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <FadeLayer routeKey={key}><AdminDashboard /></FadeLayer>
          </ProtectedRoute>
        } />

        <Route path="/admin/logs" element={
          <ProtectedRoute requireAdmin>
            <FadeLayer routeKey={key}><AdminLogs /></FadeLayer>
          </ProtectedRoute>
        } />

        <Route path="/admin/users" element={
          <ProtectedRoute requireAdmin>
            <FadeLayer routeKey={key}><AdminUsers /></FadeLayer>
          </ProtectedRoute>
        } />

        <Route path="/admin/settings" element={
          <ProtectedRoute requireAdmin>
            <FadeLayer routeKey={key}><AdminSettings /></FadeLayer>
          </ProtectedRoute>
        } />

        <Route path="/privacy" element={
          <FadeLayer routeKey={key}><PrivacyPolicy /></FadeLayer>
        } />

        <Route path="*" element={
          <FadeLayer routeKey={key}><NotFound /></FadeLayer>
        } />

      </Routes>
    </Suspense>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────
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
