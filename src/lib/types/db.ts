/**
 * Hand-rolled DB row types matching supabase/migrations/0001_init.sql.
 * Mirror this file when migrations change schema.
 *
 * The schema shape (Tables/Views/Functions/Enums/CompositeTypes) follows
 * what @supabase/supabase-js expects so `from(...).select('*')` infers
 * Row types instead of `never`.
 */

import type { Athlete, BodyBox, FaceBox, Pose, Row } from '@/types';

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

/** One live judge desk, keyed by built-in judge slug (see 0002_judge_cards.sql). */
export type JudgeCardRow = {
  slug: string;
  display_name: string;
  athlete_a: Athlete;
  athlete_b: Athlete;
  rows: Row[];
  current_pose_id: string;
  updated_at: string;
};

/**
 * One Host-curated pose photo in the shared manifest. `url` points at the
 * public `show-photos` Storage bucket; the rest is positioning metadata carried
 * verbatim from the Host's processPhoto result (see 0003_show_photos.sql).
 */
export type SharedPhoto = {
  url: string;
  face?: FaceBox;
  body?: BodyBox;
  pose?: Pose;
  offsetX?: number;
  offsetY?: number;
};

/** Manifest body: per pose id, the A and/or B shared photo. */
export type ShowPhotosPoses = {
  [poseId: string]: { A?: SharedPhoto; B?: SharedPhoto };
};

/** The single shared-photo row for a show, keyed by show code. */
export type ShowPhotosRow = {
  show_code: string;
  poses: ShowPhotosPoses;
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
      judge_cards: {
        Row: JudgeCardRow;
        Insert: Partial<JudgeCardRow> & { slug: string };
        Update: Partial<JudgeCardRow>;
        Relationships: [];
      };
      show_photos: {
        Row: ShowPhotosRow;
        Insert: Partial<ShowPhotosRow> & { show_code: string };
        Update: Partial<ShowPhotosRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
