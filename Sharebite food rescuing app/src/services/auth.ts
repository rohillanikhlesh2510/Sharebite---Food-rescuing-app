// ShareBite — Auth Service (Web)
import { supabase } from '../lib/supabase';
import { isValidUUID, DEMO_RECORD_UUIDS, LEGACY_DEMO_ID_MAP } from '../lib/uuid';
import type { User, UserRole } from '../types';

const MOCK_STORAGE_KEY = 'sharebite_mock_session_user';
const OAUTH_ROLE_KEY = 'sharebite_oauth_role';

/**
 * Maps a user's role to their designated dashboard route.
 * Never assigns the Rider dashboard or role as a fallback for other roles.
 */
export function getRoleDashboardPath(role?: UserRole | string | null): string {
  if (!role) return '/donor-dashboard';
  switch (role) {
    case 'rider':
    case 'volunteer':
      return '/rider-dashboard';
    case 'ngo':
    case 'receiver':
    case 'acceptor':
      return '/ngo-dashboard';
    case 'community':
      return '/community-dashboard';
    case 'admin':
      return '/admin';
    case 'donor':
    case 'partner':
    default:
      return '/donor-dashboard';
  }
}

export const DEMO_USERS: Record<string, User> = {
  donor: {
    id: DEMO_RECORD_UUIDS.donor,
    name: 'Anubhav',
    email: 'anubhav@sharebite.org',
    phone: '+91 98101 23456',
    role: 'donor',
    organizationName: 'Community Kitchen',
    avatar: '',
    bio: 'Doing good today! 🌱 Committed to zero food waste and daily food drives.',
    location: {
      latitude: 28.6315,
      longitude: 77.2167,
      address: 'Connaught Place, Central Delhi',
      city: 'Delhi',
      pincode: '110001',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 14,
    totalRescues: 0,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
  },
  ngo: {
    id: DEMO_RECORD_UUIDS.ngo,
    name: 'Robin Hood Army Delhi',
    email: 'ngo@sharebite.org',
    phone: '+91 98202 34567',
    role: 'ngo',
    organizationName: 'Robin Hood Army (Delhi Chapter)',
    registrationNumber: 'NGO-DEL-8921',
    avatar: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150',
    bio: 'Volunteer organization distributing food to homeless shelters, orphanages and slum clusters.',
    location: {
      latitude: 28.5244,
      longitude: 77.2066,
      address: 'Saket, South Delhi',
      city: 'Delhi',
      pincode: '110017',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 0,
    totalRescues: 54,
    createdAt: '2024-01-10T10:00:00.000Z',
    updatedAt: '2024-01-10T10:00:00.000Z',
  },
  rider: {
    id: DEMO_RECORD_UUIDS.rider,
    name: 'Kabir Sharma',
    email: 'rider@sharebite.org',
    phone: '+91 98505 67890',
    role: 'rider',
    organizationName: 'ShareBite Logistics Fleet',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    bio: 'Dedicated delivery rider transporting fresh surplus meals across Delhi NCR.',
    location: {
      latitude: 28.6139,
      longitude: 77.2090,
      address: 'Central Delhi',
      city: 'Delhi',
      pincode: '110001',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 0,
    totalRescues: 48,
    createdAt: '2024-02-15T10:00:00.000Z',
    updatedAt: '2024-02-15T10:00:00.000Z',
  },
  volunteer: {
    id: DEMO_RECORD_UUIDS.volunteer,
    name: 'Priya Patel',
    email: 'volunteer@sharebite.org',
    phone: '+91 98303 45678',
    role: 'volunteer',
    organizationName: 'City Angels Relief',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    bio: 'Passionate volunteer rider helping transport meals from restaurants to community centers.',
    location: {
      latitude: 28.5672,
      longitude: 77.2100,
      address: 'Green Park, South Delhi',
      city: 'Delhi',
      pincode: '110016',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 6,
    totalRescues: 39,
    createdAt: '2024-02-01T10:00:00.000Z',
    updatedAt: '2024-02-01T10:00:00.000Z',
  },
  admin: {
    id: DEMO_RECORD_UUIDS.admin,
    name: 'ShareBite Admin',
    email: 'admin@sharebite.org',
    phone: '+91 98404 56789',
    role: 'admin',
    organizationName: 'ShareBite Operations',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Platform administration, verification verification, and safety operations.',
    location: {
      latitude: 28.6315,
      longitude: 77.2167,
      address: 'Barakhamba Road, New Delhi',
      city: 'Delhi',
      pincode: '110001',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 40,
    totalRescues: 95,
    createdAt: '2023-12-01T10:00:00.000Z',
    updatedAt: '2023-12-01T10:00:00.000Z',
  },
};

function mapProfileToUser(profile: any): User {
  const bio = profile.bio || '';
  const dobMatch = bio.startsWith('DOB: ') ? bio.replace('DOB: ', '').trim() : undefined;

  return {
    id: profile.id,
    name: profile.full_name || profile.organization_name || 'ShareBite Member',
    email: profile.email || '',
    phone: profile.phone || '',
    role: (profile.role as UserRole) || 'donor',
    avatar: profile.avatar_url,
    bio: profile.bio,
    organizationName: profile.organization_name,
    registrationNumber: profile.registration_number,
    dateOfBirth: dobMatch,
    location: profile.latitude ? {
      latitude: profile.latitude,
      longitude: profile.longitude,
      address: profile.address || '',
      city: profile.city || '',
    } : profile.address ? {
      latitude: 0,
      longitude: 0,
      address: profile.address,
      city: profile.city || '',
    } : undefined,
    isVerified: profile.is_verified || false,
    verificationStatus: profile.verification_status || (profile.is_verified ? 'verified' : 'pending'),
    totalDonations: profile.total_donations || 0,
    totalRescues: profile.total_rescues || 0,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function getStoredMockUser(): User | null {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;

    // Discard or sanitize non-UUID IDs (e.g. legacy 'demo-donor-001')
    if (!isValidUUID(parsed.id)) {
      if (LEGACY_DEMO_ID_MAP[parsed.id]) {
        parsed.id = LEGACY_DEMO_ID_MAP[parsed.id];
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
      localStorage.removeItem(MOCK_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setStoredMockUser(user: User | null) {
  try {
    if (user) {
      if (!isValidUUID(user.id) && LEGACY_DEMO_ID_MAP[user.id]) {
        user = { ...user, id: LEGACY_DEMO_ID_MAP[user.id] };
      }
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(MOCK_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('sharebite_auth_update', { detail: user }));
  } catch {}
}

export const AuthService = {
  getMockUser(): User | null {
    return getStoredMockUser();
  },

  loginAsDemoRole(role: 'donor' | 'ngo' | 'rider' | 'volunteer' | 'admin'): User {
    const target = DEMO_USERS[role] || DEMO_USERS.donor;
    setStoredMockUser(target);
    return target;
  },

  async getCurrentUser(): Promise<User | null> {
    // 1. Check active Supabase session FIRST
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Clear lingering mock storage when real auth session exists
        if (localStorage.getItem(MOCK_STORAGE_KEY)) {
          localStorage.removeItem(MOCK_STORAGE_KEY);
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile) {
          const meta = session.user.user_metadata || {};
          return {
            id: session.user.id,
            name: meta.full_name || meta.name || 'User',
            email: session.user.email || '',
            phone: meta.phone || '',
            role: (meta.role as UserRole) || 'donor',
            isVerified: false,
            verificationStatus: 'pending',
            totalDonations: 0,
            totalRescues: 0,
            createdAt: session.user.created_at,
            updatedAt: session.user.created_at,
          };
        }

        return mapProfileToUser(profile);
      }
    } catch {
      // Fall through to mock session if session check fails
    }

    // 2. Check local mock session (guaranteed valid UUID)
    const mock = getStoredMockUser();
    if (mock) return mock;

    return null;
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  async login(email: string, password?: string, expectedRole?: UserRole | 'acceptor'): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if email matches pre-configured demo account
    const matchedDemo = Object.values(DEMO_USERS).find(u => u.email.toLowerCase() === cleanEmail);
    if (matchedDemo) {
      setStoredMockUser(matchedDemo);
      return matchedDemo;
    }

    // 2. Real Supabase password authentication
    if (!password) {
      throw new Error('Please enter your password.');
    }

    // Proactively clear any mock storage BEFORE initiating Supabase sign-in
    // so onAuthStateChange doesn't catch stale mock users
    setStoredMockUser(null);
    try {
      localStorage.removeItem(MOCK_STORAGE_KEY);
    } catch {}

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      throw new Error(error.message || 'Invalid email or password.');
    }

    if (!data.user) {
      throw new Error('Login failed. Please check your credentials.');
    }

    // Ensure mock user is purged
    setStoredMockUser(null);
    try {
      localStorage.removeItem(MOCK_STORAGE_KEY);
    } catch {}

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    let userObj: User;
    if (profile) {
      userObj = mapProfileToUser(profile);
    } else {
      const meta = data.user.user_metadata || {};
      userObj = {
        id: data.user.id,
        name: meta.full_name || meta.name || 'User',
        email: data.user.email || '',
        phone: meta.phone || '',
        role: (meta.role as UserRole) || 'donor',
        isVerified: false,
        verificationStatus: 'pending',
        totalDonations: 0,
        totalRescues: 0,
        createdAt: data.user.created_at,
        updatedAt: data.user.created_at,
      };
    }

    // 3. Role mismatch verification check
    if (expectedRole) {
      const effectiveExpected = expectedRole === 'acceptor' ? 'ngo' : expectedRole;
      if (userObj.role !== effectiveExpected) {
        const readableUserRole = userObj.role === 'ngo' ? 'Acceptor (NGO / Shelter)' : userObj.role === 'donor' ? 'Food Donor' : userObj.role === 'rider' ? 'Rider' : userObj.role;
        const correctLoginRoute = userObj.role === 'ngo' ? '/login/acceptor' : userObj.role === 'rider' ? '/login/rider' : '/login/donor';
        throw new Error(
          `ROLE_MISMATCH: Your account is registered as a "${readableUserRole}". Please log in via the ${readableUserRole} portal at ${correctLoginRoute}.`
        );
      }
    }

    return userObj;
  },

  async signup(data: {
    name: string;
    phone: string;
    email: string;
    role: UserRole | 'acceptor';
    password: string;
    organizationName?: string;
    registrationNumber?: string;
    address?: string;
    city?: string;
    dateOfBirth?: string;
  }): Promise<{ user: User; sessionExists: boolean }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const effectiveRole: UserRole = data.role === 'acceptor' ? 'ngo' : data.role;

    // 1. Real Supabase signup
    const { data: authData, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: data.password,
      options: {
        data: {
          full_name: data.name,
          phone: data.phone,
          role: effectiveRole,
          organization_name: data.organizationName || null,
          registration_number: data.registrationNumber || null,
          address: data.address || null,
          city: data.city || null,
          date_of_birth: data.dateOfBirth || null,
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Signup failed. Please try again.');
    }

    if (!authData.user) {
      throw new Error('Could not create account. Please check your information.');
    }

    const sessionExists = !!authData.session;
    const userId = authData.user.id;

    // 2. Safe profile creation / upsert
    const bioText = data.dateOfBirth ? `DOB: ${data.dateOfBirth}` : null;
    const profilePayload: any = {
      id: userId,
      full_name: data.name,
      email: cleanEmail,
      phone: data.phone,
      role: effectiveRole,
      organization_name: data.organizationName || null,
      registration_number: data.registrationNumber || null,
      address: data.address || null,
      city: data.city || null,
      bio: bioText,
      is_verified: false,
      verification_status: 'pending',
    };

    try {
      await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    } catch (upsertErr) {
      console.warn('Profile upsert warning:', upsertErr);
    }

    // 3. For Riders: initialize row in riders table
    if (effectiveRole === 'rider') {
      try {
        await supabase.from('riders').upsert({
          user_id: userId,
          name: data.name,
          phone: data.phone,
          is_online: false,
          is_available: true,
          id_verified: false,
        }, { onConflict: 'user_id' });
      } catch (riderErr) {
        console.warn('Rider record initialization warning:', riderErr);
      }
    }

    // 4. For Acceptors / NGOs: initialize partners entry
    if (effectiveRole === 'ngo' && data.organizationName) {
      try {
        await supabase.from('partners').upsert({
          profile_id: userId,
          organization_name: data.organizationName,
          organization_type: 'ngo',
          address: data.address || null,
          city: data.city || null,
          is_verified: false,
        }, { onConflict: 'profile_id' });
      } catch (partnerErr) {
        console.warn('Partners record initialization warning:', partnerErr);
      }
    }

    const realUser: User = {
      id: userId,
      name: data.name,
      email: cleanEmail,
      phone: data.phone,
      role: effectiveRole,
      organizationName: data.organizationName,
      registrationNumber: data.registrationNumber,
      dateOfBirth: data.dateOfBirth,
      isVerified: false,
      verificationStatus: 'pending',
      totalDonations: 0,
      totalRescues: 0,
      createdAt: authData.user.created_at,
      updatedAt: authData.user.created_at,
    };

    if (sessionExists) {
      setStoredMockUser(null);
    }

    return { user: realUser, sessionExists };
  },

  async signInWithGoogle(intendedRole: 'donor' | 'acceptor' | 'rider'): Promise<void> {
    const effectiveRole = intendedRole === 'acceptor' ? 'ngo' : intendedRole;
    try {
      localStorage.setItem(OAUTH_ROLE_KEY, effectiveRole);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.warn('Supabase Google OAuth issue:', err);
      const msg = (err?.message || '').toLowerCase();
      // If provider not configured or enabled in Supabase, fallback to verified Google user
      if (
        msg.includes('provider is not enabled') ||
        msg.includes('unsupported provider') ||
        msg.includes('not configured') ||
        msg.includes('invalid provider') ||
        msg.includes('failed to fetch')
      ) {
        const mockGoogleUser: User = {
          id: `google-${effectiveRole}-${Date.now()}`,
          name: `${effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)} (Google)`,
          email: `${effectiveRole}.google@sharebite.org`,
          phone: '+91 98765 43210',
          role: effectiveRole as UserRole,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          bio: 'Google Account (Preview Mode)',
          isVerified: false,
          verificationStatus: 'pending',
          totalDonations: effectiveRole === 'donor' ? 8 : 0,
          totalRescues: effectiveRole === 'rider' ? 15 : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setStoredMockUser(mockGoogleUser);
        window.location.href = getRoleDashboardPath(effectiveRole);
        return;
      }
      throw new Error(err.message || 'Failed to start Google authentication.');
    }
  },

  async handleOAuthCallback(): Promise<User> {
    let activeUser: any = null;

    // 1. Try getSession
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) activeUser = session.user;
    } catch {}

    // 2. If no session, try getUser directly
    if (!activeUser) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) activeUser = user;
      } catch {}
    }

    if (!activeUser) {
      const stored = getStoredMockUser();
      if (stored) return stored;
      throw new Error('Google authentication session was not found. Please try logging in with your email & password.');
    }

    const user = activeUser;
    const intendedRole = (localStorage.getItem(OAUTH_ROLE_KEY) as UserRole) || 'donor';
    localStorage.removeItem(OAUTH_ROLE_KEY);

    // Check if profile exists
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfile) {
        setStoredMockUser(null);
        return mapProfileToUser(existingProfile);
      }
    } catch (e) {
      console.warn('Profile fetch warning in OAuth callback:', e);
    }

    // Create profile with intended role from Google metadata
    const meta = user.user_metadata || {};
    const fullName = meta.full_name || meta.name || user.email?.split('@')[0] || 'ShareBite Member';
    const profilePayload = {
      id: user.id,
      full_name: fullName,
      email: user.email || '',
      phone: meta.phone || '',
      avatar_url: meta.avatar_url || meta.picture || null,
      role: intendedRole,
      is_verified: false,
      verification_status: 'pending',
    };

    try {
      await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    } catch (e) {
      console.warn('Profile creation during OAuth callback warning:', e);
    }

    if (intendedRole === 'rider') {
      try {
        await supabase.from('riders').upsert({
          user_id: user.id,
          name: fullName,
          is_online: false,
          is_available: true,
          id_verified: false,
        }, { onConflict: 'user_id' });
      } catch {}
    }

    setStoredMockUser(null);
    return {
      id: user.id,
      name: fullName,
      email: user.email || '',
      phone: meta.phone || '',
      role: intendedRole,
      avatar: meta.avatar_url || meta.picture,
      isVerified: false,
      verificationStatus: 'pending',
      totalDonations: 0,
      totalRescues: 0,
      createdAt: user.created_at,
      updatedAt: user.created_at,
    };
  },

  async logout(): Promise<void> {
    setStoredMockUser(null);
    localStorage.removeItem(OAUTH_ROLE_KEY);
    try {
      await supabase.auth.signOut();
    } catch {}
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const mock = getStoredMockUser();
    if (mock && (mock.id === userId || mock.email === updates.email)) {
      const updated: User = {
        ...mock,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      setStoredMockUser(updated);
      return updated;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.name,
          phone: updates.phone,
          email: updates.email,
          avatar_url: updates.avatar,
          bio: updates.bio,
          organization_name: updates.organizationName,
          address: updates.location?.address,
          city: updates.location?.city,
          latitude: updates.location?.latitude,
          longitude: updates.location?.longitude,
        })
        .eq('id', userId)
        .select()
        .single();

      if (error || !profile) throw error || new Error('Profile update failed.');
      return mapProfileToUser(profile);
    } catch (err) {
      if (mock) {
        const updated = { ...mock, ...updates };
        setStoredMockUser(updated);
        return updated;
      }
      throw err;
    }
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    const handleCustomEvent = (e: any) => {
      callback(e.detail ?? null);
    };
    window.addEventListener('sharebite_auth_update', handleCustomEvent);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // 1. A real Supabase session ALWAYS takes absolute precedence over any local mock data
      if (session?.user) {
        // Purge mock storage so it never overrides or pollutes a real authenticated account
        setStoredMockUser(null);
        try {
          localStorage.removeItem(MOCK_STORAGE_KEY);
        } catch {}

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            callback(mapProfileToUser(profile));
            return;
          } else {
            const meta = session.user.user_metadata || {};
            callback({
              id: session.user.id,
              name: meta.full_name || meta.name || 'User',
              email: session.user.email || '',
              phone: meta.phone || '',
              role: (meta.role as UserRole) || 'donor',
              isVerified: false,
              verificationStatus: 'pending',
              totalDonations: 0,
              totalRescues: 0,
              createdAt: session.user.created_at,
              updatedAt: session.user.created_at,
            });
            return;
          }
        } catch {
          const meta = session.user.user_metadata || {};
          callback({
            id: session.user.id,
            name: meta.full_name || meta.name || 'User',
            email: session.user.email || '',
            phone: meta.phone || '',
            role: (meta.role as UserRole) || 'donor',
            isVerified: false,
            verificationStatus: 'pending',
            totalDonations: 0,
            totalRescues: 0,
            createdAt: session.user.created_at,
            updatedAt: session.user.created_at,
          });
          return;
        }
      }

      // 2. Only if there is NO real Supabase session, check for mock/demo session
      const currentMock = getStoredMockUser();
      if (currentMock) {
        callback(currentMock);
        return;
      }

      callback(null);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            window.removeEventListener('sharebite_auth_update', handleCustomEvent);
            subscription.unsubscribe();
          },
        },
      },
    };
  },
};
