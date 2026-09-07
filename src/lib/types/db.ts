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

export type SuperchatInviteStatus = 'active' | 'claimed' | 'closed';
export type SuperchatClaimStatus = 'pending' | 'approved' | 'rejected';

export type SuperchatInviteRow = {
  id: string;
  claim_token: string;
  display_name: string;
  amount: number;
  currency: string;
  note: string;
  status: SuperchatInviteStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type FanScorecardRow = {
  id: string;
  invite_id: string;
  display_name: string;
  athlete_a: Athlete;
  athlete_b: Athlete;
  rows: Row[];
  current_pose_id: string;
  locked: boolean;
  updated_at: string;
};

export type SuperchatClaimRow = {
  id: string;
  invite_id: string;
  verification_code: string;
  status: SuperchatClaimStatus;
  created_at: string;
  reviewed_at: string | null;
};

export type LiveVoteChoice =
  | 'A1' | 'A2' | 'A3' | 'A4'
  | 'tie'
  | 'B1' | 'B2' | 'B3' | 'B4';

export type LiveVoteRow = {
  id: string;
  matchup_key: string;
  voter_id: string;
  username: string;
  votes: Record<string, LiveVoteChoice>;
  created_at: string;
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
      superchat_invites: {
        Row: SuperchatInviteRow;
        Insert: Partial<SuperchatInviteRow> & Pick<SuperchatInviteRow, 'claim_token' | 'display_name'>;
        Update: Partial<SuperchatInviteRow>;
        Relationships: [];
      };
      fan_scorecards: {
        Row: FanScorecardRow;
        Insert: Partial<FanScorecardRow> & Pick<FanScorecardRow, 'invite_id' | 'display_name'>;
        Update: Partial<FanScorecardRow>;
        Relationships: [];
      };
      superchat_claims: {
        Row: SuperchatClaimRow;
        Insert: Partial<SuperchatClaimRow> & Pick<SuperchatClaimRow, 'invite_id' | 'verification_code'>;
        Update: Partial<SuperchatClaimRow>;
        Relationships: [];
      };
      live_votes: {
        Row: LiveVoteRow;
        Insert: Partial<LiveVoteRow> & Pick<LiveVoteRow, 'matchup_key' | 'voter_id' | 'username'>;
        Update: Partial<LiveVoteRow>;
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
    Functions: {
      live_vote_results: {
        Args: { p_matchup_key: string };
        Returns: Array<{
          row_id: string;
          vote_count: number;
          votes_a: number;
          votes_b: number;
          ties: number;
          average_a: number;
          distribution: Record<LiveVoteChoice, number>;
        }>;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
