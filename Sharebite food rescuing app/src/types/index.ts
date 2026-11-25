// ShareBite — TypeScript Type Definitions (web)
// Shared with mobile app; matches Supabase schema

export type UserRole = 'donor' | 'ngo' | 'receiver' | 'volunteer' | 'partner' | 'admin' | 'rider' | 'community' | 'acceptor';

export type FoodStatus =
  | 'available'
  | 'reserved'
  | 'partially_reserved'
  | 'picked_up'
  | 'completed'
  | 'expired'
  | 'cancelled';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type NotificationType =
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'pickup_ready'
  | 'pickup_completed'
  | 'donation_created'
  | 'donation_completed'
  | 'listing_expiring'
  | 'partner_verified'
  | 'donation_claimed'
  | 'system';

export type FoodCategory =
  | 'rice'
  | 'roti'
  | 'sabzi'
  | 'dal'
  | 'biryani'
  | 'snacks'
  | 'sweets'
  | 'fruits'
  | 'bakery'
  | 'beverages'
  | 'other';

export type FoodType = 'veg' | 'non_veg' | 'vegan' | 'other';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  pincode?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  organizationName?: string;
  registrationNumber?: string;
  dateOfBirth?: string;
  location?: Location;
  isVerified: boolean;
  verificationStatus?: string;
  totalDonations: number;
  totalRescues: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoodListing {
  id: string;
  donorId: string;
  donor?: User;
  title: string;
  description?: string;
  category: string;
  foodType: FoodType;
  servings: number;
  availableServings: number;
  imageUrl?: string;
  pickupAddress?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  availableFrom: string;
  availableUntil: string;
  status: FoodStatus;
  isUrgent: boolean;
  allergens?: string[];
  storageType?: string;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
}

export interface Reservation {
  id: string;
  foodListingId: string;
  foodListing?: FoodListing;
  userId: string;
  user?: User;
  servings: number;
  status: ReservationStatus;
  pickupTime?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  profileId?: string;
  organizationName: string;
  organizationType: string;
  description?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

export interface ImpactStats {
  mealsSaved: number;
  foodRedistributedKg: number;
  peopleReached: number;
  wastePreventedKg: number;
  co2SavedKg: number;
  donationsCount: number;
  claimsCount: number;
}

export interface CommunityImpact extends ImpactStats {
  activeNGOs: number;
  activeDonors: number;
  citiesCovered: number;
  thisMonthMeals: number;
}

export interface CreateFoodListingForm {
  title: string;
  description: string;
  category: string;
  foodType: FoodType;
  servings: number;
  quantityUnit?: string;
  quantityValue?: number;
  preparationDate?: string;
  packagingType?: string;
  packagingNotes?: string;
  specialInstructions?: string;
  directHandover?: boolean;
  contactPhone?: string;
  safetyDeclarationSigned?: boolean;
  imageFile?: File;
  pickupAddress: string;
  city: string;
  pickupDate?: string;
  pickupTime?: string;
  latitude?: number;
  longitude?: number;
  availableFrom: string;
  availableUntil: string;
  isUrgent: boolean;
  allergens?: string[];
  storageType?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'donation' | 'delivery';
  relatedListingId?: string;
  relatedTaskId?: string;
  title?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  participants?: ConversationParticipant[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user?: User;
  role?: string;
  lastReadAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  content: string;
  messageType: 'text' | 'image' | 'location' | 'system';
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface RiderLocationUpdate {
  id: string;
  riderId: string;
  deliveryTaskId?: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
}

export interface NearbyNGO {
  id: string;
  fullName: string;
  organizationName?: string;
  phone?: string;
  address?: string;
  city?: string;
  latitude: number;
  longitude: number;
  avatarUrl?: string;
  isVerified: boolean;
  distanceKm: number;
}

// ─── India NGO Discovery System ──────────────────────────────────────────────

export type NGOVerificationStatus = 'source_listed' | 'contact_available' | 'sharebite_verified' | 'unverified';

export type NGOCategory =
  | 'food_distribution'
  | 'child_welfare'
  | 'education'
  | 'women_empowerment'
  | 'elderly_care'
  | 'disability_support'
  | 'animal_welfare'
  | 'healthcare'
  | 'disaster_relief'
  | 'homeless_support'
  | 'environment'
  | 'general_charity'
  | 'other';

export interface IndiaNGO {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  categories: NGOCategory[];
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  website?: string;
  registrationNumber?: string;
  sourceName: string;
  sourceUrl?: string;
  verificationStatus: NGOVerificationStatus;
  acceptsFoodDonations?: boolean;
  acceptsVolunteers?: boolean;
  operatingHours?: string;
  lastVerifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  distanceKm?: number;
  osmId?: string;
}


