import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OceanAssistant } from "@/components/features/assistant/OceanAssistant";
import { Suspense, lazy, useRef, memo } from "react";

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

// ── Page transition ───────────────────────────────────────────────────────
/**
 * Only animates when the pathname actually changes.
 * Uses useRef to track previous path — state changes (toasts, data fetches)
 * never trigger the animation because they don't change the pathname.
 */
const pageVariants = {
  initial: { opacity: 0, y: 8  },
  enter:   { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -4 },
};

// Progress bar — pure CSS, mounts once per navigation
const ProgressBar = memo(() => <div className="page-progress-bar" />);
ProgressBar.displayName = 'ProgressBar';

// Stable wrapper — defined OUTSIDE AppRoutes so it never gets a new type
const PageTransitionWrapper = memo(({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey: string;
}) => {
  const prevKey = useRef(routeKey);
  const isNavigating = prevKey.current !== routeKey;
  if (isNavigating) prevKey.current = routeKey;

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={routeKey}
        initial={isNavigating ? "initial" : false}
        animate="enter"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ minHeight: '100%', willChange: 'opacity, transform' }}
      >
        {/* Progress bar only mounts when key changes (real navigation) */}
        {isNavigating && <ProgressBar key={routeKey} />}
        {children}
      </motion.div>
    </AnimatePresence>
  );
});
PageTransitionWrapper.displayName = 'PageTransitionWrapper';

// ── Routes ────────────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const key = location.pathname;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={key}>

        <Route path="/"    element={<PageTransitionWrapper routeKey={key}><HomePage /></PageTransitionWrapper>} />

        <Route path="/auth" element={
          isAuthenticated
            ? <Navigate to={isAdmin ? "/admin" : "/"} replace />
            : <PageTransitionWrapper routeKey={key}><AuthPage /></PageTransitionWrapper>
        } />

        <Route path="/upload"   element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><UploadPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/results"  element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><ResultsPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/results/:detectionId" element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><ResultsPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/dashboard"   element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><DashboardPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/history"     element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><HistoryPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/heatmap"     element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><HeatmapPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/predictions" element={<UserOnlyRoute><ErrorBoundary><PageTransitionWrapper routeKey={key}><PredictionsPage /></PageTransitionWrapper></ErrorBoundary></UserOnlyRoute>} />
        <Route path="/reports"     element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><ReportsPage /></PageTransitionWrapper></UserOnlyRoute>} />
        <Route path="/settings"    element={<UserOnlyRoute><PageTransitionWrapper routeKey={key}><SettingsPage /></PageTransitionWrapper></UserOnlyRoute>} />

        <Route path="/admin"          element={<ProtectedRoute requireAdmin><PageTransitionWrapper routeKey={key}><AdminDashboard /></PageTransitionWrapper></ProtectedRoute>} />
        <Route path="/admin/logs"     element={<ProtectedRoute requireAdmin><PageTransitionWrapper routeKey={key}><AdminLogs /></PageTransitionWrapper></ProtectedRoute>} />
        <Route path="/admin/users"    element={<ProtectedRoute requireAdmin><PageTransitionWrapper routeKey={key}><AdminUsers /></PageTransitionWrapper></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><PageTransitionWrapper routeKey={key}><AdminSettings /></PageTransitionWrapper></ProtectedRoute>} />

        <Route path="/privacy" element={<PageTransitionWrapper routeKey={key}><PrivacyPolicy /></PageTransitionWrapper>} />
        <Route path="*"        element={<PageTransitionWrapper routeKey={key}><NotFound /></PageTransitionWrapper>} />

      </Routes>
    </Suspense>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────

// Only show the assistant to authenticated users — not on the auth/login page
const AssistantGate = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <OceanAssistant /> : null;
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
            <AssistantGate />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
