import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Waves, Shield, BarChart3, Users } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (isAdmin) {
        // Always redirect admins to admin panel
        navigate('/admin', { replace: true });
      } else {
        // For regular users, only redirect if they came from a protected route
        const from = location.state?.from?.pathname;
        if (from && from !== '/auth') {
          navigate(from, { replace: true });
        } else {
          // If no specific route, let them stay on auth page or go to home
          navigate('/', { replace: true });
        }
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate, location]);

  const handleAuthSuccess = () => {
    if (isAdmin) {
      // Always redirect admins to admin panel
      navigate('/admin', { replace: true });
    } else {
      // For regular users, redirect to where they came from or home
      const from = location.state?.from?.pathname;
      if (from && from !== '/auth') {
        navigate(from, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-12 flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center space-x-3 mb-8">
            <Waves className="h-10 w-10" />
            <h1 className="text-3xl font-bold">Marine Detection</h1>
          </div>
          
          <h2 className="text-4xl font-bold mb-6">
            AI-Powered Ocean Protection
          </h2>
          
          <p className="text-xl mb-12 text-blue-100">
            Advanced marine plastic pollution detection and prediction system using 
            cutting-edge computer vision and machine learning.
          </p>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Real-time Detection</h3>
                <p className="text-blue-100">Upload images and videos for instant pollution analysis</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 p-3 rounded-lg">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Predictive Analytics</h3>
                <p className="text-blue-100">LSTM-powered pollution trend forecasting</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Multi-user Platform</h3>
                <p className="text-blue-100">Collaborative research and data sharing</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Waves className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Marine Detection</h1>
            </div>
            <p className="text-gray-600">AI-Powered Ocean Protection</p>
          </div>

          <AnimatePresence mode="wait">
            {isLogin ? (
              <LoginForm
                key="login"
                onSwitchToRegister={() => setIsLogin(false)}
                onSuccess={handleAuthSuccess}
              />
            ) : (
              <RegisterForm
                key="register"
                onSwitchToLogin={() => setIsLogin(true)}
                onSuccess={handleAuthSuccess}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}