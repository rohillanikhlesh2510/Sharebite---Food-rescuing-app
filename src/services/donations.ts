// ShareBite — Donations / Food Listings Service (Web)
import { supabase } from '../lib/supabase';
import { isValidUUID } from '../lib/uuid';
import { NGOService } from './ngo';
import type {
  FoodListing,
  FoodStatus,
  CreateFoodListingForm,
  DonationStatusHistoryItem,
} from '../types';

async function compressFoodImage(file: File): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }
  // Skip small files (< 300 KB) to preserve original crisp quality
  if (file.size <= 300 * 1024) return file;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Invalid image file'));
      el.src = dataUrl;
    });

    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob || blob.size >= file.size) return file;

    const cleanName = file.name.replace(/\.[^.]+$/, '') || 'food-photo';
    return new File([blob], `${cleanName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function mapListingToFood(data: any): FoodListing {
  const donorData = data.donor;
  return {
    id: data.id,
    donorId: data.donor_id,
    donor: donorData
      ? {
          id: donorData.id,
          name: donorData.full_name || 'User',
          email: donorData.email || '',
          phone: donorData.phone || '',
          role: donorData.role || 'donor',
          avatar: donorData.avatar_url,
          isVerified: donorData.is_verified || false,
          totalDonations: donorData.total_donations || 0,
          totalRescues: donorData.total_rescues || 0,
          createdAt: donorData.created_at,
          updatedAt: donorData.updated_at,
        }
      : undefined,
    title: data.title,
    description: data.description,
    category: data.category || 'other',
    foodType: data.food_type || 'veg',
    servings: data.servings,
    availableServings: data.available_servings,
    imageUrl: data.image_url,
    pickupAddress: data.pickup_address,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    availableFrom: data.available_from,
    availableUntil: data.available_until,
    status: data.status as FoodStatus,
    isUrgent: data.is_urgent || false,
    allergens: data.allergens || [],
    storageType: data.storage_type || 'room_temp',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    distanceKm: data.distance_km != null ? Number(data.distance_km) : undefined,
  };
}

export const DonationService = {
  async getActiveListings(): Promise<FoodListing[]> {
    const { data, error } = await supabase
      .from('food_listings')
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .in('status', ['available', 'partially_reserved'])
      .gt('available_servings', 0)
      .gt('available_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      console.warn('Error fetching food listings:', error);
      return [];
    }
    return data.map(mapListingToFood);
  },

  async getNearbyListings(lat: number, lng: number, radiusKm: number = 25): Promise<FoodListing[]> {
    try {
      const { data, error } = await supabase.rpc('get_nearby_food', {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: radiusKm,
      });

      if (!error && Array.isArray(data)) {
        return data.map((row: any) =>
          mapListingToFood({
            ...row,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          })
        );
      }
    } catch {}
    return DonationService.getActiveListings();
  },

  async getListingById(id: string): Promise<FoodListing | null> {
    if (!isValidUUID(id)) return null;

    const { data, error } = await supabase
      .from('food_listings')
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapListingToFood(data);
  },

  async getMyListings(donorId: string): Promise<FoodListing[]> {
    if (!isValidUUID(donorId)) return [];

    const { data, error } = await supabase
      .from('food_listings')
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .eq('donor_id', donorId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapListingToFood);
  },

  async getStatusHistory(foodListingId: string, deliveryTaskId?: string): Promise<DonationStatusHistoryItem[]> {
    if (!isValidUUID(foodListingId)) return [];
    try {
      let query = supabase
        .from('donation_status_history')
        .select('*')
        .eq('food_listing_id', foodListingId)
        .order('created_at', { ascending: true });

      if (deliveryTaskId && isValidUUID(deliveryTaskId)) {
        query = query.or(`delivery_task_id.eq.${deliveryTaskId},delivery_task_id.is.null`);
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((row: any) => ({
        id: row.id,
        foodListingId: row.food_listing_id,
        deliveryTaskId: row.delivery_task_id,
        claimId: row.claim_id,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        changedBy: row.changed_by,
        actorRole: row.actor_role,
        notes: row.notes,
        createdAt: row.created_at,
      }));
    } catch {
      return [];
    }
  },

  async createListing(donorId: string, form: CreateFoodListingForm): Promise<FoodListing> {
    let safeDonorId = donorId;
    if (!isValidUUID(safeDonorId)) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id && isValidUUID(user.id)) {
        safeDonorId = user.id;
      } else {
        throw new Error('Please sign in to publish a food donation.');
      }
    }

    let imageUrl: string | null = null;
    if (form.imageFile) {
      const uploadFile = await compressFoodImage(form.imageFile);
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const filename = `${safeDonorId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('food-images')
        .upload(filename, uploadFile, { upsert: true, contentType: uploadFile.type || 'image/jpeg' });

      if (uploadErr) {
        throw new Error(`Food image upload failed: ${uploadErr.message}. Please retry or publish without a photo.`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('food-images').getPublicUrl(filename);
      imageUrl = publicUrl;
    }

    const extraNotes: string[] = [];
    if (form.quantityUnit && form.quantityUnit !== 'servings') {
      extraNotes.push(`Quantity: ${form.quantityValue || form.servings} ${form.quantityUnit}`);
    }
    if (form.preparationDate) extraNotes.push(`Prepared: ${new Date(form.preparationDate).toLocaleString()}`);
    if (form.packagingType) extraNotes.push(`Packaging: ${form.packagingType}`);
    if (form.packagingNotes) extraNotes.push(`Packaging Notes: ${form.packagingNotes}`);
    if (form.specialInstructions) extraNotes.push(`Pickup Instructions: ${form.specialInstructions}`);
    if (form.contactPhone) extraNotes.push(`Contact: ${form.contactPhone}`);
    if (form.directHandover) extraNotes.push(`Handover: Direct handover to rider`);

    const fullDescription = form.description
      ? extraNotes.length > 0
        ? `${form.description}\n\n---\n${extraNotes.join(' | ')}`
        : form.description
      : extraNotes.join(' | ');

    const lat = typeof form.latitude === 'number' && !isNaN(form.latitude) ? form.latitude : null;
    const lng = typeof form.longitude === 'number' && !isNaN(form.longitude) ? form.longitude : null;
    const availableFromIso = form.availableFrom
      ? new Date(form.availableFrom).toISOString()
      : new Date().toISOString();
    const availableUntilIso = new Date(form.availableUntil).toISOString();
    const prepDateIso = form.preparationDate ? new Date(form.preparationDate).toISOString() : null;
    const radiusKm = form.notificationRadiusKm || 15;

    // 1. Primary path: atomic publish_food_donation RPC (PostGIS + nearby NGOs + online riders)
    if (lat !== null && lng !== null) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('publish_food_donation', {
        p_title: form.title,
        p_description: fullDescription,
        p_category: form.category,
        p_food_type: form.foodType,
        p_servings: form.servings,
        p_image_url: imageUrl,
        p_pickup_address: form.pickupAddress,
        p_city: form.city,
        p_latitude: lat,
        p_longitude: lng,
        p_location_accuracy_m: form.locationAccuracyM ?? null,
        p_location_captured_at: form.locationCapturedAt || new Date().toISOString(),
        p_available_from: availableFromIso,
        p_available_until: availableUntilIso,
        p_is_urgent: form.isUrgent,
        p_allergens: form.allergens || [],
        p_storage_type: form.storageType || 'room_temp',
        p_quantity_unit: form.quantityUnit || 'servings',
        p_quantity_value: form.quantityValue ?? form.servings,
        p_preparation_date: prepDateIso,
        p_packaging_notes: form.packagingNotes || null,
        p_notification_radius_km: radiusKm,
      });

      if (!rpcErr && rpcData?.listing) {
        return mapListingToFood(rpcData.listing);
      }

      if (!rpcErr && rpcData?.food_listing_id) {
        const { data: fetched } = await supabase
          .from('food_listings')
          .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
          .eq('id', rpcData.food_listing_id)
          .maybeSingle();
        if (fetched) return mapListingToFood(fetched);
      }

      const isRpcSchemaMismatch =
        rpcErr &&
        (rpcErr.code === 'PGRST202' ||
          rpcErr.code === '42804' ||
          rpcErr.code === '42883' ||
          rpcErr.code === '42703' ||
          /is of type|does not match|Could not find the function/i.test(rpcErr.message || ''));

      if (rpcErr && !isRpcSchemaMismatch) {
        throw new Error(rpcErr.message || 'Failed to publish food donation');
      }
      if (rpcErr && isRpcSchemaMismatch) {
        console.warn('publish_food_donation RPC fallback triggered:', rpcErr.message);
      }
    }

    // 2. Fallback when publish_food_donation RPC is unavailable or encounters enum/schema cast mismatch
    const payload: any = {
      donor_id: safeDonorId,
      title: form.title,
      description: fullDescription,
      category: form.category,
      food_type: form.foodType,
      servings: form.servings,
      available_servings: form.servings,
      image_url: imageUrl,
      pickup_address: form.pickupAddress,
      city: form.city,
      latitude: lat,
      longitude: lng,
      available_from: availableFromIso,
      available_until: availableUntilIso,
      status: 'available',
      is_urgent: form.isUrgent,
      allergens: form.allergens || [],
      storage_type: form.storageType || 'room_temp',
      quantity_unit: form.quantityUnit || 'servings',
      quantity_value: form.quantityValue ?? form.servings,
      preparation_date: prepDateIso,
      packaging_notes: form.packagingNotes || null,
      notification_radius_km: radiusKm,
    };

    let { data: listing, error } = await supabase
      .from('food_listings')
      .insert(payload)
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .maybeSingle();

    if (error && (error.message?.includes('column') || error.code === '42703')) {
      delete payload.allergens;
      delete payload.storage_type;
      delete payload.quantity_unit;
      delete payload.quantity_value;
      delete payload.preparation_date;
      delete payload.packaging_notes;
      delete payload.notification_radius_km;
      const retry = await supabase
        .from('food_listings')
        .insert(payload)
        .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
        .single();
      listing = retry.data;
      error = retry.error;
    }

    if (error || !listing) throw error || new Error('Failed to create food listing');

    try {
      await supabase.from('impact_events').insert({
        user_id: safeDonorId,
        event_type: 'food_donated',
        servings: form.servings,
      });
      await supabase.from('donations').insert({
        food_listing_id: listing.id,
        donor_id: safeDonorId,
        servings: form.servings,
        status: 'active',
      });
    } catch {}

    // Distance-filtered NGO notifications via NGOService
    if (lat !== null && lng !== null) {
      try {
        const nearbyNgos = await NGOService.getNearbyNGOs(lat, lng, radiusKm, true);
        if (nearbyNgos.length > 0) {
          const notifs = nearbyNgos
            .filter((n) => n.id !== safeDonorId)
            .map((ngo) => ({
              user_id: ngo.id,
              type: 'new_donation',
              title: 'NEW FOOD AVAILABLE!',
              message: `${form.servings} servings of "${listing.title}" (${ngo.distanceKm} km away in ${listing.city || 'your area'}).`,
              data: {
                opportunity_type: 'ngo_food',
                food_listing_id: listing.id,
                title: listing.title,
                image_url: imageUrl,
                servings: form.servings,
                distance_km: ngo.distanceKm,
                available_until: availableUntilIso,
              },
              related_food_id: listing.id,
              action_url: `/donations/${listing.id}`,
            }));
          if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs);
          }
        }
      } catch {}
    }

    return mapListingToFood(listing);
  },

  async reserveFood(
    foodListingId: string,
    servings: number,
    pickupTime?: string,
    notes?: string
  ): Promise<string | null> {
    const { data: reservationId, error } = await supabase.rpc('reserve_food', {
      p_food_listing_id: foodListingId,
      p_servings: servings,
      p_pickup_time: pickupTime || null,
      p_notes: notes || null,
    });

    if (error) throw new Error(error.message || 'Reservation failed');
    return reservationId as string;
  },

  async cancelListing(listingId: string, reason?: string): Promise<boolean> {
    if (!isValidUUID(listingId)) return false;

    const { data: rpcOk, error: rpcErr } = await supabase.rpc('cancel_donation', {
      p_food_listing_id: listingId,
      p_reason: reason || null,
    });

    if (!rpcErr) return !!rpcOk;
    if (rpcErr.code !== 'PGRST202') {
      throw new Error(rpcErr.message || 'Failed to cancel donation');
    }

    // Fallback only if cancel_donation RPC not yet deployed
    const { data: activeTasks } = await supabase
      .from('delivery_tasks')
      .select('id, status')
      .eq('food_listing_id', listingId)
      .in('status', ['rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit']);

    if (activeTasks && activeTasks.length > 0) {
      throw new Error('Cannot cancel listing: a rider is currently assigned and delivery is in progress.');
    }

    await supabase
      .from('delivery_tasks')
      .update({ status: 'cancelled' })
      .eq('food_listing_id', listingId)
      .eq('status', 'awaiting_rider');

    const { error } = await supabase
      .from('food_listings')
      .update({ status: 'cancelled' })
      .eq('id', listingId);
    return !error;
  },

  async updateListing(listingId: string, form: Partial<CreateFoodListingForm>): Promise<FoodListing> {
    if (!isValidUUID(listingId)) throw new Error('Invalid listing ID');
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (form.title !== undefined) payload.title = form.title;
    if (form.description !== undefined) payload.description = form.description;
    if (form.category !== undefined) payload.category = form.category;
    if (form.foodType !== undefined) payload.food_type = form.foodType;
    if (form.servings !== undefined) {
      payload.servings = form.servings;
      payload.available_servings = form.servings;
    }
    if (form.pickupAddress !== undefined) payload.pickup_address = form.pickupAddress;
    if (form.city !== undefined) payload.city = form.city;
    if (form.latitude !== undefined) {
      payload.latitude = typeof form.latitude === 'number' && !isNaN(form.latitude) ? form.latitude : null;
    }
    if (form.longitude !== undefined) {
      payload.longitude = typeof form.longitude === 'number' && !isNaN(form.longitude) ? form.longitude : null;
    }
    if (form.availableFrom !== undefined) payload.available_from = form.availableFrom;
    if (form.availableUntil !== undefined) payload.available_until = form.availableUntil;
    if (form.isUrgent !== undefined) payload.is_urgent = form.isUrgent;
    if (form.storageType !== undefined) payload.storage_type = form.storageType;
    if (form.allergens !== undefined) payload.allergens = form.allergens;

    if (form.imageFile) {
      const uploadFile = await compressFoodImage(form.imageFile);
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const filename = `updates/${listingId}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('food-images')
        .upload(filename, uploadFile, { upsert: true, contentType: uploadFile.type || 'image/jpeg' });

      if (uploadErr) {
        throw new Error(`Updated photo upload failed: ${uploadErr.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('food-images').getPublicUrl(filename);
      payload.image_url = publicUrl;
    }

    const { data: listing, error } = await supabase
      .from('food_listings')
      .update(payload)
      .eq('id', listingId)
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .single();

    if (error || !listing) throw error || new Error('Failed to update food listing');
    return mapListingToFood(listing);
  },

  async updateListingStatus(listingId: string, status: FoodStatus): Promise<boolean> {
    if (!isValidUUID(listingId)) return false;
    const { error } = await supabase
      .from('food_listings')
      .update({ status })
      .eq('id', listingId);

    if (!error && (status === 'completed' || status === 'picked_up')) {
      const { data: listing } = await supabase
        .from('food_listings')
        .select('donor_id, servings')
        .eq('id', listingId)
        .single();

      if (listing && status === 'completed') {
        try {
          await supabase.from('impact_events').insert({
            user_id: listing.donor_id,
            event_type: 'food_rescued',
            servings: listing.servings,
          });
        } catch {}
      }
    }
    return !error;
  },

  async getMyReservations(userId: string) {
    if (!isValidUUID(userId)) return [];
    const { data, error } = await supabase
      .from('reservations')
      .select('*, food_listing:food_listings(*, donor:profiles!food_listings_donor_id_fkey(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data
      .filter((r: any) => r.food_listing)
      .map((r: any) => ({
        id: r.id,
        foodListingId: r.food_listing_id,
        foodListing: mapListingToFood(r.food_listing),
        userId: r.user_id,
        servings: r.servings,
        status: r.status,
        pickupTime: r.pickup_time,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
  },

  async updateReservationStatus(reservationId: string, status: string): Promise<boolean> {
    if (!isValidUUID(reservationId)) return false;
    const { error } = await supabase
      .from('reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', reservationId);
    return !error;
  },

  subscribeToListings(
    onInsert: (listing: FoodListing) => void,
    onUpdate?: (listing: FoodListing) => void,
    onDelete?: (listingId: string) => void
  ) {
    const channelName = `listings_live_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_listings',
        },
        async (payload) => {
          try {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as any)?.id;
              if (oldId) onDelete?.(oldId);
              return;
            }
            const id = (payload.new as any)?.id;
            if (!id) return;
            const { data } = await supabase
              .from('food_listings')
              .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
              .eq('id', id)
              .maybeSingle();
            if (!data) return;
            const mapped = mapListingToFood(data);
            if (payload.eventType === 'INSERT') {
              onInsert(mapped);
            } else if (payload.eventType === 'UPDATE') {
              onUpdate?.(mapped);
            }
          } catch {}
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};
