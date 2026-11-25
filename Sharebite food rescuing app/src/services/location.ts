import { supabase } from '../lib/supabase';
import type { RiderLocationUpdate } from '../types';

export interface Coordinates {
  latitude: number;
  longitude: number;
  city?: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  city?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  city?: string;
  displayName?: string;
}

// In-memory geocoding caches to minimize redundant network requests
const geocodeCache = new Map<string, GeocodeResult>();
const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>();

// Default center (India center for broad view when location is unspecified)
export const DEFAULT_COORDINATES: Coordinates = {
  latitude: 20.5937,
  longitude: 78.9629,
  city: 'India',
};

export class LocationService {
  /**
   * Geocode a human-entered street/area/city address to accurate latitude and longitude.
   * Uses OpenStreetMap Nominatim with caching and fallback segment resolution.
   */
  static async geocodeAddress(
    query: string,
    signal?: AbortSignal
  ): Promise<GeocodeResult | null> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) return null;

    const cacheKey = trimmed.toLowerCase();
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }

    const tryFetch = async (q: string): Promise<GeocodeResult | null> => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal,
          headers: {
            'Accept-Language': 'en',
          },
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const first = data[0];
        const latitude = parseFloat(first.lat);
        const longitude = parseFloat(first.lon);

        if (
          isNaN(latitude) ||
          isNaN(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return null;
        }

        const addr = first.address || {};
        const city =
          addr.city ||
          addr.town ||
          addr.city_district ||
          addr.state_district ||
          addr.suburb ||
          addr.county ||
          '';

        return {
          latitude,
          longitude,
          displayName: first.display_name,
          city,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        return null;
      }
    };

    // First attempt: exact query
    let result = await tryFetch(trimmed);

    // Second attempt: if specific unit/flat or number failed, try broader segments
    if (!result && trimmed.includes(',')) {
      const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        // Drop the first segment (often flat/office/shop number) and query the rest
        const broader = parts.slice(1).join(', ');
        result = await tryFetch(broader);
      }
    }

    if (result) {
      geocodeCache.set(cacheKey, result);
    }
    return result;
  }

  /**
   * Reverse geocode coordinates to a readable address and city.
   */
  static async reverseGeocode(
    latitude: number,
    longitude: number,
    signal?: AbortSignal
  ): Promise<ReverseGeocodeResult | null> {
    if (
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    if (reverseGeocodeCache.has(cacheKey)) {
      return reverseGeocodeCache.get(cacheKey)!;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`;
      const res = await fetch(url, {
        signal,
        headers: {
          'Accept-Language': 'en',
        },
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.display_name) return null;

      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.city_district ||
        addr.state_district ||
        addr.suburb ||
        addr.county ||
        '';

      // Build a concise human-readable address from address details if possible
      const parts = [
        addr.road || addr.pedestrian || addr.suburb,
        addr.neighbourhood || addr.residential,
        city,
      ].filter(Boolean);

      const cleanAddress = parts.length > 0 ? parts.join(', ') : data.display_name;

      const result: ReverseGeocodeResult = {
        address: cleanAddress,
        city,
        displayName: data.display_name,
      };

      reverseGeocodeCache.set(cacheKey, result);
      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      return null;
    }
  }

  /**
   * Get the current device coordinates via HTML5 Geolocation API with graceful fallback
   */
  static async getCurrentCoordinates(): Promise<Coordinates> {
    if (!navigator.geolocation) {
      return DEFAULT_COORDINATES;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation access failed or denied:', error.message);
          resolve(DEFAULT_COORDINATES);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Watch live location updates
   */
  static watchLocation(
    onLocation: (coords: Coordinates) => void,
    onError?: (err: GeolocationPositionError) => void
  ): number | null {
    if (!navigator.geolocation) return null;
    return navigator.geolocation.watchPosition(
      (pos) => {
        onLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      onError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }

  static clearWatch(watchId: number | null): void {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  /**
   * Haversine formula for distance calculation in kilometers
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Zomato-style realistic city delivery ETA estimate based on distance
   */
  static calculateEta(distanceKm: number, avgSpeedKmh = 25): { minutes: number; text: string } {
    if (distanceKm <= 0.1) {
      return { minutes: 1, text: 'Arriving now' };
    }
    // Urban motorbike transit with signal/traffic overhead (+2 min buffer)
    const rawMinutes = (distanceKm / avgSpeedKmh) * 60 + 2;
    const minutes = Math.max(2, Math.round(rawMinutes));
    const text = minutes < 60 ? `${minutes} mins` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return { minutes, text };
  }

  static calculateEtaBetween(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    avgSpeedKmh = 25
  ): { distanceKm: number; minutes: number; text: string } {
    const distanceKm = LocationService.calculateDistance(lat1, lon1, lat2, lon2);
    const { minutes, text } = LocationService.calculateEta(distanceKm, avgSpeedKmh);
    return { distanceKm, minutes, text };
  }

  /**
   * Broadcast rider location to database and realtime subscribers
   */
  static async updateRiderLocation(params: {
    riderId: string;
    deliveryTaskId?: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): Promise<void> {
    try {
      // Resolve the riders.id (PK) from the auth user UUID (user_id FK)
      // These are two different UUIDs — riders.id != auth.users.id
      let riderRowId = params.riderId; // fallback (may fail FK if wrong, but better than nothing)
      try {
        const { data: riderRow } = await supabase
          .from('riders')
          .select('id')
          .eq('user_id', params.riderId)
          .maybeSingle();
        if (riderRow?.id) riderRowId = riderRow.id;
      } catch {}

      // 1. Record historical update in rider_location_updates (uses riders.id PK)
      await supabase.from('rider_location_updates').insert({
        rider_id: riderRowId,
        delivery_task_id: params.deliveryTaskId || null,
        latitude: params.latitude,
        longitude: params.longitude,
        heading: params.heading || null,
        speed: params.speed || null,
      });

      // 2. Update current position on riders table (filter by user_id, not id)
      await supabase
        .from('riders')
        .update({
          current_lat: params.latitude,
          current_lng: params.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', params.riderId);
    } catch (err) {
      console.error('Error broadcasting rider location:', err);
    }
  }

  /**
   * Subscribe to live location updates for a specific delivery task
   */
  static subscribeToDeliveryTracking(
    deliveryTaskId: string,
    onLocation: (loc: RiderLocationUpdate) => void
  ) {
    const channel = supabase
      .channel(`rider-loc:${deliveryTaskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rider_location_updates',
          filter: `delivery_task_id=eq.${deliveryTaskId}`,
        },
        (payload) => {
          const row = payload.new as any;
          onLocation({
            id: row.id,
            riderId: row.rider_id,
            deliveryTaskId: row.delivery_task_id,
            latitude: row.latitude,
            longitude: row.longitude,
            heading: row.heading,
            speed: row.speed,
            recordedAt: row.recorded_at,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  /**
   * Fetch the most recent location for a delivery task
   */
  static async getLatestDeliveryLocation(
    deliveryTaskId: string
  ): Promise<RiderLocationUpdate | null> {
    const { data, error } = await supabase
      .from('rider_location_updates')
      .select('*')
      .eq('delivery_task_id', deliveryTaskId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      riderId: data.rider_id,
      deliveryTaskId: data.delivery_task_id,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      speed: data.speed,
      recordedAt: data.recorded_at,
    };
  }
}
