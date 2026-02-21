/**
 * Lazy-loaded route components for code splitting
 * Reduces initial bundle size and improves load time
 */

import { lazy } from 'react';

// Lazy load all page components
export const HomePage = lazy(() => import('./pages/HomePage'));
export const UploadPage = lazy(() => import('./pages/UploadPage'));
export const ResultsPage = lazy(() => import('./pages/ResultsPage'));
export const DashboardPage = lazy(() => import('./pages/DashboardPage'));
export const HistoryPage = lazy(() => import('./pages/HistoryPage'));
export const HeatmapPage = lazy(() => import('./pages/HeatmapPage'));
export const PredictionsPage = lazy(() => import('./pages/PredictionsPage'));
export const ReportsPage = lazy(() => import('./pages/ReportsPage'));
export const SettingsPage = lazy(() => import('./pages/SettingsPage'));
export const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
export const AdminLogs = lazy(() => import('./pages/AdminLogs'));
export const AdminUsers = lazy(() => import('./pages/AdminUsers'));
export const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
export const AuthPage = lazy(() => import('./pages/AuthPage'));
export const NotFound = lazy(() => import('./pages/NotFound'));
