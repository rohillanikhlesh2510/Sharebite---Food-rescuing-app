// ShareBite — Donations / Food Listings Service (Web)
import { supabase } from '../lib/supabase';
import { isValidUUID, toSafeUUID, DEMO_RECORD_UUIDS, DEMO_FOOD_UUIDS } from '../lib/uuid';
import type { FoodListing, FoodStatus, CreateFoodListingForm } from '../types';

export const FALLBACK_DEMO_LISTINGS: FoodListing[] = [
  {
    id: DEMO_FOOD_UUIDS.food1,
    donorId: DEMO_RECORD_UUIDS.donor,
    title: 'Vegetable Rice + Dal',
    description: 'Freshly prepared vegetable pulao with yellow dal tadka in food grade containers.',
    category: 'cooked_meals',
    foodType: 'veg',
    servings: 25,
    availableServings: 25,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    pickupAddress: 'Malviya Nagar, Near New Market',
    city: 'Bhopal',
    latitude: 23.2384,
    longitude: 77.4042,
    availableFrom: new Date().toISOString(),
    availableUntil: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    status: 'available',
    isUrgent: false,
    allergens: [],
    storageType: 'hot_insulated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    distanceKm: 1.8,
  },
  {
    id: DEMO_FOOD_UUIDS.food2,
    donorId: DEMO_RECORD_UUIDS.donor,
    title: 'Fresh Fruits',
    description: 'Seasonal apples, bananas, and oranges surplus from hostel mess.',
    category: 'fruits_veg',
    foodType: 'veg',
    servings: 30,
    availableServings: 30,
    imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80',
    pickupAddress: 'MANIT Campus, Link Road 3',
    city: 'Bhopal',
    latitude: 23.2185,
    longitude: 77.4082,
    availableFrom: new Date().toISOString(),
    availableUntil: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    status: 'available',
    isUrgent: false,
    allergens: [],
    storageType: 'room_temp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    distanceKm: 2.4,
  },
  {
    id: DEMO_FOOD_UUIDS.food3,
    donorId: DEMO_RECORD_UUIDS.donorSecondary,
    title: 'Bread & Bakery Items',
    description: 'Whole wheat bread loaves, croissants, and dinner rolls baked this morning.',
    category: 'bakery',
    foodType: 'veg',
    servings: 20,
    availableServings: 20,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    pickupAddress: 'Arera Colony, E-3 Sector',
    city: 'Bhopal',
    latitude: 23.2145,
    longitude: 77.4285,
    availableFrom: new Date().toISOString(),
    availableUntil: new Date(Date.now() + 1.5 * 3600 * 1000).toISOString(),
    status: 'available',
    isUrgent: true,
    allergens: ['gluten'],
    storageType: 'room_temp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    distanceKm: 3.1,
  },
  {
    id: DEMO_FOOD_UUIDS.food4,
    donorId: DEMO_RECORD_UUIDS.donorSecondary,
    title: 'Packed Meals',
    description: 'Sealed buffet packages containing roti, sabzi, rice, and curd.',
    category: 'cooked_meals',
    foodType: 'veg',
    servings: 24,
    availableServings: 24,
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
    pickupAddress: 'MP Nagar Zone 1, Near DB City Mall',
    city: 'Bhopal',
    latitude: 23.2334,
    longitude: 77.4342,
    availableFrom: new Date().toISOString(),
    availableUntil: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    status: 'available',
    isUrgent: false,
    allergens: [],
    storageType: 'room_temp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    distanceKm: 4.7,
  },
  {
    id: DEMO_FOOD_UUIDS.food5,
    donorId: DEMO_RECORD_UUIDS.donor,
    title: 'Paneer Butter Masala & Roti',
    description: 'Catering event surplus, safely kept in insulated food containers.',
    category: 'cooked_meals',
    foodType: 'veg',
    servings: 35,
    availableServings: 35,
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&q=80',
    pickupAddress: 'Shahpura Lake Road',
    city: 'Bhopal',
    latitude: 23.1950,
    longitude: 77.4250,
    availableFrom: new Date().toISOString(),
    availableUntil: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    status: 'available',
    isUrgent: false,
    allergens: ['dairy'],
    storageType: 'hot_insulated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    distanceKm: 5.2,
  },
];

function mapListingToFood(data: any): FoodListing {
  const donorData = data.donor;
  return {
    id: data.id,
    donorId: data.donor_id,
    donor: donorData ? {
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
    } : undefined,
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
  };
}

export const DonationService = {
  async getActiveListings(): Promise<FoodListing[]> {
    const { data, error } = await supabase
      .from('food_listings')
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .in('status', ['available', 'partially_reserved'])
      .gt('available_servings', 0)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      console.warn('Error fetching food listings:', error);
      return [];
    }
    return data.map(mapListingToFood);
  },

  async getListingById(id: string): Promise<FoodListing | null> {
    const safeId = toSafeUUID(id);
    if (!isValidUUID(safeId)) return null;

    try {
      const { data, error } = await supabase
        .from('food_listings')
        .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
        .eq('id', safeId)
        .maybeSingle();

      if (!error && data) return mapListingToFood(data);
    } catch {}

    const fallback = FALLBACK_DEMO_LISTINGS.find(f => f.id === safeId || f.id === id);
    if (fallback) return fallback;

    return null;
  },

  async getMyListings(donorId: string): Promise<FoodListing[]> {
    const safeDonorId = toSafeUUID(donorId, DEMO_RECORD_UUIDS.donor);

    const { data, error } = await supabase
      .from('food_listings')
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .eq('donor_id', safeDonorId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapListingToFood);
  },

  async createListing(donorId: string, form: CreateFoodListingForm): Promise<FoodListing> {
    let safeDonorId = donorId;
    if (!isValidUUID(safeDonorId)) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && isValidUUID(user.id)) {
        safeDonorId = user.id;
      } else {
        safeDonorId = toSafeUUID(donorId, DEMO_RECORD_UUIDS.donor);
      }
    }

    let imageUrl: string | null = null;

    if (form.imageFile) {
      try {
        const ext = form.imageFile.name.split('.').pop() || 'jpg';
        const filename = `${safeDonorId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('food-images')
          .upload(filename, form.imageFile, { upsert: true });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('food-images')
            .getPublicUrl(filename);
          imageUrl = publicUrl;
        } else {
          // If storage bucket is not configured, generate a local data URL as safe preview
          imageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(form.imageFile!);
          });
        }
      } catch (err) {
        console.warn('Image storage handling error:', err);
      }
    }

    // Prepare enriched description with dietary & handling notes
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
      ? (extraNotes.length > 0 ? `${form.description}\n\n---\n${extraNotes.join(' | ')}` : form.description)
      : extraNotes.join(' | ');

    // Primary insert payload with full metadata
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
      latitude: typeof form.latitude === 'number' && !isNaN(form.latitude) ? form.latitude : null,
      longitude: typeof form.longitude === 'number' && !isNaN(form.longitude) ? form.longitude : null,
      available_from: form.availableFrom,
      available_until: form.availableUntil,
      status: 'available',
      is_urgent: form.isUrgent,
      allergens: form.allergens || [],
      storage_type: form.storageType || 'room_temp',
    };

    let { data: listing, error } = await supabase
      .from('food_listings')
      .insert(payload)
      .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
      .maybeSingle();

    // Fallback if extended columns are not yet applied on remote instance
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      delete payload.allergens;
      delete payload.storage_type;
      const retry = await supabase
        .from('food_listings')
        .insert(payload)
        .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
        .single();
      listing = retry.data;
      error = retry.error;
    }

    if (error || !listing) throw error || new Error('Failed to create food listing');

    // Record impact event safely
    try {
      await supabase.from('impact_events').insert({
        user_id: safeDonorId,
        event_type: 'food_donated',
        servings: form.servings,
      });
    } catch {}

    // Record in donations table safely
    try {
      await supabase.from('donations').insert({
        food_listing_id: listing.id,
        donor_id: safeDonorId,
        servings: form.servings,
        status: 'active',
      });
    } catch {}

    // Notify eligible NGOs about newly available surplus food
    try {
      const { data: ngos } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'ngo')
        .limit(20);

      if (ngos && ngos.length > 0) {
        const ngoNotifs = ngos.map((ngo: any) => ({
          user_id: ngo.id,
          type: 'new_donation',
          title: '🍲 New Food Donation Available!',
          message: `${form.servings} servings of "${listing.title}" are available in ${listing.city || 'your area'}. Claim now!`,
          data: { food_listing_id: listing.id },
          related_food_id: listing.id,
          action_url: '/discover',
        }));
        await supabase.from('notifications').insert(ngoNotifs);
      }
    } catch (notifErr) {
      console.warn('NGO broadcast notice:', notifErr);
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

  async cancelListing(listingId: string): Promise<boolean> {
    if (!isValidUUID(listingId)) return true;
    // BUG-04: Prevent cancellation if delivery is actively in progress
    try {
      const { data: activeTasks } = await supabase
        .from('delivery_tasks')
        .select('id, status')
        .eq('food_listing_id', listingId)
        .in('status', ['rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit']);

      if (activeTasks && activeTasks.length > 0) {
        throw new Error('Cannot cancel listing: a rider is currently assigned and delivery is in progress.');
      }

      // Mark any awaiting tasks as cancelled
      await supabase
        .from('delivery_tasks')
        .update({ status: 'cancelled' })
        .eq('food_listing_id', listingId)
        .eq('status', 'awaiting_rider');
    } catch (guardErr: any) {
      if (guardErr.message?.includes('Cannot cancel listing')) {
        throw guardErr;
      }
    }

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
      try {
        const ext = form.imageFile.name.split('.').pop() || 'jpg';
        const filename = `updates/${listingId}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('food-images')
          .upload(filename, form.imageFile, { upsert: true });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('food-images')
            .getPublicUrl(filename);
          payload.image_url = publicUrl;
        } else {
          payload.image_url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(form.imageFile!);
          });
        }
      } catch (err) {
        console.warn('Image storage handling error:', err);
      }
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
    const safeUserId = toSafeUUID(userId, DEMO_RECORD_UUIDS.donor);
    const { data, error } = await supabase
      .from('reservations')
      .select('*, food_listing:food_listings(*, donor:profiles!food_listings_donor_id_fkey(*))')
      .eq('user_id', safeUserId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.filter((r: any) => r.food_listing).map((r: any) => ({
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

  subscribeToListings(callback: (listing: FoodListing) => void) {
    const channelName = `listings_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'food_listings',
      }, async (payload) => {
        try {
          const { data } = await supabase
            .from('food_listings')
            .select('*, donor:profiles!food_listings_donor_id_fkey(*)')
            .eq('id', payload.new.id)
            .single();
          if (data) callback(mapListingToFood(data));
        } catch {}
      })
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },
};
