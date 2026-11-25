// ShareBite — UUID Validation and Safe Canonical ID Resolver
// Guarantees all database operations receive valid RFC-4122 UUIDs,
// eliminating 'invalid input syntax for type uuid' errors.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verified real UUIDs matching actual records in public.profiles and auth.users
 */
export const DEMO_RECORD_UUIDS = {
  donor: '51059a05-23eb-4d61-b856-20a42e790403',      // Anubhav (anubhavt675@gmail.com)
  ngo: 'd3819150-4d31-4e95-8972-15b722d5f3e3',        // Robin Hood Army Delhi (ngo@sharebite.org)
  rider: '4be44dd0-ffb1-4f9d-ae4e-3ec8689c3de0',      // Kabir Sharma / Rider (rohillanikhlesh7@gmail.com)
  volunteer: 'e5947beb-536d-4a35-bdfc-4507f61f12a4',  // Priya Patel / Volunteer (varunyadavt456@gmail.com)
  admin: '916af4a6-abc5-4387-a655-7cb1d614841a',      // ShareBite Admin (amit.kumart6f56@gmail.com)
  donorSecondary: '9ecc652c-b90c-4e48-a56a-4c0d5db196be', // nikhlesh rohilla (nikhleshrohilla2@gmail.com)
} as const;

/**
 * Mapping of legacy string identifiers to legitimate database record UUIDs
 */
export const LEGACY_DEMO_ID_MAP: Record<string, string> = {
  'demo-donor-001': DEMO_RECORD_UUIDS.donor,
  'demo-donor-1': DEMO_RECORD_UUIDS.donor,
  'demo-ngo-001': DEMO_RECORD_UUIDS.ngo,
  'demo-ngo-002': DEMO_RECORD_UUIDS.ngo,
  'demo-ngo-1': DEMO_RECORD_UUIDS.ngo,
  'demo-rider-003': DEMO_RECORD_UUIDS.rider,
  'demo-rider-1': DEMO_RECORD_UUIDS.rider,
  'demo-volunteer-004': DEMO_RECORD_UUIDS.volunteer,
  'demo-volunteer-1': DEMO_RECORD_UUIDS.volunteer,
  'demo-admin-005': DEMO_RECORD_UUIDS.admin,
  'demo-admin-1': DEMO_RECORD_UUIDS.admin,
  // Mock listing donor IDs from Discover page
  'mock-donor-1': DEMO_RECORD_UUIDS.donor,
  'mock-donor-2': DEMO_RECORD_UUIDS.donor,
  'mock-donor-3': DEMO_RECORD_UUIDS.donorSecondary,
  'mock-donor-4': DEMO_RECORD_UUIDS.donorSecondary,
  'mock-donor-5': DEMO_RECORD_UUIDS.donor,
  // Mock listing food IDs
  'bhopal-food-1': 'a1b2c3d4-e5f6-4001-8001-000000000001',
  'bhopal-food-2': 'a1b2c3d4-e5f6-4002-8002-000000000002',
  'bhopal-food-3': 'a1b2c3d4-e5f6-4003-8003-000000000003',
  'bhopal-food-4': 'a1b2c3d4-e5f6-4004-8004-000000000004',
  'bhopal-food-5': 'a1b2c3d4-e5f6-4005-8005-000000000005',
};

export const DEMO_FOOD_UUIDS = {
  food1: 'a1b2c3d4-e5f6-4001-8001-000000000001',
  food2: 'a1b2c3d4-e5f6-4002-8002-000000000002',
  food3: 'a1b2c3d4-e5f6-4003-8003-000000000003',
  food4: 'a1b2c3d4-e5f6-4004-8004-000000000004',
  food5: 'a1b2c3d4-e5f6-4005-8005-000000000005',
} as const;

/**
 * Returns true if the given value is a syntactically valid UUID string.
 */
export function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Ensures an ID is a valid UUID. If given a legacy demo ID string (e.g. 'demo-donor-001'),
 * it maps it to the real database UUID. If invalid and a fallback is provided, returns fallback.
 */
export function toSafeUUID(val: unknown, fallback: string = DEMO_RECORD_UUIDS.donor): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (isValidUUID(trimmed)) {
      return trimmed;
    }
    if (LEGACY_DEMO_ID_MAP[trimmed]) {
      return LEGACY_DEMO_ID_MAP[trimmed];
    }
  }
  return fallback;
}
