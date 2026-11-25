import { supabase } from '../lib/supabase';
import { LocationService } from './location';
import { toSafeUUID, DEMO_RECORD_UUIDS } from '../lib/uuid';
import type { NearbyNGO } from '../types';

export class NGOService {
  /**
   * Find verified NGOs near a given latitude/longitude
   * Uses the nearby_ngos() RPC if available, or falls back to querying profiles
   */
  static async getNearbyNGOs(
    latitude: number,
    longitude: number,
    radiusKm: number = 25
  ): Promise<NearbyNGO[]> {
    try {
      // 1. Try RPC first
      const { data, error } = await supabase.rpc('nearby_ngos', {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: radiusKm,
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
          distanceKm: Number(row.distance_km || 0),
        }));
      }
    } catch {
      // RPC might not be deployed yet, fall back to direct query
    }

    // 2. Fallback: Query profiles table
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['ngo', 'volunteer'])
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error || !profiles) return [];

      const withDistance = profiles.map((p) => {
        const dist = LocationService.calculateDistance(
          latitude,
          longitude,
          p.latitude,
          p.longitude
        );
        return {
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
          distanceKm: dist,
        };
      });

      return withDistance
        .filter((n) => n.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (err) {
      console.error('Failed to load nearby NGOs:', err);
      return [];
    }
  }

  /**
   * Get an NGO profile with statistics
   */
  static async getNGOProfile(ngoId: string) {
    const safeNgoId = toSafeUUID(ngoId, DEMO_RECORD_UUIDS.ngo);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', safeNgoId)
      .maybeSingle();

    if (error || !profile) return null;

    // Fetch impact / claim counts
    const { count: claimsCount } = await supabase
      .from('ngo_claims')
      .select('*', { count: 'exact', head: true })
      .eq('ngo_id', safeNgoId);

    return {
      ...profile,
      totalClaims: claimsCount || 0,
    };
  }
}
