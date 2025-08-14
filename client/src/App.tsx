import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

// Layout Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Public Pages
import HomePage from './pages/public/HomePage';
import JobsPage from './pages/public/JobsPage';
import JobDetailPage from './pages/public/JobDetailPage';
import CompaniesPage from './pages/public/CompaniesPage';
import CompanyDetailPage from './pages/public/CompanyDetailPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import EmailVerificationPage from './pages/auth/EmailVerificationPage';

// Job Seeker Pages
import JobSeekerDashboard from './pages/jobseeker/Dashboard';
import ProfilePage from './pages/jobseeker/ProfilePage';
import ApplicationsPage from './pages/jobseeker/ApplicationsPage';
import SavedJobsPage from './pages/jobseeker/SavedJobsPage';
import JobAlertsPage from './pages/jobseeker/JobAlertsPage';
import InterviewsPage from './pages/jobseeker/InterviewsPage';

// Employer Pages
import EmployerDashboard from './pages/employer/Dashboard';
import PostJobPage from './pages/employer/PostJobPage';
import ManageJobsPage from './pages/employer/ManageJobsPage';
import CandidatesPage from './pages/employer/CandidatesPage';
import CompanyProfilePage from './pages/employer/CompanyProfilePage';
import SubscriptionPage from './pages/employer/SubscriptionPage';

// Admin Layout and Pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';

// Guards and Utils
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicRoute from './components/auth/PublicRoute';
import AuthChecker from './components/auth/AuthChecker';
import ScrollToTop from './components/common/ScrollToTop';
import LoadingSpinner from './components/common/LoadingSpinner';

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
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:slug" element={<JobDetailPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/:slug" element={<CompanyDetailPage />} />

          {/* Auth Routes - Only accessible when not logged in */}
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
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          } />
          <Route path="/verify-email" element={<EmailVerificationPage />} />

          {/* Job Seeker Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <JobSeekerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/applications" element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <ApplicationsPage />
            </ProtectedRoute>
          } />
          <Route path="/saved-jobs" element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <SavedJobsPage />
            </ProtectedRoute>
          } />
          <Route path="/job-alerts" element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <JobAlertsPage />
            </ProtectedRoute>
          } />
          <Route path="/interviews" element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <InterviewsPage />
            </ProtectedRoute>
          } />

          {/* Employer Protected Routes */}
          <Route path="/employer" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <EmployerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/employer/post-job" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <PostJobPage />
            </ProtectedRoute>
          } />
          <Route path="/employer/jobs" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <ManageJobsPage />
            </ProtectedRoute>
          } />
          <Route path="/employer/candidates" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <CandidatesPage />
            </ProtectedRoute>
          } />
          <Route path="/employer/company" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <CompanyProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/employer/subscription" element={
            <ProtectedRoute allowedRoles={['employer']}>
              <SubscriptionPage />
            </ProtectedRoute>
          } />

          {/* Admin Protected Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="jobs" element={<AdminDashboard />} />
            <Route path="applications" element={<AdminDashboard />} />
            <Route path="payments" element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminDashboard />} />
            <Route path="moderation" element={<AdminDashboard />} />
            <Route path="notifications" element={<AdminDashboard />} />
            <Route path="settings" element={<AdminDashboard />} />
            <Route path="actions" element={<AdminDashboard />} />
          </Route>

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