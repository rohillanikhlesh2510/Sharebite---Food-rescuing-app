// ShareBite — Partners Service (Web)
import { supabase } from '../lib/supabase';
import { toSafeUUID, DEMO_RECORD_UUIDS } from '../lib/uuid';
import type { Partner } from '../types';

function mapPartner(data: any): Partner {
  return {
    id: data.id,
    profileId: data.profile_id,
    organizationName: data.organization_name,
    organizationType: data.organization_type,
    description: data.description,
    address: data.address,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    logoUrl: data.logo_url,
    isVerified: data.is_verified || false,
    createdAt: data.created_at,
  };
}

export const PartnersService = {
  async getPartners(): Promise<Partner[]> {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapPartner);
  },

  async getVerifiedPartners(): Promise<Partner[]> {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('is_verified', true)
      .order('organization_name');
    if (error || !data) return [];
    return data.map(mapPartner);
  },

  async createPartner(profileId: string, orgData: Partial<Partner>): Promise<Partner | null> {
    const safeProfileId = toSafeUUID(profileId, DEMO_RECORD_UUIDS.ngo);
    const { data, error } = await supabase
      .from('partners')
      .insert({
        profile_id: safeProfileId,
        organization_name: orgData.organizationName,
        organization_type: orgData.organizationType || 'other',
        description: orgData.description,
        address: orgData.address,
        city: orgData.city,
        latitude: orgData.latitude,
        longitude: orgData.longitude,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapPartner(data);
  },
};
