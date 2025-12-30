import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import HeatmapPage from "./pages/HeatmapPage";
import PredictionsPage from "./pages/PredictionsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/heatmap" element={<HeatmapPage />} />
            <Route path="/predictions" element={
              <ErrorBoundary>
                <PredictionsPage />
              </ErrorBoundary>
            } />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
