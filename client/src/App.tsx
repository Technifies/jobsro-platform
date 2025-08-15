import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

// Layout Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Existing Pages
import HomePage from './pages/public/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Dashboards
import JobSeekerDashboard from './pages/jobseeker/Dashboard';
import EmployerDashboard from './pages/employer/Dashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

// Guards and Utils
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicRoute from './components/auth/PublicRoute';
import AuthChecker from './components/auth/AuthChecker';
import ScrollToTop from './components/common/ScrollToTop';

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AuthChecker />
      <ScrollToTop />
      
      <Header />
      
      <Box component="main" sx={{ flex: 1, pt: { xs: 7, sm: 8 } }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />

          {/* Auth Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />

          {/* Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['jobSeeker']}>
              <JobSeekerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/employer" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <EmployerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* 404 Route */}
          <Route path="*" element={
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </Box>
          } />
        </Routes>
      </Box>
      
      <Footer />
    </Box>
  );
}

export default App;