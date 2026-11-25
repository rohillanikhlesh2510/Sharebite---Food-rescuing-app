// ShareBite — Authoritative Supabase Auth Service (Web)
import { supabase } from '../lib/supabase';
import type { CanonicalRole, User, UserRole } from '../types';

const LEGACY_MOCK_STORAGE_KEY = 'sharebite_mock_session_user';
const OAUTH_ROLE_KEY = 'sharebite_oauth_role';
const COMMUNITY_IMPACT_CACHE_KEY = 'sharebite_community_impact';
const PROFILE_FETCH_TIMEOUT_MS = 10000;

let isVerifyingLogin = false;

export type ProfileLoadResult =
  | { status: 'ok'; user: User }
  | { status: 'missing'; userId: string }
  | { status: 'invalid_role'; userId: string; rawRole: string | null }
  | { status: 'error'; message: string };

/**
 * Purges legacy mock auth storage and user-scoped session caches so stale
 * demo accounts or previous sessions can never hijack a real user.
 */
export function clearLegacyAuthCaches(): void {
  try {
    localStorage.removeItem(LEGACY_MOCK_STORAGE_KEY);
    localStorage.removeItem(OAUTH_ROLE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  try {
    sessionStorage.removeItem(COMMUNITY_IMPACT_CACHE_KEY);
    sessionStorage.removeItem(LEGACY_MOCK_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Normalizes a database role string to a canonical application role.
 * Returns null if the role is missing, empty, or unrecognized — never guesses.
 */
export function normalizeRole(rawRole?: string | null): CanonicalRole | null {
  if (!rawRole || typeof rawRole !== 'string') return null;
  const clean = rawRole.trim().toLowerCase();
  switch (clean) {
    case 'donor':
    case 'partner':
    case 'household':
      return 'donor';
    case 'ngo':
    case 'acceptor':
    case 'receiver':
      return 'ngo';
    case 'rider':
    case 'volunteer':
      return 'rider';
    case 'community':
      return 'community';
    case 'admin':
      return 'admin';
    default:
      return null;
  }
}

export function isValidUserRole(rawRole?: string | null): boolean {
  return normalizeRole(rawRole) !== null;
}

/**
 * Maps an authoritative user role to its designated dashboard route.
 * Returns null when the role is missing or invalid so callers render an
 * error/setup UI instead of blindly routing to the wrong dashboard.
 */
export function getRoleDashboardPath(role?: UserRole | string | null): string | null {
  const canonical = normalizeRole(role);
  switch (canonical) {
    case 'donor':
      return '/donor-dashboard';
    case 'ngo':
      return '/ngo-dashboard';
    case 'rider':
      return '/rider-dashboard';
    case 'community':
      return '/community-dashboard';
    case 'admin':
      return '/admin';
    default:
      return null;
  }
}

/**
 * Returns a valid route string for JSX <Link to={...}> elements.
 */
export function getSafeDashboardPath(role?: UserRole | string | null): string {
  return getRoleDashboardPath(role) ?? '/dashboard';
}

/**
 * Checks whether a user's authoritative role is permitted for a route guard.
 */
export function isRoleAllowed(
  userRole: string | null | undefined,
  allowedRoles: (UserRole | string)[]
): boolean {
  const canonicalUser = normalizeRole(userRole);
  if (!canonicalUser) return false;
  if (allowedRoles.includes(userRole as string)) return true;
  return allowedRoles.some((allowed) => normalizeRole(allowed) === canonicalUser);
}

function getReadableRoleAndPortal(role: CanonicalRole): { label: string; portal: string } {
  switch (role) {
    case 'ngo':
      return { label: 'Acceptor (NGO / Shelter)', portal: '/login/acceptor' };
    case 'rider':
      return { label: 'Rider', portal: '/login/rider' };
    case 'community':
      return { label: 'Community Member', portal: '/login/community' };
    case 'admin':
      return { label: 'Administrator', portal: '/login/donor' };
    case 'donor':
    default:
      return { label: 'Food Donor', portal: '/login/donor' };
  }
}

function mapProfileToUser(profile: Record<string, any>): User {
  const bio = typeof profile.bio === 'string' ? profile.bio : '';
  const dobMatch = bio.startsWith('DOB: ') ? bio.replace('DOB: ', '').trim() : undefined;
  const email = typeof profile.email === 'string' ? profile.email : '';
  const fallbackName = email ? email.split('@')[0] : 'ShareBite Member';
  const resolvedName =
    (typeof profile.full_name === 'string' && profile.full_name.trim()) ||
    (typeof profile.organization_name === 'string' && profile.organization_name.trim()) ||
    fallbackName;

  return {
    id: profile.id,
    name: resolvedName,
    email,
    phone: profile.phone || '',
    role: profile.role as UserRole,
    avatar: profile.avatar_url || undefined,
    bio: profile.bio || undefined,
    organizationName: profile.organization_name || undefined,
    registrationNumber: profile.registration_number || undefined,
    dateOfBirth: dobMatch,
    location:
      profile.latitude != null && profile.longitude != null
        ? {
            latitude: Number(profile.latitude),
            longitude: Number(profile.longitude),
            address: profile.address || '',
            city: profile.city || '',
          }
        : profile.address
          ? {
              latitude: 0,
              longitude: 0,
              address: profile.address,
              city: profile.city || '',
            }
          : undefined,
    isVerified: Boolean(profile.is_verified),
    verificationStatus: profile.verification_status || (profile.is_verified ? 'verified' : 'pending'),
    isAvailable: profile.is_available ?? true,
    serviceRadiusKm: profile.service_radius_km ?? 15,
    operatingHours: profile.operating_hours || undefined,
    dailyCapacity: profile.daily_capacity ?? undefined,
    totalDonations: Number(profile.total_donations || 0),
    totalRescues: Number(profile.total_rescues || 0),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out. Please check your connection and retry.`));
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const AuthService = {
  isLoginInFlight(): boolean {
    return isVerifyingLogin;
  },

  /**
   * Fetches the user's authoritative profile row from Supabase `public.profiles`.
   * Never fabricates a fallback role from metadata or localStorage.
   */
  async fetchAuthoritativeProfile(authUserId: string): Promise<ProfileLoadResult> {
    try {
      const { data: profile, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
        PROFILE_FETCH_TIMEOUT_MS,
        'Loading profile'
      );

      if (error) {
        return {
          status: 'error',
          message: error.message || 'Unable to load your profile from the server.',
        };
      }

      if (!profile) {
        return { status: 'missing', userId: authUserId };
      }

      if (!normalizeRole(profile.role)) {
        return {
          status: 'invalid_role',
          userId: authUserId,
          rawRole: profile.role ?? null,
        };
      }

      return { status: 'ok', user: mapProfileToUser(profile) };
    } catch (err: any) {
      return {
        status: 'error',
        message: err?.message || 'Network error while loading your account profile.',
      };
    }
  },

  async getCurrentUser(): Promise<User | null> {
    clearLegacyAuthCaches();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return null;

    const result = await this.fetchAuthoritativeProfile(session.user.id);
    if (result.status === 'ok') return result.user;
    return null;
  },

  loginAsDemoRole(_role: 'donor' | 'ngo' | 'rider' | 'volunteer' | 'admin'): User {
    throw new Error('Demo login bypass is disabled. Please sign in with your registered ShareBite account.');
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

  async login(
    email: string,
    password?: string,
    expectedRole?: UserRole | 'acceptor'
  ): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    clearLegacyAuthCaches();
    isVerifyingLogin = true;

    try {
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

      const profileResult = await this.fetchAuthoritativeProfile(data.user.id);

      if (profileResult.status === 'missing') {
        throw new Error(
          'PROFILE_MISSING: Your account exists, but your profile record is missing. Please contact support or retry setup.'
        );
      }

      if (profileResult.status === 'invalid_role') {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        throw new Error(
          'INVALID_ROLE: Your account does not have a valid role assigned. Please contact support.'
        );
      }

      if (profileResult.status === 'error') {
        throw new Error(profileResult.message);
      }

      const loadedUser = profileResult.user;
      const actualCanonical = normalizeRole(loadedUser.role)!;
      const expectedCanonical = expectedRole ? normalizeRole(expectedRole) : null;

      // Admins have dedicated platform oversight access and can sign in through any portal.
      if (expectedCanonical && actualCanonical !== 'admin' && actualCanonical !== expectedCanonical) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        const { label, portal } = getReadableRoleAndPortal(actualCanonical);
        throw new Error(
          `ROLE_MISMATCH: Your account is registered as a "${label}". Please log in via the ${label} portal at ${portal}.`
        );
      }

      return loadedUser;
    } finally {
      isVerifyingLogin = false;
    }
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
    const canonicalRequested = normalizeRole(data.role);
    if (!canonicalRequested || canonicalRequested === 'admin') {
      throw new Error('Invalid registration role selected.');
    }

    const effectiveRole: UserRole =
      data.role === 'acceptor'
        ? 'ngo'
        : data.role === 'community'
          ? 'community'
          : canonicalRequested;

    clearLegacyAuthCaches();

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
    const bioText = data.dateOfBirth ? `DOB: ${data.dateOfBirth}` : null;

    // Only issue RLS-authenticated client writes when a real session is active.
    // When email confirmation is required, handle_new_user() trigger populates profiles safely from metadata.
    if (sessionExists) {
      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
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
        },
        { onConflict: 'id' }
      );

      if (upsertError) {
        console.warn('Profile upsert warning:', upsertError.message);
      }

      if (effectiveRole === 'rider') {
        await supabase
          .from('riders')
          .upsert(
            {
              user_id: userId,
              name: data.name,
              phone: data.phone,
              is_online: false,
              is_available: true,
              id_verified: false,
            },
            { onConflict: 'user_id' }
          )
          .then(({ error: riderErr }) => {
            if (riderErr) console.warn('Rider init warning:', riderErr.message);
          });
      }

      if (effectiveRole === 'ngo' && data.organizationName) {
        await supabase
          .from('partners')
          .upsert(
            {
              profile_id: userId,
              organization_name: data.organizationName,
              organization_type: 'ngo',
              address: data.address || null,
              city: data.city || null,
              is_verified: false,
            },
            { onConflict: 'profile_id' }
          )
          .then(({ error: partnerErr }) => {
            if (partnerErr) console.warn('Partner init warning:', partnerErr.message);
          });
      }

      const verifiedProfile = await this.fetchAuthoritativeProfile(userId);
      if (verifiedProfile.status === 'ok') {
        return { user: verifiedProfile.user, sessionExists: true };
      }
    }

    const pendingUser: User = {
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

    return { user: pendingUser, sessionExists };
  },

  async signInWithGoogle(intendedRole: 'donor' | 'acceptor' | 'rider'): Promise<void> {
    const canonical = normalizeRole(intendedRole);
    const effectiveRole: CanonicalRole = canonical && canonical !== 'admin' ? canonical : 'donor';

    try {
      localStorage.setItem(OAUTH_ROLE_KEY, effectiveRole);
    } catch {
      // Ignore storage failures
    }

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

    if (error) {
      throw new Error(error.message || 'Google sign-in is unavailable right now. Please sign in with email & password.');
    }
  },

  async handleOAuthCallback(): Promise<User> {
    let activeUser: any = null;

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      activeUser = sessionData.session.user;
    }

    if (!activeUser) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) activeUser = userData.user;
    }

    if (!activeUser) {
      throw new Error('Authentication session was not found. Please sign in with your email & password.');
    }

    let rawIntendedRole: string | null = null;
    try {
      rawIntendedRole = localStorage.getItem(OAUTH_ROLE_KEY);
      localStorage.removeItem(OAUTH_ROLE_KEY);
    } catch {
      rawIntendedRole = null;
    }

    // 1. Always check existing authoritative DB profile FIRST — never overwrite an existing user's role.
    const existingResult = await this.fetchAuthoritativeProfile(activeUser.id);
    if (existingResult.status === 'ok') {
      return existingResult.user;
    }
    if (existingResult.status === 'error') {
      throw new Error(existingResult.message);
    }
    if (existingResult.status === 'invalid_role') {
      throw new Error('Your account has an invalid role configuration. Please contact support.');
    }

    // 2. Profile does not exist yet: create initial profile with validated intended role (never admin).
    const parsedIntended = normalizeRole(rawIntendedRole);
    const initialRole: CanonicalRole =
      parsedIntended && parsedIntended !== 'admin' ? parsedIntended : 'donor';

    const meta = activeUser.user_metadata || {};
    const fullName = meta.full_name || meta.name || activeUser.email?.split('@')[0] || 'ShareBite Member';

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: activeUser.id,
        full_name: fullName,
        email: activeUser.email || '',
        phone: meta.phone || '',
        avatar_url: meta.avatar_url || meta.picture || null,
        role: initialRole,
        is_verified: false,
        verification_status: 'pending',
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      throw new Error(upsertError.message || 'Could not initialize your ShareBite profile.');
    }

    if (initialRole === 'rider') {
      await supabase
        .from('riders')
        .upsert(
          {
            user_id: activeUser.id,
            name: fullName,
            is_online: false,
            is_available: true,
            id_verified: false,
          },
          { onConflict: 'user_id' }
        )
        .then(({ error: riderErr }) => {
          if (riderErr) console.warn('OAuth rider init warning:', riderErr.message);
        });
    }

    const createdResult = await this.fetchAuthoritativeProfile(activeUser.id);
    if (createdResult.status === 'ok') {
      return createdResult.user;
    }

    throw new Error('Unable to verify your newly created profile. Please try again.');
  },

  async logout(): Promise<void> {
    clearLegacyAuthCaches();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore network errors during local sign-out
      }
    }
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    // Only update editable personal fields; never send role or verification flags.
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.full_name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.avatar !== undefined) payload.avatar_url = updates.avatar;
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.organizationName !== undefined) payload.organization_name = updates.organizationName;
    if (updates.location?.address !== undefined) payload.address = updates.location.address;
    if (updates.location?.city !== undefined) payload.city = updates.location.city;
    if (updates.location?.latitude !== undefined) payload.latitude = updates.location.latitude;
    if (updates.location?.longitude !== undefined) payload.longitude = updates.location.longitude;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error || !profile) {
      throw new Error(error?.message || 'Profile update failed.');
    }

    return mapProfileToUser(profile);
  },
};
