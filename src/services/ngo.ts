import { supabase } from '../lib/supabase';
import { LocationService } from './location';
import { isValidUUID } from '../lib/uuid';
import type { NearbyNGO, NearbyRider } from '../types';

export class NGOService {
  /**
   * Find verified NGOs near a given latitude/longitude via PostGIS RPC
   */
  static async getNearbyNGOs(
    latitude: number,
    longitude: number,
    radiusKm: number = 15,
    onlyVerified: boolean = true
  ): Promise<NearbyNGO[]> {
    // 1. Try new PostGIS find_nearby_ngos RPC
    try {
      const { data, error } = await supabase.rpc('find_nearby_ngos', {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: radiusKm,
        p_only_verified: onlyVerified,
      });

      if (!error && Array.isArray(data)) {
        return data.map((row: any) => ({
          id: row.id,
          fullName: row.full_name || 'Community NGO',
          organizationName: row.organization_name || row.full_name,
          phone: row.phone,
          address: row.address,
          city: row.city,
          latitude: row.latitude,
          longitude: row.longitude,
          avatarUrl: row.avatar_url,
          isVerified: !!row.is_verified,
          isAvailable: row.is_available ?? true,
          serviceRadiusKm: row.service_radius_km ?? 15,
          operatingHours: row.operating_hours,
          dailyCapacity: row.daily_capacity,
          distanceKm: Number(row.distance_km || 0),
        }));
      }
    } catch {}

    // 2. Try legacy nearby_ngos RPC
    try {
      const { data, error } = await supabase.rpc('nearby_ngos', {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: radiusKm,
      });

      if (!error && Array.isArray(data)) {
        return data
          .filter((row: any) => !onlyVerified || !!row.is_verified)
          .map((row: any) => ({
            id: row.id,
            fullName: row.full_name || 'Community NGO',
            organizationName: row.organization_name || row.full_name,
            phone: row.phone,
            address: row.address,
            city: row.city,
            latitude: row.latitude,
            longitude: row.longitude,
            avatarUrl: row.avatar_url,
            isVerified: !!row.is_verified,
            distanceKm: Number(row.distance_km || 0),
          }));
      }
    } catch {}

    // 3. Fallback: direct query on profiles
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .in('role', ['ngo', 'receiver', 'acceptor'])
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (onlyVerified) {
        query = query.eq('is_verified', true);
      }

      const { data: profiles, error } = await query;
      if (error || !profiles) return [];

      return profiles
        .map((p: any) => ({
          id: p.id,
          fullName: p.full_name || 'Community NGO',
          organizationName: p.organization_name || p.full_name,
          phone: p.phone,
          address: p.address,
          city: p.city,
          latitude: p.latitude,
          longitude: p.longitude,
          avatarUrl: p.avatar_url,
          isVerified: !!p.is_verified,
          isAvailable: p.is_available ?? true,
          serviceRadiusKm: p.service_radius_km ?? 15,
          operatingHours: p.operating_hours,
          dailyCapacity: p.daily_capacity,
          distanceKm: LocationService.calculateDistance(latitude, longitude, p.latitude, p.longitude),
        }))
        .filter((n) => n.distanceKm <= radiusKm && n.isAvailable !== false)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (err) {
      console.error('Failed to load nearby NGOs:', err);
      return [];
    }
  }

  /**
   * Find online available riders near a location via PostGIS RPC (privacy-safe: no private coords leaked)
   */
  static async getNearbyRiders(
    latitude: number,
    longitude: number,
    radiusKm: number = 15
  ): Promise<NearbyRider[]> {
    try {
      const { data, error } = await supabase.rpc('find_nearby_riders', {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: radiusKm,
      });

      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          riderId: r.rider_id,
          userId: r.user_id,
          name: r.name || 'ShareBite Rider',
          vehicleType: r.vehicle_type || 'bike',
          rating: Number(r.rating ?? 5.0),
          isOnline: !!r.is_online,
          isAvailable: !!r.is_available,
          lastLocationAt: r.last_location_at,
          distanceKm: Number(r.distance_km || 0),
        }));
      }
    } catch {}
    return [];
  }

  /**
   * Update NGO availability, service radius, or GPS location in Supabase
   */
  static async updateAvailability(
    ngoId: string,
    updates: {
      isAvailable?: boolean;
      serviceRadiusKm?: number;
      latitude?: number;
      longitude?: number;
      address?: string;
      city?: string;
      operatingHours?: string;
      dailyCapacity?: number;
    }
  ): Promise<boolean> {
    if (!isValidUUID(ngoId)) return false;

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;
    if (updates.serviceRadiusKm !== undefined) payload.service_radius_km = updates.serviceRadiusKm;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.operatingHours !== undefined) payload.operating_hours = updates.operatingHours;
    if (updates.dailyCapacity !== undefined) payload.daily_capacity = updates.dailyCapacity;

    let { error } = await supabase.from('profiles').update(payload).eq('id', ngoId);

    // Fallback if extended columns not yet migrated
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      delete payload.is_available;
      delete payload.service_radius_km;
      delete payload.operating_hours;
      delete payload.daily_capacity;
      const retry = await supabase.from('profiles').update(payload).eq('id', ngoId);
      error = retry.error;
    }

    return !error;
  }

  /**
   * Get an NGO profile with statistics
   */
  static async getNGOProfile(ngoId: string) {
    if (!isValidUUID(ngoId)) return null;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', ngoId)
      .maybeSingle();

    if (error || !profile) return null;

    const { count: claimsCount } = await supabase
      .from('ngo_claims')
      .select('*', { count: 'exact', head: true })
      .eq('ngo_id', ngoId);

    return {
      ...profile,
      totalClaims: claimsCount || 0,
    };
  }
}
