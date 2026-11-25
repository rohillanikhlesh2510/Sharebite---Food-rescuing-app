import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lzyuvgbhpkiqxscqxggq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eXV2Z2JocGtpcXhzY3F4Z2dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1ODk2ODEsImV4cCI6MjEwMzE2NTY4MX0.ComcENWxtrLIahxbssL3jJowLRGPjcHCQuPI6_sjSuE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: string;
          bio: string | null;
          address: string | null;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          organization_name: string | null;
          organization_type: string | null;
          is_verified: boolean;
          verification_status: string;
          total_donations: number;
          average_rating: number;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
      };
      food_listings: {
        Row: {
          id: string;
          donor_id: string;
          title: string;
          description: string | null;
          category: string;
          food_type: string;
          servings: number;
          available_servings: number;
          image_url: string | null;
          pickup_address: string | null;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          available_from: string;
          available_until: string;
          status: string;
          is_urgent: boolean;
          allergens: string[] | null;
          storage_type: string | null;
          moderation_status: string;
          destination_type: string | null;
          target_ngo_id: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          food_listing_id: string;
          user_id: string;
          servings: number;
          status: string;
          pickup_time: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      donations: {
        Row: {
          id: string;
          food_listing_id: string;
          donor_id: string;
          servings: number;
          status: string;
          created_at: string;
          completed_at: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
      };
      partners: {
        Row: {
          id: string;
          profile_id: string | null;
          organization_name: string;
          organization_type: string;
          description: string | null;
          address: string | null;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          logo_url: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
