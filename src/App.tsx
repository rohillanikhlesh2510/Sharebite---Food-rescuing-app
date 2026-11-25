import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getRoleDashboardPath } from './services/auth';
import { lazyWithRetry } from './lib/lazyWithRetry';
import ErrorBoundary from './components/states/ErrorBoundary';
import AuthStateScreen from './components/states/AuthStateScreen';
import './index.css';

// Public pages (LandingPage & NotFoundPage eager for reliable entry/fallback)
import LandingPage from './pages/public/LandingPage';
import NotFoundPage from './pages/public/NotFoundPage';
const AboutPage = lazyWithRetry(() => import('./pages/public/AboutPage'));
const HowItWorksPage = lazyWithRetry(() => import('./pages/public/HowItWorksPage'));
const PublicImpactPage = lazyWithRetry(() => import('./pages/public/PublicImpactPage'));
const PartnersPage = lazyWithRetry(() => import('./pages/public/PartnersPage'));

// Auth pages
const RoleSelectPage = lazyWithRetry(() => import('./pages/auth/RoleSelectPage'));
const DonorRegisterPage = lazyWithRetry(() => import('./pages/auth/DonorRegisterPage'));
const AcceptorRegisterPage = lazyWithRetry(() => import('./pages/auth/AcceptorRegisterPage'));
const RiderRegisterPage = lazyWithRetry(() => import('./pages/auth/RiderRegisterPage'));
const SingleRoleAuthPage = lazyWithRetry(() => import('./pages/auth/SingleRoleAuthPage'));
const AuthCallbackPage = lazyWithRetry(() => import('./pages/auth/AuthCallbackPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/auth/ResetPasswordPage'));

// App layout & pages
const AppShell = lazyWithRetry(() => import('./components/layout/AppShell'));
const RoleBasedDashboard = lazyWithRetry(() => import('./components/layout/RoleBasedDashboard'));
const RoleRouteGuard = lazyWithRetry(() => import('./components/layout/RoleRouteGuard'));
const DonorDashboardPage = lazyWithRetry(() => import('./pages/app/DonorDashboardPage'));
const BeneficiaryDashboardPage = lazyWithRetry(() => import('./pages/app/BeneficiaryDashboardPage'));
const DonationsPage = lazyWithRetry(() => import('./pages/app/DonationsPage'));
const CreateDonationPage = lazyWithRetry(() => import('./pages/app/CreateDonationPage'));
const DonationDetailPage = lazyWithRetry(() => import('./pages/app/DonationDetailPage'));
const DiscoverPage = lazyWithRetry(() => import('./pages/app/DiscoverPage'));
const MapPage = lazyWithRetry(() => import('./pages/app/MapPage'));
const RequestsPage = lazyWithRetry(() => import('./pages/app/RequestsPage'));
const NotificationsPage = lazyWithRetry(() => import('./pages/app/NotificationsPage'));
const ImpactDashboardPage = lazyWithRetry(() => import('./pages/app/ImpactDashboardPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/app/ProfilePage'));
const SettingsPage = lazyWithRetry(() => import('./pages/app/SettingsPage'));
const VerificationPage = lazyWithRetry(() => import('./pages/app/VerificationPage'));
const AdminPage = lazyWithRetry(() => import('./pages/app/AdminPage'));
const RiderDashboardPage = lazyWithRetry(() => import('./pages/app/RiderDashboardPage'));
const RiderDeliveriesPage = lazyWithRetry(() => import('./pages/app/RiderDeliveriesPage'));
const RiderEarningsPage = lazyWithRetry(() => import('./pages/app/RiderEarningsPage'));
const NGOClaimsDashboard = lazyWithRetry(() => import('./pages/app/NGOClaimsDashboard'));
const DonorDonationsStatus = lazyWithRetry(() => import('./pages/app/DonorDonationsStatus'));
const ChatPage = lazyWithRetry(() => import('./pages/app/ChatPage'));
const NGODiscoveryPage = lazyWithRetry(() => import('./pages/app/NGODiscoveryPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const handleSessionReset = () => {
  queryClient.clear();
};

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, authStatus, authError, retryAuth, logout } = useAuth();

  if (authStatus === 'initializing' || authStatus === 'loading_profile') {
    return (
      <AuthStateScreen
        mode="loading"
        message={
          authStatus === 'loading_profile'
            ? 'Loading your profile & role permissions...'
            : 'Checking your ShareBite session...'
        }
      />
    );
  }

  if (authStatus === 'error' || authStatus === 'profile_missing' || authStatus === 'invalid_role') {
    return (
      <AuthStateScreen
        mode={authStatus}
        message={authError}
        onRetry={retryAuth}
        onSignOut={logout}
      />
    );
  }

  if (!user) {
    return <Navigate to="/register" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, authStatus, authError, retryAuth, logout } = useAuth();

  if (authStatus === 'initializing' || authStatus === 'loading_profile') {
    return (
      <AuthStateScreen
        mode="loading"
        message="Checking your ShareBite session..."
      />
    );
  }

  if (authStatus === 'error' || authStatus === 'profile_missing' || authStatus === 'invalid_role') {
    return (
      <AuthStateScreen
        mode={authStatus}
        message={authError}
        onRetry={retryAuth}
        onSignOut={logout}
      />
    );
  }

  if (user) {
    const destination = getRoleDashboardPath(user.role);
    if (!destination) {
      return (
        <AuthStateScreen
          mode="invalid_role"
          message={`Your account has an unrecognized role ("${user.role}").`}
          onRetry={retryAuth}
          onSignOut={logout}
        />
      );
    }
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}

function AppLoading() {
  return <AuthStateScreen mode="loading" message="Loading ShareBite..." />;
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
    <ErrorBoundary fallbackTitle="Page could not load">
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
          {/* Dedicated pages per role (Register mode) */}
          <Route path="/register/donor" element={<PublicOnlyRoute><DonorRegisterPage initialMode="register" /></PublicOnlyRoute>} />
          <Route path="/register/acceptor" element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="register" /></PublicOnlyRoute>} />
          <Route path="/register/ngo" element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="register" /></PublicOnlyRoute>} />
          <Route path="/register/rider" element={<PublicOnlyRoute><RiderRegisterPage initialMode="register" /></PublicOnlyRoute>} />
          <Route path="/register/community" element={<PublicOnlyRoute><SingleRoleAuthPage forcedRole="community" initialMode="signup" /></PublicOnlyRoute>} />
          <Route path="/register/:role" element={<PublicOnlyRoute><SingleRoleAuthPage initialMode="signup" /></PublicOnlyRoute>} />

          {/* Dedicated pages per role (Login mode) */}
          <Route path="/login" element={<Navigate to="/register" replace />} />
          <Route path="/login/donor" element={<PublicOnlyRoute><DonorRegisterPage initialMode="login" /></PublicOnlyRoute>} />
          <Route path="/login/acceptor" element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="login" /></PublicOnlyRoute>} />
          <Route path="/login/ngo" element={<PublicOnlyRoute><AcceptorRegisterPage initialMode="login" /></PublicOnlyRoute>} />
          <Route path="/login/rider" element={<PublicOnlyRoute><RiderRegisterPage initialMode="login" /></PublicOnlyRoute>} />
          <Route path="/login/community" element={<PublicOnlyRoute><SingleRoleAuthPage forcedRole="community" initialMode="login" /></PublicOnlyRoute>} />
          <Route path="/login/:role" element={<PublicOnlyRoute><SingleRoleAuthPage initialMode="login" /></PublicOnlyRoute>} />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected App with Role-Based Separation & Route Guards */}
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            {/* Universal root dashboard: auto-renders the role-specific dashboard */}
            <Route path="/dashboard" element={<RoleBasedDashboard />} />

            {/* Role 1: Food Donor Experience */}
            <Route path="/donor-dashboard" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><DonorDashboardPage /></RoleRouteGuard>} />
            <Route path="/donor/dashboard" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><DonorDashboardPage /></RoleRouteGuard>} />
            <Route path="/donations/new" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><CreateDonationPage /></RoleRouteGuard>} />
            <Route path="/donor/donate" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><CreateDonationPage /></RoleRouteGuard>} />
            <Route path="/donations/:id/edit" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><CreateDonationPage /></RoleRouteGuard>} />
            <Route path="/donor-donations" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><DonorDonationsStatus /></RoleRouteGuard>} />
            <Route path="/donor/my-donations" element={<RoleRouteGuard allowedRoles={['donor', 'partner', 'household', 'admin']}><DonorDonationsStatus /></RoleRouteGuard>} />
            <Route path="/donations" element={<DonationsPage />} />
            <Route path="/donations/:id" element={<DonationDetailPage />} />

            {/* Role 2: Logistics / Delivery Rider Experience */}
            <Route path="/rider-dashboard" element={<RoleRouteGuard allowedRoles={['rider', 'volunteer', 'admin']}><RiderDashboardPage /></RoleRouteGuard>} />
            <Route path="/rider/dashboard" element={<RoleRouteGuard allowedRoles={['rider', 'volunteer', 'admin']}><RiderDashboardPage /></RoleRouteGuard>} />
            <Route path="/rider/available-food" element={<RoleRouteGuard allowedRoles={['rider', 'volunteer', 'admin']}><RiderDeliveriesPage /></RoleRouteGuard>} />
            <Route path="/rider/deliveries" element={<RoleRouteGuard allowedRoles={['rider', 'volunteer', 'admin']}><RiderDeliveriesPage /></RoleRouteGuard>} />
            <Route path="/rider/earnings" element={<RoleRouteGuard allowedRoles={['rider', 'volunteer', 'admin']}><RiderEarningsPage /></RoleRouteGuard>} />

            {/* Role 3: NGO / Community Acceptor Experience */}
            <Route path="/my-claims" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']}><NGOClaimsDashboard /></RoleRouteGuard>} />
            <Route path="/ngo-dashboard" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']}><NGOClaimsDashboard /></RoleRouteGuard>} />
            <Route path="/ngo/dashboard" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']}><NGOClaimsDashboard /></RoleRouteGuard>} />
            <Route path="/ngo/collections" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']}><NGOClaimsDashboard /></RoleRouteGuard>} />
            <Route path="/ngo/available-food" element={<RoleRouteGuard allowedRoles={['ngo', 'receiver', 'acceptor', 'admin']}><DiscoverPage /></RoleRouteGuard>} />

            {/* Role 4: Beneficiary / Community Member Experience */}
            <Route path="/community-dashboard" element={<RoleRouteGuard allowedRoles={['community', 'admin']}><BeneficiaryDashboardPage /></RoleRouteGuard>} />

            {/* Shared Authorized Modules */}
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/impact-dashboard" element={<ImpactDashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/verification" element={<VerificationPage />} />
            <Route path="/admin" element={<RoleRouteGuard allowedRoles={['admin']}><AdminPage /></RoleRouteGuard>} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:conversationId" element={<ChatPage />} />
            <Route path="/ngos" element={<NGODiscoveryPage />} />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider onSessionReset={handleSessionReset}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
