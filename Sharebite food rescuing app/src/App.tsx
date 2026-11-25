import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getRoleDashboardPath } from './services/auth';
import './index.css';

// Public pages (LandingPage eager for instant LCP, secondary public pages lazy)
import LandingPage from './pages/public/LandingPage';
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const HowItWorksPage = lazy(() => import('./pages/public/HowItWorksPage'));
const PublicImpactPage = lazy(() => import('./pages/public/PublicImpactPage'));
const PartnersPage = lazy(() => import('./pages/public/PartnersPage'));

// Auth pages
const RoleSelectPage = lazy(() => import('./pages/auth/RoleSelectPage'));
const DonorRegisterPage = lazy(() => import('./pages/auth/DonorRegisterPage'));
const AcceptorRegisterPage = lazy(() => import('./pages/auth/AcceptorRegisterPage'));
const RiderRegisterPage = lazy(() => import('./pages/auth/RiderRegisterPage'));
const SingleRoleAuthPage = lazy(() => import('./pages/auth/SingleRoleAuthPage'));
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallbackPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));

// App layout & pages
const AppShell = lazy(() => import('./components/layout/AppShell'));
const RoleBasedDashboard = lazy(() => import('./components/layout/RoleBasedDashboard'));
const RoleRouteGuard = lazy(() => import('./components/layout/RoleRouteGuard'));
const DonorDashboardPage = lazy(() => import('./pages/app/DonorDashboardPage'));
const BeneficiaryDashboardPage = lazy(() => import('./pages/app/BeneficiaryDashboardPage'));
const DonationsPage = lazy(() => import('./pages/app/DonationsPage'));
const CreateDonationPage = lazy(() => import('./pages/app/CreateDonationPage'));
const DonationDetailPage = lazy(() => import('./pages/app/DonationDetailPage'));
const DiscoverPage = lazy(() => import('./pages/app/DiscoverPage'));
const MapPage = lazy(() => import('./pages/app/MapPage'));
const RequestsPage = lazy(() => import('./pages/app/RequestsPage'));
const NotificationsPage = lazy(() => import('./pages/app/NotificationsPage'));
const ImpactDashboardPage = lazy(() => import('./pages/app/ImpactDashboardPage'));
const ProfilePage = lazy(() => import('./pages/app/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage'));
const VerificationPage = lazy(() => import('./pages/app/VerificationPage'));
const AdminPage = lazy(() => import('./pages/app/AdminPage'));
const RiderDashboardPage = lazy(() => import('./pages/app/RiderDashboardPage'));
const NGOClaimsDashboard = lazy(() => import('./pages/app/NGOClaimsDashboard'));
const DonorDonationsStatus = lazy(() => import('./pages/app/DonorDonationsStatus'));
const ChatPage = lazy(() => import('./pages/app/ChatPage'));
const NGODiscoveryPage = lazy(() => import('./pages/app/NGODiscoveryPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/register" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (user) return <Navigate to={getRoleDashboardPath(user.role)} replace />;
  return <>{children}</>;
}

function AppLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--color-bg)',
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid var(--color-primary-100)',
        borderTopColor: 'var(--color-primary)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

function RootRoute() {
  const location = useLocation();

  // If Supabase returned with an OAuth access_token in the hash or code in search params
  if (location.hash.includes('access_token=') || location.search.includes('code=')) {
    return <Navigate to={`/auth/callback${location.search}${location.hash}`} replace />;
  }

  return <LandingPage />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/impact" element={<PublicImpactPage />} />
        <Route path="/partners" element={<PartnersPage />} />

        {/* Role-Based Auth Routes: First Select Role -> Then Dedicated Single Form */}
        <Route path="/register" element={<PublicOnlyRoute><RoleSelectPage initialMode="signup" /></PublicOnlyRoute>} />
        {/* Ultra-HiFi dedicated pages per role (Register mode) */}
        <Route path="/register/donor"     element={<PublicOnlyRoute><DonorRegisterPage initialMode="register" /></PublicOnlyRoute>} />
        <Route path="/register/acceptor"  element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="register" /></PublicOnlyRoute>} />
        <Route path="/register/ngo"       element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="register" /></PublicOnlyRoute>} />
        <Route path="/register/rider"     element={<PublicOnlyRoute><RiderRegisterPage initialMode="register" /></PublicOnlyRoute>} />
        <Route path="/register/community" element={<PublicOnlyRoute><SingleRoleAuthPage forcedRole="community" initialMode="signup" /></PublicOnlyRoute>} />
        <Route path="/register/:role"     element={<PublicOnlyRoute><SingleRoleAuthPage initialMode="signup" /></PublicOnlyRoute>} />

        {/* Ultra-HiFi dedicated pages per role (Login mode) */}
        <Route path="/login"              element={<Navigate to="/register" replace />} />
        <Route path="/login/donor"        element={<PublicOnlyRoute><DonorRegisterPage initialMode="login" /></PublicOnlyRoute>} />
        <Route path="/login/acceptor"     element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="login" /></PublicOnlyRoute>} />
        <Route path="/login/ngo"          element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="login" /></PublicOnlyRoute>} />
        <Route path="/login/rider"        element={<PublicOnlyRoute><RiderRegisterPage initialMode="login" /></PublicOnlyRoute>} />
        <Route path="/login/community"    element={<PublicOnlyRoute><SingleRoleAuthPage forcedRole="community" initialMode="login" /></PublicOnlyRoute>} />
        <Route path="/login/:role"        element={<PublicOnlyRoute><SingleRoleAuthPage initialMode="login" /></PublicOnlyRoute>} />
        <Route path="/signup" element={<Navigate to="/register" replace />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected App with Role-Based Separation & Route Guards */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          {/* Universal root dashboard: auto-renders the role-specific dashboard */}
          <Route path="/dashboard" element={<RoleBasedDashboard />} />

          {/* Role 1: Food Donor Experience */}
          <Route path="/donor-dashboard" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'admin']} fallbackPath="/dashboard"><DonorDashboardPage /></RoleRouteGuard>} />
          <Route path="/donations/new" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'admin']} fallbackPath="/dashboard"><CreateDonationPage /></RoleRouteGuard>} />
          <Route path="/donations/:id/edit" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'admin']} fallbackPath="/dashboard"><CreateDonationPage /></RoleRouteGuard>} />
          <Route path="/donor-donations" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'admin']} fallbackPath="/dashboard"><DonorDonationsStatus /></RoleRouteGuard>} />
          <Route path="/donations" element={<DonationsPage />} />
          <Route path="/donations/:id" element={<DonationDetailPage />} />

          {/* Role 2: Logistics / Delivery Rider Experience */}
          <Route path="/rider-dashboard" element={<RoleRouteGuard allowedRoles={['rider', 'volunteer', 'admin']} fallbackPath="/dashboard"><RiderDashboardPage /></RoleRouteGuard>} />

          {/* Role 3: NGO / Community Acceptor Experience */}
          <Route path="/my-claims" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']} fallbackPath="/dashboard"><NGOClaimsDashboard /></RoleRouteGuard>} />
          <Route path="/ngo-dashboard" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']} fallbackPath="/dashboard"><NGOClaimsDashboard /></RoleRouteGuard>} />

          {/* Role 4: Beneficiary / Community Member Experience */}
          <Route path="/community-dashboard" element={<RoleRouteGuard allowedRoles={['community', 'receiver', 'admin']} fallbackPath="/dashboard"><BeneficiaryDashboardPage /></RoleRouteGuard>} />

          {/* Shared Authorized Modules */}
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/impact-dashboard" element={<ImpactDashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/admin" element={<RoleRouteGuard allowedRoles={['admin']} fallbackPath="/dashboard"><AdminPage /></RoleRouteGuard>} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/ngos" element={<NGODiscoveryPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
