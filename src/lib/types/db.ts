/**
 * Hand-rolled DB row types matching supabase/migrations/0001_init.sql.
 * Mirror this file when migrations change schema.
 *
 * The schema shape (Tables/Views/Functions/Enums/CompositeTypes) follows
 * what @supabase/supabase-js expects so `from(...).select('*')` infers
 * Row types instead of `never`.
 */

import type { Athlete, Row } from '@/types';

export type ProfileRow = {
  id: string;
  display_name: string;
  brand_line_1: string;
  brand_line_2: string;
  logo_url: string | null;
  bg: string;
  bg_glow: string;
  fg: string;
  mosaic_1: string;
  mosaic_2: string;
  mosaic_3: string;
  mosaic_4: string;
  mosaic_5: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type ScorecardRow = {
  user_id: string;
  athlete_a: Athlete;
  athlete_b: Athlete;
  rows: Row[];
  current_pose_id: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      scorecards: {
        Row: ScorecardRow;
        Insert: Partial<ScorecardRow> & { user_id: string };
        Update: Partial<ScorecardRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
