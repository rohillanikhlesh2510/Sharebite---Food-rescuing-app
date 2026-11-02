// ShareBite — Impact Service (Web)
import { supabase } from '../lib/supabase';
import { toSafeUUID, DEMO_RECORD_UUIDS } from '../lib/uuid';
import type { ImpactStats, CommunityImpact } from '../types';

let communityImpactCache: { data: CommunityImpact; timestamp: number } | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

export const ImpactService = {
  async getUserImpact(userId: string, role: string): Promise<ImpactStats> {
    const safeUserId = toSafeUUID(userId, role === 'ngo' ? DEMO_RECORD_UUIDS.ngo : DEMO_RECORD_UUIDS.donor);

    try {
      const { data: viewData } = await supabase
        .from('user_impact')
        .select('*')
        .eq('user_id', safeUserId)
        .maybeSingle();

      if (viewData) {
        const mealsDonated = Number(viewData.meals_donated) || 0;
        const mealsRescued = Number(viewData.meals_rescued) || 0;
        const mealsSaved = (role === 'ngo' || role === 'receiver' || role === 'volunteer') ? mealsRescued : mealsDonated;
        const foodKg = Math.round(mealsSaved * 0.25);
        const co2Kg = Math.round(foodKg * 0.5);

        return {
          mealsSaved,
          foodRedistributedKg: foodKg,
          co2SavedKg: co2Kg,
          peopleReached: Math.round(mealsSaved * 0.9),
          wastePreventedKg: foodKg,
          donationsCount: Number(viewData.donation_count) || 0,
          claimsCount: Number(viewData.reservation_count) || 0,
        };
      }

      // Fallback: manual aggregation
      if (role === 'ngo' || role === 'receiver' || role === 'volunteer') {
        const { data } = await supabase
          .from('reservations')
          .select('servings')
          .eq('user_id', safeUserId)
          .eq('status', 'completed');

        const mealsSaved = data ? data.reduce((acc, r) => acc + r.servings, 0) : 0;
        const foodKg = Math.round(mealsSaved * 0.25);
        return {
          mealsSaved,
          foodRedistributedKg: foodKg,
          co2SavedKg: Math.round(foodKg * 0.5),
          peopleReached: Math.round(mealsSaved * 0.9),
          wastePreventedKg: foodKg,
          donationsCount: 0,
          claimsCount: data?.length || 0,
        };
      } else {
        const [impactResult, countResult] = await Promise.all([
          supabase.from('impact_events').select('servings').eq('user_id', safeUserId).eq('event_type', 'food_donated'),
          supabase.from('food_listings').select('*', { count: 'exact', head: true }).eq('donor_id', safeUserId),
        ]);

        const mealsSaved = impactResult.data ? impactResult.data.reduce((acc, r) => acc + r.servings, 0) : 0;
        const foodKg = Math.round(mealsSaved * 0.25);
        const donCount = countResult.count;

        return {
          mealsSaved,
          foodRedistributedKg: foodKg,
          co2SavedKg: Math.round(foodKg * 0.5),
          peopleReached: Math.round(mealsSaved * 0.9),
          wastePreventedKg: foodKg,
          donationsCount: donCount || 0,
          claimsCount: 0,
        };
      }
    } catch {
      return { mealsSaved: 0, foodRedistributedKg: 0, co2SavedKg: 0, peopleReached: 0, wastePreventedKg: 0, donationsCount: 0, claimsCount: 0 };
    }
  },

  async getCommunityImpact(): Promise<CommunityImpact> {
    // 1. Check in-memory cache
    if (communityImpactCache && Date.now() - communityImpactCache.timestamp < CACHE_TTL_MS) {
      return communityImpactCache.data;
    }

    // 2. Check sessionStorage
    try {
      const stored = sessionStorage.getItem('sharebite_community_impact');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          communityImpactCache = parsed;
          return parsed.data;
        }
      }
    } catch {}

    try {
      // Execute all 5 queries concurrently in parallel
      const [resResult, donorsResult, ngosResult, donResult, cityResult] = await Promise.all([
        supabase.from('reservations').select('servings').eq('status', 'completed'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'donor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'ngo'),
        supabase.from('food_listings').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('city').not('city', 'is', null),
      ]);

      const resData = resResult.data;
      const totalMeals = resData ? resData.reduce((acc, r) => acc + r.servings, 0) : 0;
      const foodKg = Math.round(totalMeals * 0.25);
      const uniqueCities = new Set(((cityResult.data as any[]) || []).map((r: any) => r.city?.toLowerCase()).filter(Boolean)).size;

      const impactData: CommunityImpact = {
        activeDonors: donorsResult.count || 0,
        activeNGOs: ngosResult.count || 0,
        citiesCovered: uniqueCities || 0,
        thisMonthMeals: totalMeals,
        foodRedistributedKg: foodKg,
        co2SavedKg: Math.round(foodKg * 0.5),
        mealsSaved: totalMeals,
        peopleReached: Math.round(totalMeals * 0.9),
        wastePreventedKg: foodKg,
        donationsCount: donResult.count || 0,
        claimsCount: resData?.length || 0,
      };

      // Store in caches
      communityImpactCache = { data: impactData, timestamp: Date.now() };
      try {
        sessionStorage.setItem('sharebite_community_impact', JSON.stringify({ data: impactData, timestamp: Date.now() }));
      } catch {}

      return impactData;
    } catch {
      if (communityImpactCache) return communityImpactCache.data;
      return { activeDonors: 0, activeNGOs: 0, citiesCovered: 0, thisMonthMeals: 0, foodRedistributedKg: 0, co2SavedKg: 0, mealsSaved: 0, peopleReached: 0, wastePreventedKg: 0, donationsCount: 0, claimsCount: 0 };
    }
  },
};
