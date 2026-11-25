// ShareBite — NGO Claims & Delivery Service
// Enforces atomic PostgreSQL RPCs (First-Acceptance-Wins) without fake localStorage overrides.

import { supabase } from '../lib/supabase';
import { isValidUUID } from '../lib/uuid';
import { LocationService } from './location';

export interface NgoClaim {
  id: string;
  foodListingId: string;
  ngoId: string;
  reservationId?: string;
  servingsClaimed: number;
  status: string;
  collectionMethod?: 'ngo_delivery' | 'direct_ngo_pickup' | string;
  pickupTime?: string;
  notes?: string;
  cancellationReason?: string;
  ngoName?: string;
  confirmedAt?: string;
  riderAssignedAt?: string;
  collectedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  foodTitle?: string;
  foodCategory?: string;
  foodType?: string;
  foodImageUrl?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupLat?: number;
  pickupLng?: number;
  availableUntil?: string;
  donorId?: string;
  donorName?: string;
  donorPhone?: string;
  deliveryTaskId?: string;
  deliveryStatus?: string;
  pickupCode?: string;
  dropoffCode?: string;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupConfirmedAt?: string;
  deliveryConfirmedAt?: string;
  riderId?: string;
  riderUserId?: string;
  riderName?: string;
  riderPhone?: string;
  distributionRecordId?: string;
  quantityReceived?: number;
  quantityDistributed?: number;
  quantityRemaining?: number;
  distributionStatus?: string;
}

export interface DeliveryTask {
  id: string;
  foodListingId: string;
  claimId?: string;
  riderId?: string;
  donorId: string;
  ngoId?: string;
  assignmentType?: 'ngo_delivery' | 'rider_direct_pickup' | string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  foodTitle?: string;
  servingsRequired: number;
  quantityUnit: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  collectionDeadline?: string;
  status: string;
  arrivedAtPickupAt?: string;
  pickupConfirmedAt?: string;
  servingsCollected?: number;
  collectionDiscrepancy?: string;
  deliveryConfirmedAt?: string;
  servingsDelivered?: number;
  completedAt?: string;
  incidentReported: boolean;
  incidentType?: string;
  incidentNotes?: string;
  instructions?: string;
  estimatedKm?: number;
  riderAssignedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  foodType?: string;
  foodCategory?: string;
  foodImageUrl?: string;
  donorName?: string;
  donorPhone?: string;
  ngoName?: string;
  ngoOrgName?: string;
  ngoPhone?: string;
  servingsClaimed?: number;
  riderName?: string;
  riderPhone?: string;
  riderUserId?: string;
  isDirectFoodOpportunity?: boolean;
  distanceKm?: number;
}

export interface DistributionRecord {
  id: string;
  foodListingId: string;
  claimId?: string;
  deliveryTaskId?: string;
  ngoId: string;
  recordedBy: string;
  quantityReceived: number;
  quantityDistributed: number;
  quantityRemaining: number;
  quantityRejected: number;
  quantityUnit: string;
  distributionDate: string;
  distributionTime?: string;
  distributionLocation?: string;
  distributionMethod: string;
  peopleServed?: number;
  mealPortions?: number;
  status: string;
  conditionNotes?: string;
  safetyConcern: boolean;
  safetyNotes?: string;
  evidenceUrl?: string;
  isVerified: boolean;
  receiptConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiderProfileRecord {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  profileImage?: string;
  idVerified: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  totalDistanceKm: number;
  currentLat?: number;
  currentLng?: number;
}

export function buildGoogleMapsNavigationUrl(
  lat?: number | null,
  lng?: number | null,
  address?: string | null
): string | null {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=two-wheeler`;
  }
  if (address && address.trim().length > 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}&travelmode=two-wheeler`;
  }
  return null;
}

export function openGoogleMapsNavigation(
  lat?: number | null,
  lng?: number | null,
  address?: string | null
): string | null {
  const url = buildGoogleMapsNavigationUrl(lat, lng, address);
  if (url && typeof window !== 'undefined') {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore popup-blocker errors; caller still renders a direct anchor button
    }
  }
  return url;
}

function mapClaim(row: any): NgoClaim {
  return {
    id: row.id,
    foodListingId: row.food_listing_id,
    ngoId: row.ngo_id,
    reservationId: row.reservation_id,
    servingsClaimed: Number(row.servings_claimed ?? 1),
    status: row.status,
    collectionMethod: row.collection_method || (row.delivery_task_id ? 'ngo_delivery' : 'direct_ngo_pickup'),
    pickupTime: row.pickup_time,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    ngoName: row.ngo_name,
    confirmedAt: row.confirmed_at,
    riderAssignedAt: row.rider_assigned_at,
    collectedAt: row.collected_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    foodTitle: row.food_title || row.title,
    foodCategory: row.category,
    foodType: row.food_type,
    foodImageUrl: row.image_url,
    pickupAddress: row.pickup_address,
    pickupCity: row.pickup_city || row.city,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    availableUntil: row.available_until,
    donorId: row.donor_id,
    donorName: row.donor_name,
    donorPhone: row.donor_phone,
    deliveryTaskId: row.delivery_task_id,
    deliveryStatus: row.delivery_status,
    pickupCode: row.pickup_code,
    dropoffCode: row.dropoff_code,
    dropoffAddress: row.dropoff_address,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    pickupConfirmedAt: row.pickup_confirmed_at,
    deliveryConfirmedAt: row.delivery_confirmed_at,
    riderId: row.rider_id,
    riderUserId: row.rider_user_id,
    riderName: row.rider_name,
    riderPhone: row.rider_phone,
    distributionRecordId: row.distribution_record_id,
    quantityReceived: row.quantity_received != null ? Number(row.quantity_received) : undefined,
    quantityDistributed: row.quantity_distributed != null ? Number(row.quantity_distributed) : undefined,
    quantityRemaining: row.quantity_remaining != null ? Number(row.quantity_remaining) : undefined,
    distributionStatus: row.distribution_status,
  };
}

function mapDeliveryTask(row: any): DeliveryTask {
  return {
    id: row.id,
    foodListingId: row.food_listing_id,
    claimId: row.claim_id,
    riderId: row.rider_id,
    donorId: row.donor_id,
    ngoId: row.ngo_id,
    assignmentType: row.assignment_type || 'ngo_delivery',
    pickupAddress: row.pickup_address,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    dropoffAddress: row.dropoff_address,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    foodTitle: row.food_title,
    servingsRequired: Number(row.servings_required ?? 1),
    quantityUnit: row.quantity_unit || 'servings',
    pickupWindowStart: row.pickup_window_start,
    pickupWindowEnd: row.pickup_window_end,
    collectionDeadline: row.collection_deadline,
    status: row.status,
    arrivedAtPickupAt: row.arrived_at_pickup_at,
    pickupConfirmedAt: row.pickup_confirmed_at,
    servingsCollected: row.servings_collected != null ? Number(row.servings_collected) : undefined,
    collectionDiscrepancy: row.collection_discrepancy,
    deliveryConfirmedAt: row.delivery_confirmed_at,
    servingsDelivered: row.servings_delivered != null ? Number(row.servings_delivered) : undefined,
    completedAt: row.completed_at,
    incidentReported: !!row.incident_reported,
    incidentType: row.incident_type,
    incidentNotes: row.incident_notes,
    instructions: row.instructions,
    estimatedKm: row.estimated_km,
    riderAssignedAt: row.rider_assigned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    foodType: row.food_type,
    foodCategory: row.category,
    foodImageUrl: row.image_url,
    donorName: row.donor_name,
    donorPhone: row.donor_phone,
    ngoName: row.ngo_name,
    ngoOrgName: row.ngo_org_name,
    ngoPhone: row.ngo_phone,
    servingsClaimed: row.servings_claimed,
    riderName: row.rider_name,
    riderPhone: row.rider_phone,
    riderUserId: row.rider_user_id,
  };
}

function mapDistributionRecord(row: any): DistributionRecord {
  return {
    id: row.id,
    foodListingId: row.food_listing_id,
    claimId: row.claim_id,
    deliveryTaskId: row.delivery_task_id,
    ngoId: row.ngo_id,
    recordedBy: row.recorded_by,
    quantityReceived: Number(row.quantity_received ?? 0),
    quantityDistributed: Number(row.quantity_distributed ?? 0),
    quantityRemaining: Number(row.quantity_remaining ?? 0),
    quantityRejected: Number(row.quantity_rejected ?? 0),
    quantityUnit: row.quantity_unit || 'servings',
    distributionDate: row.distribution_date,
    distributionTime: row.distribution_time,
    distributionLocation: row.distribution_location,
    distributionMethod: row.distribution_method || 'direct',
    peopleServed: row.people_served != null ? Number(row.people_served) : undefined,
    mealPortions: row.meal_portions != null ? Number(row.meal_portions) : undefined,
    status: row.status,
    conditionNotes: row.condition_notes,
    safetyConcern: !!row.safety_concern,
    safetyNotes: row.safety_notes,
    evidenceUrl: row.evidence_url,
    isVerified: !!row.is_verified,
    receiptConfirmedAt: row.receipt_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ClaimsService = {
  // ── Unified Atomic First-Acceptance-Wins (NGO or Rider) ──────────────────
  async acceptDonation(
    foodListingId: string,
    servings?: number,
    pickupTime?: string,
    notes?: string,
    collectionMethod: 'ngo_delivery' | 'direct_ngo_pickup' = 'ngo_delivery'
  ): Promise<{
    acceptedBy: 'ngo' | 'rider';
    claimId?: string;
    deliveryTaskId?: string;
    conversationId?: string;
    pickupLat?: number;
    pickupLng?: number;
    pickupAddress?: string;
    status: string;
    collectionMethod?: string;
  }> {
    if (!isValidUUID(foodListingId)) {
      throw new Error('Invalid food donation ID');
    }

    const { data, error } = await supabase.rpc('accept_donation', {
      p_food_listing_id: foodListingId,
      p_servings: servings ?? null,
      p_pickup_time: pickupTime || null,
      p_notes: notes || null,
      p_collection_method: collectionMethod,
    });

    if (!error && data) {
      return {
        acceptedBy: data.accepted_by,
        claimId: data.claim_id,
        deliveryTaskId: data.delivery_task_id,
        conversationId: data.conversation_id,
        pickupLat: data.pickup_lat,
        pickupLng: data.pickup_lng,
        pickupAddress: data.pickup_address,
        status: data.status,
        collectionMethod: data.collection_method || collectionMethod,
      };
    }

    // Backwards-compatible retry if 5-param signature is not yet deployed on Supabase (4-param overload check)
    if (error && (error.code === 'PGRST202' || error.message?.includes('p_collection_method'))) {
      const { data: legacyData, error: legacyErr } = await supabase.rpc('accept_donation', {
        p_food_listing_id: foodListingId,
        p_servings: servings ?? null,
        p_pickup_time: pickupTime || null,
        p_notes: notes || null,
      });
      if (!legacyErr && legacyData) {
        return {
          acceptedBy: legacyData.accepted_by,
          claimId: legacyData.claim_id,
          deliveryTaskId: legacyData.delivery_task_id,
          status: legacyData.status,
        };
      }
      if (legacyErr && legacyErr.code !== 'PGRST202') {
        throw new Error(legacyErr.message || 'Could not accept food donation.');
      }
    } else if (error && error.code !== 'PGRST202') {
      throw new Error(error.message || 'Could not accept food donation.');
    }

    // Legacy fallback only when accept_donation RPC is not yet applied (calls claim_food RPC)
    const { data: claimId, error: claimErr } = await supabase.rpc('claim_food', {
      p_food_listing_id: foodListingId,
      p_servings: servings ?? 1,
      p_pickup_time: pickupTime || null,
      p_notes: notes || null,
    });

    if (claimErr) {
      throw new Error(claimErr.message || 'Claim failed. Another user may have already accepted this donation.');
    }

    return {
      acceptedBy: 'ngo',
      claimId: claimId as string,
      status: 'confirmed',
    };
  },

  // ── NGO Claiming ─────────────────────────────────────────────────────────
  async claimFood(
    foodListingId: string,
    servings: number,
    pickupTime?: string,
    notes?: string
  ): Promise<string> {
    const res = await ClaimsService.acceptDonation(foodListingId, servings, pickupTime, notes);
    return res.claimId || res.deliveryTaskId || foodListingId;
  },

  async createDeliveryTask(claimId: string): Promise<string> {
    if (!isValidUUID(claimId)) throw new Error('Invalid claim ID');
    const { data, error } = await supabase.rpc('create_delivery_task', {
      p_claim_id: claimId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to create delivery task');
    }
    return data as string;
  },

  async cancelClaim(claimId: string, reason?: string): Promise<boolean> {
    if (!isValidUUID(claimId)) throw new Error('Invalid claim ID');
    const { data, error } = await supabase.rpc('cancel_ngo_claim', {
      p_claim_id: claimId,
      p_reason: reason || null,
    });
    if (error) throw new Error(error.message || 'Failed to cancel claim');
    return !!data;
  },

  // ── NGO Claims Dashboard ─────────────────────────────────────────────────
  async getMyClaims(ngoId: string): Promise<NgoClaim[]> {
    if (!isValidUUID(ngoId)) return [];
    const { data, error } = await supabase
      .from('ngo_claims_dashboard_view')
      .select('*')
      .eq('ngo_id', ngoId)
      .order('created_at', { ascending: false });

    if (!error && data) return data.map(mapClaim);

    // Fallback to direct ngo_claims query if view fails
    const { data: directClaims } = await supabase
      .from('ngo_claims')
      .select('*, food:food_listings(*, donor:profiles!food_listings_donor_id_fkey(*))')
      .eq('ngo_id', ngoId)
      .order('created_at', { ascending: false });

    if (!directClaims) return [];
    return directClaims.map((r: any) =>
      mapClaim({
        ...r,
        food_title: r.food?.title,
        category: r.food?.category,
        food_type: r.food?.food_type,
        image_url: r.food?.image_url,
        pickup_address: r.food?.pickup_address,
        pickup_city: r.food?.city,
        pickup_lat: r.food?.latitude,
        pickup_lng: r.food?.longitude,
        available_until: r.food?.available_until,
        donor_id: r.food?.donor_id,
        donor_name: r.food?.donor?.full_name,
        donor_phone: r.food?.donor?.phone,
      })
    );
  },

  async getClaimById(claimId: string): Promise<NgoClaim | null> {
    if (!isValidUUID(claimId)) return null;
    const { data, error } = await supabase
      .from('ngo_claims_dashboard_view')
      .select('*')
      .eq('id', claimId)
      .maybeSingle();
    if (error || !data) return null;
    return mapClaim(data);
  },

  async getClaimsForDonation(foodListingId: string): Promise<NgoClaim[]> {
    if (!isValidUUID(foodListingId)) return [];
    const { data, error } = await supabase
      .from('ngo_claims')
      .select('*')
      .eq('food_listing_id', foodListingId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapClaim);
  },

  // ── Delivery Tasks & Direct Food Opportunities (Rider Workflow) ──────────
  async getAvailableDeliveryTasks(riderLat?: number, riderLng?: number): Promise<DeliveryTask[]> {
    const results: DeliveryTask[] = [];

    // 1. Existing delivery tasks awaiting a rider (NGO claimed first)
    const { data: viewTasks, error } = await supabase
      .from('rider_tasks_view')
      .select('*')
      .eq('status', 'awaiting_rider')
      .order('created_at', { ascending: false });

    if (!error && viewTasks) {
      for (const row of viewTasks) {
        const mapped = mapDeliveryTask(row);
        if (
          riderLat != null &&
          riderLng != null &&
          mapped.pickupLat != null &&
          mapped.pickupLng != null
        ) {
          mapped.distanceKm = LocationService.calculateDistance(
            riderLat,
            riderLng,
            mapped.pickupLat,
            mapped.pickupLng
          );
        }
        results.push(mapped);
      }
    }

    // 2. Nearby unclaimed food listings where a rider can win First-Acceptance-Wins directly
    const { data: openFood } = await supabase
      .from('food_listings')
      .select('*, donor:profiles!food_listings_donor_id_fkey(full_name, phone)')
      .eq('status', 'available')
      .gt('available_servings', 0)
      .gt('available_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    if (openFood) {
      const existingFoodIds = new Set(results.map((r) => r.foodListingId));
      for (const fl of openFood) {
        if (existingFoodIds.has(fl.id)) continue;
        const dist =
          riderLat != null && riderLng != null && fl.latitude != null && fl.longitude != null
            ? LocationService.calculateDistance(riderLat, riderLng, fl.latitude, fl.longitude)
            : undefined;
        results.push({
          id: fl.id,
          foodListingId: fl.id,
          donorId: fl.donor_id,
          assignmentType: 'rider_direct_pickup',
          pickupAddress: fl.pickup_address || fl.city || 'Donor Location',
          pickupLat: fl.latitude,
          pickupLng: fl.longitude,
          dropoffAddress: 'Community Distribution / Shelter',
          foodTitle: fl.title,
          servingsRequired: fl.available_servings,
          quantityUnit: fl.quantity_unit || 'servings',
          collectionDeadline: fl.available_until,
          status: 'awaiting_rider',
          incidentReported: false,
          instructions: fl.description,
          createdAt: fl.created_at,
          updatedAt: fl.updated_at,
          foodType: fl.food_type,
          foodCategory: fl.category,
          foodImageUrl: fl.image_url,
          donorName: fl.donor?.full_name || 'Donor',
          donorPhone: fl.donor?.phone,
          isDirectFoodOpportunity: true,
          distanceKm: dist,
        });
      }
    }

    return results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  },

  async getOrEnsureRiderProfile(
    riderUserId: string,
    fallbackName?: string,
    fallbackPhone?: string
  ): Promise<RiderProfileRecord | null> {
    if (!isValidUUID(riderUserId)) return null;

    let { data: row } = await supabase
      .from('riders')
      .select('*')
      .eq('user_id', riderUserId)
      .maybeSingle();

    if (!row) {
      const { data: inserted } = await supabase
        .from('riders')
        .upsert(
          {
            user_id: riderUserId,
            name: fallbackName || 'ShareBite Rider',
            phone: fallbackPhone || '',
            is_online: false,
            is_available: true,
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .maybeSingle();
      row = inserted;
    }

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name || fallbackName || 'Rider',
      phone: row.phone || fallbackPhone || '',
      vehicleType: row.vehicle_type || 'bike',
      vehicleNumber: row.vehicle_number || '',
      profileImage: row.profile_image || undefined,
      idVerified: !!row.id_verified,
      isOnline: !!row.is_online,
      isAvailable: row.is_available !== false,
      rating: row.rating != null ? Number(row.rating) : 5.0,
      totalDeliveries: Number(row.total_deliveries ?? 0),
      totalEarnings: Number(row.total_earnings ?? 0),
      totalDistanceKm: Number(row.total_distance_km ?? 0),
      currentLat: row.current_lat ?? undefined,
      currentLng: row.current_lng ?? undefined,
    };
  },

  async setRiderOnlineStatus(
    riderUserId: string,
    nextOnline: boolean,
    hasActiveTask: boolean,
    fallbackName?: string,
    fallbackPhone?: string
  ): Promise<void> {
    if (!isValidUUID(riderUserId)) return;

    const existing = await ClaimsService.getOrEnsureRiderProfile(riderUserId, fallbackName, fallbackPhone);
    if (existing) {
      await supabase
        .from('riders')
        .update({
          is_online: nextOnline,
          is_available: nextOnline && !hasActiveTask,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', riderUserId);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sharebite:rider-online', { detail: { isOnline: nextOnline } }));
    }
  },

  async getMyDeliveryTasks(riderUserId: string): Promise<DeliveryTask[]> {
    if (!isValidUUID(riderUserId)) return [];
    const { data: riderData } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', riderUserId)
      .maybeSingle();

    if (!riderData?.id) return [];

    const { data, error } = await supabase
      .from('rider_tasks_view')
      .select('*')
      .eq('rider_id', riderData.id)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapDeliveryTask);
  },

  async getDeliveryTaskById(taskId: string): Promise<DeliveryTask | null> {
    if (!isValidUUID(taskId)) return null;
    const { data, error } = await supabase
      .from('rider_tasks_view')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();
    if (error || !data) return null;
    return mapDeliveryTask(data);
  },

  async acceptDeliveryJob(taskId: string): Promise<boolean> {
    if (!isValidUUID(taskId)) throw new Error('Invalid delivery task ID');

    const { data, error } = await supabase.rpc('accept_delivery_job', {
      p_task_id: taskId,
    });

    if (error) {
      throw new Error(error.message || 'This delivery job was already taken by another rider.');
    }
    if (!data) {
      throw new Error('This delivery job is no longer available.');
    }
    return true;
  },

  async confirmPickup(
    taskId: string,
    pickupCode: string,
    servingsCollected: number,
    discrepancyNotes?: string
  ): Promise<boolean> {
    if (!isValidUUID(taskId)) throw new Error('Invalid task ID');
    const { data, error } = await supabase.rpc('confirm_pickup', {
      p_task_id: taskId,
      p_pickup_code: pickupCode.trim(),
      p_servings_collected: servingsCollected,
      p_discrepancy_notes: discrepancyNotes || null,
    });
    if (error) throw new Error(error.message || 'Pickup verification failed');
    return !!data;
  },

  async confirmDeliveryToNgo(
    taskId: string,
    dropoffCode: string,
    servingsDelivered: number
  ): Promise<boolean> {
    if (!isValidUUID(taskId)) throw new Error('Invalid task ID');
    const { data, error } = await supabase.rpc('confirm_delivery_to_ngo', {
      p_task_id: taskId,
      p_dropoff_code: (dropoffCode || '').trim(),
      p_servings_delivered: servingsDelivered,
    });
    if (error) throw new Error(error.message || 'Delivery verification failed');
    return !!data;
  },

  async reportIncident(taskId: string, incidentType: string, notes: string): Promise<boolean> {
    if (!isValidUUID(taskId)) throw new Error('Invalid task ID');
    const { data, error } = await supabase.rpc('report_delivery_incident', {
      p_task_id: taskId,
      p_incident_type: incidentType,
      p_notes: notes,
    });
    if (error) throw new Error(error.message || 'Failed to report incident');
    return !!data;
  },

  async reassignDeliveryTask(taskId: string, reason?: string): Promise<boolean> {
    if (!isValidUUID(taskId)) throw new Error('Invalid task ID');
    const { data, error } = await supabase.rpc('reassign_donation', {
      p_task_id: taskId,
      p_reason: reason || null,
    });
    if (error) throw new Error(error.message || 'Failed to reassign task');
    return !!data;
  },

  async updateDeliveryTaskStatus(taskId: string, status: string, notes?: string): Promise<boolean> {
    if (!isValidUUID(taskId)) throw new Error('Invalid task ID');

    const { data, error } = await supabase.rpc('update_donation_status', {
      p_task_id: taskId,
      p_new_status: status,
      p_notes: notes || null,
    });

    if (!error) return !!data;
    if (error.code !== 'PGRST202') {
      throw new Error(error.message || 'Failed to update status');
    }

    // Fallback only if update_donation_status RPC is not yet deployed
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let query = supabase
      .from('delivery_tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (rider?.id) {
      query = query.eq('rider_id', rider.id);
    }

    const { error: updErr } = await query;
    if (updErr) throw new Error(updErr.message);
    return true;
  },

  async ngoConfirmPickup(
    claimId: string,
    servingsCollected?: number,
    notes?: string
  ): Promise<boolean> {
    if (!isValidUUID(claimId)) throw new Error('Invalid claim ID');
    const { data, error } = await supabase.rpc('ngo_confirm_pickup', {
      p_claim_id: claimId,
      p_servings_collected: servingsCollected ?? null,
      p_notes: notes || null,
    });
    if (error) {
      throw new Error(error.message || 'Failed to confirm direct pickup.');
    }
    return !!data;
  },

  // ── NGO Receipt & Distribution ───────────────────────────────────────────
  async confirmNgoReceipt(
    taskId: string | null | undefined,
    quantityReceived: number,
    conditionNotes?: string,
    safetyConcern?: boolean,
    safetyNotes?: string,
    claimId?: string
  ): Promise<string> {
    if (taskId && isValidUUID(taskId)) {
      const { data, error } = await supabase.rpc('confirm_ngo_receipt', {
        p_task_id: taskId,
        p_quantity_received: quantityReceived,
        p_condition_notes: conditionNotes || null,
        p_safety_concern: !!safetyConcern,
        p_safety_notes: safetyNotes || null,
      });
      if (!error && data) return data as string;
      if (error && error.code !== 'PGRST202') {
        throw new Error(error.message || 'Failed to confirm receipt');
      }
    }

    if (claimId && isValidUUID(claimId)) {
      const { data, error } = await supabase.rpc('confirm_ngo_receipt', {
        p_task_id: null,
        p_quantity_received: quantityReceived,
        p_condition_notes: conditionNotes || null,
        p_safety_concern: !!safetyConcern,
        p_safety_notes: safetyNotes || null,
        p_claim_id: claimId,
      });
      if (error || !data) {
        throw new Error(error?.message || 'Failed to confirm receipt at facility');
      }
      return data as string;
    }

    throw new Error('Invalid delivery task or claim ID');
  },

  async getDistributionRecords(ngoId: string): Promise<DistributionRecord[]> {
    if (!isValidUUID(ngoId)) return [];
    const { data, error } = await supabase
      .from('distribution_records')
      .select('*')
      .eq('ngo_id', ngoId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapDistributionRecord);
  },

  async getDistributionRecord(id: string): Promise<DistributionRecord | null> {
    if (!isValidUUID(id)) return null;
    const { data, error } = await supabase
      .from('distribution_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return mapDistributionRecord(data);
  },

  async recordDistribution(
    distributionRecordId: string,
    quantityToDistribute: number,
    peopleServed?: number,
    mealPortions?: number,
    distributionMethod?: string,
    distributionLocation?: string,
    notes?: string
  ): Promise<boolean> {
    if (!isValidUUID(distributionRecordId)) throw new Error('Invalid distribution record ID');
    const { data, error } = await supabase.rpc('record_distribution', {
      p_distribution_record_id: distributionRecordId,
      p_quantity_to_distribute: quantityToDistribute,
      p_people_served: peopleServed || null,
      p_meal_portions: mealPortions || null,
      p_distribution_method: distributionMethod || 'direct',
      p_distribution_location: distributionLocation || null,
      p_notes: notes || null,
    });
    if (error) throw new Error(error.message || 'Failed to record distribution');
    return !!data;
  },

  // ── Donor Dashboard Listings ─────────────────────────────────────────────
  async getDonorDashboardListings(donorId: string): Promise<any[]> {
    if (!isValidUUID(donorId)) return [];
    const { data, error } = await supabase
      .from('donor_dashboard_view')
      .select('*')
      .eq('donor_id', donorId)
      .order('created_at', { ascending: false });

    if (!error && data) return data;

    // Fallback: direct query to food_listings without fabricating dummy values
    const { data: listings } = await supabase
      .from('food_listings')
      .select('*')
      .eq('donor_id', donorId)
      .order('created_at', { ascending: false });

    return listings || [];
  },

  // ── Real-time Subscriptions ──────────────────────────────────────────────
  subscribeToDeliveryTask(taskId: string, callback: (task: DeliveryTask) => void) {
    if (!isValidUUID(taskId)) {
      return { unsubscribe: () => {} };
    }

    const channelName = `delivery_task_${taskId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_tasks',
          filter: `id=eq.${taskId}`,
        },
        async () => {
          const updated = await ClaimsService.getDeliveryTaskById(taskId);
          if (updated) callback(updated);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },

  subscribeToMyClaims(ngoId: string, callback: () => void) {
    if (!isValidUUID(ngoId)) {
      return { unsubscribe: () => {} };
    }

    let timeout: any = null;
    const debounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        callback();
      }, 450);
    };

    const channelName = `ngo_claims_${ngoId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ngo_claims',
          filter: `ngo_id=eq.${ngoId}`,
        },
        debounced
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_tasks',
          filter: `ngo_id=eq.${ngoId}`,
        },
        debounced
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `user_id=eq.${ngoId}`,
        },
        debounced
      )
      .subscribe();

    return {
      unsubscribe: () => {
        clearTimeout(timeout);
        supabase.removeChannel(channel);
      },
    };
  },

  subscribeToAvailableTasks(callback: () => void) {
    let timeout: any = null;
    const debounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        callback();
      }, 450);
    };

    const channelName = `tasks_avail_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_tasks',
        },
        debounced
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_listings',
        },
        debounced
      )
      .subscribe();

    return {
      unsubscribe: () => {
        clearTimeout(timeout);
        supabase.removeChannel(channel);
      },
    };
  },

  subscribeToDonorListings(donorId: string, callback: () => void) {
    if (!isValidUUID(donorId)) {
      return { unsubscribe: () => {} };
    }

    let timeout: any = null;
    const debounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        callback();
      }, 450);
    };

    const channelName = `donor_listings_${donorId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_tasks',
          filter: `donor_id=eq.${donorId}`,
        },
        debounced
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_listings',
          filter: `donor_id=eq.${donorId}`,
        },
        debounced
      )
      .subscribe();

    return {
      unsubscribe: () => {
        clearTimeout(timeout);
        supabase.removeChannel(channel);
      },
    };
  },
};
