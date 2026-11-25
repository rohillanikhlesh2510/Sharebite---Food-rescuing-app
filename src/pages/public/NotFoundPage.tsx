import { Link } from 'react-router-dom';
import { Home, ArrowRight, Compass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';

export default function NotFoundPage() {
  const { user } = useAuth();
  const dashboardPath = user ? getRoleDashboardPath(user.role) : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-bg, #FFFDF9)',
        color: '#1C1917',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: '#FFFFFF',
          borderRadius: 18,
          border: '1px solid #FED7AA',
          boxShadow: '0 10px 30px rgba(28, 25, 23, 0.07)',
          padding: '36px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: '#FFF7ED',
            color: '#EA580C',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Compass size={28} />
        </div>

        <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', fontWeight: 700, color: '#EA580C', letterSpacing: '0.08em' }}>
          404 — PAGE NOT FOUND
        </p>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', fontWeight: 700 }}>
          We couldn&apos;t find that page
        </h1>
        <p style={{ margin: '0 0 24px 0', fontSize: '0.94rem', color: '#57534E', lineHeight: 1.55 }}>
          The link may have moved or expired. Use the buttons below to return safely to ShareBite.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dashboardPath ? (
            <Link
              to={dashboardPath}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 10,
                background: '#EA580C',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'none',
              }}
            >
              <span>Go to My Dashboard</span>
              <ArrowRight size={16} />
            </Link>
          ) : (
            <Link
              to="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 10,
                background: '#EA580C',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'none',
              }}
            >
              <span>Sign In / Register</span>
              <ArrowRight size={16} />
            </Link>
          )}

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 18px',
              borderRadius: 10,
              border: '1px solid #E7E5E4',
              background: '#FFFFFF',
              color: '#1C1917',
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
            }}
          >
            <Home size={16} />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
