export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json
          path: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          path?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      coach_team_assignments: {
        Row: {
          active: boolean
          coach_id: string
          created_at: string
          end_date: string | null
          id: string
          role: string | null
          season: string | null
          start_date: string | null
          team_id: string
        }
        Insert: {
          active?: boolean
          coach_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          role?: string | null
          season?: string | null
          start_date?: string | null
          team_id: string
        }
        Update: {
          active?: boolean
          coach_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          role?: string | null
          season?: string | null
          start_date?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_team_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_team_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          requested_role: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          requested_role?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          requested_role?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_team_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_team_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          active: boolean
          city: string | null
          country: string | null
          created_at: string
          current_team_id: string | null
          external_id: string | null
          id: string
          last_synced_at: string | null
          name: string
          photo_url: string | null
          source: string | null
          source_id: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          current_team_id?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          photo_url?: string | null
          source?: string | null
          source_id?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          current_team_id?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          photo_url?: string | null
          source?: string | null
          source_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "directory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      copyright_report_rate_limits: {
        Row: {
          key_hash: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          key_hash: string
          request_count?: number
          window_started_at?: string
        }
        Update: {
          key_hash?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      copyright_reports: {
        Row: {
          accuracy_statement: string
          admin_notes: string | null
          claimant_address: string | null
          claimant_email: string
          claimant_name: string
          claimant_phone: string | null
          copyrighted_work_description: string
          counter_notice_basis: string | null
          counter_notice_statement: string | null
          created_at: string
          electronic_signature: string
          good_faith_statement: string
          id: string
          infringement_description: string
          infringing_content_url: string
          original_work_url: string | null
          report_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accuracy_statement: string
          admin_notes?: string | null
          claimant_address?: string | null
          claimant_email: string
          claimant_name: string
          claimant_phone?: string | null
          copyrighted_work_description: string
          counter_notice_basis?: string | null
          counter_notice_statement?: string | null
          created_at?: string
          electronic_signature: string
          good_faith_statement: string
          id?: string
          infringement_description: string
          infringing_content_url: string
          original_work_url?: string | null
          report_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accuracy_statement?: string
          admin_notes?: string | null
          claimant_address?: string | null
          claimant_email?: string
          claimant_name?: string
          claimant_phone?: string | null
          copyrighted_work_description?: string
          counter_notice_basis?: string | null
          counter_notice_statement?: string | null
          created_at?: string
          electronic_signature?: string
          good_faith_statement?: string
          id?: string
          infringement_description?: string
          infringing_content_url?: string
          original_work_url?: string | null
          report_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      directory_change_log: {
        Row: {
          action: string
          changed_at: string
          entity_id: string
          entity_type: string
          id: string
          source_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          entity_id: string
          entity_type: string
          id?: string
          source_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_change_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "directory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_import_jobs: {
        Row: {
          created_at: string
          error_rows: number
          file_name: string | null
          id: string
          imported_by: string
          inserted_rows: number
          kind: string
          skipped_rows: number
          total_rows: number
          updated_rows: number
        }
        Insert: {
          created_at?: string
          error_rows?: number
          file_name?: string | null
          id?: string
          imported_by: string
          inserted_rows?: number
          kind: string
          skipped_rows?: number
          total_rows?: number
          updated_rows?: number
        }
        Update: {
          created_at?: string
          error_rows?: number
          file_name?: string | null
          id?: string
          imported_by?: string
          inserted_rows?: number
          kind?: string
          skipped_rows?: number
          total_rows?: number
          updated_rows?: number
        }
        Relationships: []
      }
      directory_sources: {
        Row: {
          active: boolean
          attribution_required: boolean
          base_url: string | null
          commercial_use_allowed: boolean
          connector_key: string | null
          created_at: string
          documentation_url: string | null
          id: string
          license_evidence: string | null
          license_notes: string | null
          license_status: string
          name: string
          redistribution_allowed: boolean
          terms_url: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          active?: boolean
          attribution_required?: boolean
          base_url?: string | null
          commercial_use_allowed?: boolean
          connector_key?: string | null
          created_at?: string
          documentation_url?: string | null
          id?: string
          license_evidence?: string | null
          license_notes?: string | null
          license_status?: string
          name: string
          redistribution_allowed?: boolean
          terms_url?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          active?: boolean
          attribution_required?: boolean
          base_url?: string | null
          commercial_use_allowed?: boolean
          connector_key?: string | null
          created_at?: string
          documentation_url?: string | null
          id?: string
          license_evidence?: string | null
          license_notes?: string | null
          license_status?: string
          name?: string
          redistribution_allowed?: boolean
          terms_url?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      directory_sync_previews: {
        Row: {
          approved_at: string | null
          create_count: number
          created_at: string
          created_by: string
          entity_type: string
          expires_at: string
          id: string
          normalized_data: Json
          skip_count: number
          source_id: string
          status: string
          total_rows: number
          update_count: number
        }
        Insert: {
          approved_at?: string | null
          create_count?: number
          created_at?: string
          created_by: string
          entity_type: string
          expires_at?: string
          id?: string
          normalized_data: Json
          skip_count?: number
          source_id: string
          status?: string
          total_rows?: number
          update_count?: number
        }
        Update: {
          approved_at?: string | null
          create_count?: number
          created_at?: string
          created_by?: string
          entity_type?: string
          expires_at?: string
          id?: string
          normalized_data?: Json
          skip_count?: number
          source_id?: string
          status?: string
          total_rows?: number
          update_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "directory_sync_previews_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "directory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_sync_runs: {
        Row: {
          entity_type: string
          error_message: string | null
          finished_at: string | null
          id: string
          records_created: number
          records_seen: number
          records_skipped: number
          records_updated: number
          source_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          entity_type: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          records_created?: number
          records_seen?: number
          records_skipped?: number
          records_updated?: number
          source_id?: string | null
          started_at?: string
          status: string
        }
        Update: {
          entity_type?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          records_created?: number
          records_seen?: number
          records_skipped?: number
          records_updated?: number
          source_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "directory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_team_requests: {
        Row: {
          city: string | null
          country: string
          created_at: string
          id: string
          league_name: string | null
          note: string | null
          requester_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          team_name: string
        }
        Insert: {
          city?: string | null
          country: string
          created_at?: string
          id?: string
          league_name?: string | null
          note?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          team_name: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          league_name?: string | null
          note?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_team_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      display_name_changes: {
        Row: {
          changed_at: string
          id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_name_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_live_chat_messages: {
        Row: {
          body: string
          created_at: string
          game_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          game_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          game_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_live_chat_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "fan_live_games"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_live_game_reminders: {
        Row: {
          created_at: string
          game_id: string
          id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_live_game_reminders_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "fan_live_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_live_game_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_live_games: {
        Row: {
          away_score: number | null
          country: string | null
          created_at: string
          ends_at: string | null
          home_score: number | null
          id: string
          league_id: string | null
          league_name: string | null
          opponent_name: string
          opponent_team_id: string | null
          period_label: string | null
          provider_game_id: string | null
          provider_source: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          team_id: string
        }
        Insert: {
          away_score?: number | null
          country?: string | null
          created_at?: string
          ends_at?: string | null
          home_score?: number | null
          id?: string
          league_id?: string | null
          league_name?: string | null
          opponent_name: string
          opponent_team_id?: string | null
          period_label?: string | null
          provider_game_id?: string | null
          provider_source?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          team_id: string
        }
        Update: {
          away_score?: number | null
          country?: string | null
          created_at?: string
          ends_at?: string | null
          home_score?: number | null
          id?: string
          league_id?: string | null
          league_name?: string | null
          opponent_name?: string
          opponent_team_id?: string | null
          period_label?: string | null
          provider_game_id?: string | null
          provider_source?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_live_games_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_live_games_opponent_team_id_fkey"
            columns: ["opponent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_live_games_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_live_team_provider_map: {
        Row: {
          active: boolean
          created_at: string
          provider_team_id: number
          provider_team_name: string | null
          team_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          provider_team_id: number
          provider_team_name?: string | null
          team_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          provider_team_id?: number
          provider_team_name?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_live_team_provider_map_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_checks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_checks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_post_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          expires_at: string | null
          id: string
          image_url: string | null
          location_country: string | null
          status: string
          topic_tag: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location_country?: string | null
          status?: string
          topic_tag?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location_country?: string | null
          status?: string
          topic_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_relationships: {
        Row: {
          created_at: string
          follower_id: string
          id: string
          notify_ratings: boolean
          notify_reviews: boolean
          notify_updates: boolean
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          id?: string
          notify_ratings?: boolean
          notify_reviews?: boolean
          notify_updates?: boolean
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          id?: string
          notify_ratings?: boolean
          notify_reviews?: boolean
          notify_updates?: boolean
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_relationships_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          status: string
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_rights_registry: {
        Row: {
          approved_for_production: boolean
          attribution_required: boolean
          commercial_use_allowed: boolean
          contract_reference: string | null
          country: string
          country_code: string | null
          created_at: string
          data_source_name: string | null
          data_source_url: string | null
          evidence_notes: string | null
          evidence_url: string | null
          expires_at: string | null
          federation_name: string | null
          federation_website: string | null
          fiba_region: string | null
          id: string
          league_gender: string | null
          league_level: string | null
          league_name: string
          notes: string | null
          official_website: string | null
          redistribution_allowed: boolean
          rights_status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          approved_for_production?: boolean
          attribution_required?: boolean
          commercial_use_allowed?: boolean
          contract_reference?: string | null
          country: string
          country_code?: string | null
          created_at?: string
          data_source_name?: string | null
          data_source_url?: string | null
          evidence_notes?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          federation_name?: string | null
          federation_website?: string | null
          fiba_region?: string | null
          id?: string
          league_gender?: string | null
          league_level?: string | null
          league_name: string
          notes?: string | null
          official_website?: string | null
          redistribution_allowed?: boolean
          rights_status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          approved_for_production?: boolean
          attribution_required?: boolean
          commercial_use_allowed?: boolean
          contract_reference?: string | null
          country?: string
          country_code?: string | null
          created_at?: string
          data_source_name?: string | null
          data_source_url?: string | null
          evidence_notes?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          federation_name?: string | null
          federation_website?: string | null
          fiba_region?: string | null
          id?: string
          league_gender?: string | null
          league_level?: string | null
          league_name?: string
          notes?: string | null
          official_website?: string | null
          redistribution_allowed?: boolean
          rights_status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      leagues: {
        Row: {
          active: boolean
          basketball_type: string
          country: string | null
          created_at: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          level: string | null
          logo_url: string | null
          name: string
          season: string | null
          source: string | null
          source_id: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          basketball_type?: string
          country?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          level?: string | null
          logo_url?: string | null
          name: string
          season?: string | null
          source?: string | null
          source_id?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          basketball_type?: string
          country?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          level?: string | null
          logo_url?: string | null
          name?: string
          season?: string | null
          source?: string | null
          source_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leagues_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "directory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_risk_flags: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          matched_term: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          risk_type: string
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          matched_term?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          risk_type: string
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          matched_term?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          risk_type?: string
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          notification_type: string
          read_at: string | null
          target_id: string
          target_type: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          notification_type: string
          read_at?: string | null
          target_id: string
          target_type: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          notification_type?: string
          read_at?: string | null
          target_id?: string
          target_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      player_contact_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_contact_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "player_contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_contact_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_contact_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          player_id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          player_id: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          player_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_contact_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_contact_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_team_affiliations: {
        Row: {
          created_at: string
          end_date: string | null
          evidence_url: string | null
          id: string
          relationship: string
          start_date: string | null
          team_id: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          evidence_url?: string | null
          id?: string
          relationship: string
          start_date?: string | null
          team_id: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          end_date?: string | null
          evidence_url?: string | null
          id?: string
          relationship?: string
          start_date?: string | null
          team_id?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "player_team_affiliations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_verification_requests: {
        Row: {
          created_at: string
          current_country: string | null
          current_team: string | null
          document_path: string | null
          document_type: string | null
          document_uploaded_at: string | null
          evidence_url: string | null
          id: string
          league: string | null
          note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          team_id: string | null
          user_id: string
          womens_team_id: string | null
        }
        Insert: {
          created_at?: string
          current_country?: string | null
          current_team?: string | null
          document_path?: string | null
          document_type?: string | null
          document_uploaded_at?: string | null
          evidence_url?: string | null
          id?: string
          league?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          team_id?: string | null
          user_id: string
          womens_team_id?: string | null
        }
        Update: {
          created_at?: string
          current_country?: string | null
          current_team?: string | null
          document_path?: string | null
          document_type?: string | null
          document_uploaded_at?: string | null
          evidence_url?: string | null
          id?: string
          league?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          team_id?: string | null
          user_id?: string
          womens_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_verification_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_verification_requests_womens_team_id_fkey"
            columns: ["womens_team_id"]
            isOneToOne: false
            referencedRelation: "womens_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_request_events: {
        Row: {
          actor_id: string | null
          admin_notes_changed: boolean
          created_at: string
          event_type: string
          id: string
          new_assigned_to: string | null
          new_status: string | null
          old_assigned_to: string | null
          old_status: string | null
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          admin_notes_changed?: boolean
          created_at?: string
          event_type: string
          id?: string
          new_assigned_to?: string | null
          new_status?: string | null
          old_assigned_to?: string | null
          old_status?: string | null
          request_id: string
        }
        Update: {
          actor_id?: string | null
          admin_notes_changed?: boolean
          created_at?: string
          event_type?: string
          id?: string
          new_assigned_to?: string | null
          new_status?: string | null
          old_assigned_to?: string | null
          old_status?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "privacy_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          details: string
          id: string
          request_type: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          details: string
          id?: string
          request_type: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          details?: string
          id?: string
          request_type?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_reports: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          agreed_to_terms: boolean | null
          avatar_moderation_note: string | null
          avatar_moderation_status: string
          avatar_url: string | null
          basketball_type: string
          bio: string | null
          birthdate: string | null
          claimed_at: string | null
          coach_profile_id: string | null
          coach_verified: boolean
          coach_verified_at: string | null
          country: string | null
          created_at: string
          current_country: string | null
          current_team: string | null
          display_name: string | null
          display_name_changed_at: string | null
          experience_goal: string | null
          experience_summary: string | null
          favorite_leagues: string | null
          favorite_teams: string | null
          first_name: string | null
          free_agent: boolean
          gender: string | null
          hometown: string | null
          id: string
          identity_verification_status: string
          interests: string | null
          is_adult: boolean | null
          last_name: string | null
          last_seen_at: string | null
          moderation_note: string | null
          moderation_status: string
          moderation_updated_at: string | null
          moderation_updated_by: string | null
          nationality: string | null
          player_verified: boolean
          player_verified_at: string | null
          position: string | null
          professional_experience: boolean
          profile_claimed: boolean
          profile_visibility: string
          research_preferences: string | null
          selected_team_id: string | null
          selected_team_verified: boolean
          selected_womens_team_id: string | null
          stripe_identity_verification_session_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          username: string | null
          years_pro: number | null
        }
        Insert: {
          account_type?: string
          agreed_to_terms?: boolean | null
          avatar_moderation_note?: string | null
          avatar_moderation_status?: string
          avatar_url?: string | null
          basketball_type?: string
          bio?: string | null
          birthdate?: string | null
          claimed_at?: string | null
          coach_profile_id?: string | null
          coach_verified?: boolean
          coach_verified_at?: string | null
          country?: string | null
          created_at?: string
          current_country?: string | null
          current_team?: string | null
          display_name?: string | null
          display_name_changed_at?: string | null
          experience_goal?: string | null
          experience_summary?: string | null
          favorite_leagues?: string | null
          favorite_teams?: string | null
          first_name?: string | null
          free_agent?: boolean
          gender?: string | null
          hometown?: string | null
          id: string
          identity_verification_status?: string
          interests?: string | null
          is_adult?: boolean | null
          last_name?: string | null
          last_seen_at?: string | null
          moderation_note?: string | null
          moderation_status?: string
          moderation_updated_at?: string | null
          moderation_updated_by?: string | null
          nationality?: string | null
          player_verified?: boolean
          player_verified_at?: string | null
          position?: string | null
          professional_experience?: boolean
          profile_claimed?: boolean
          profile_visibility?: string
          research_preferences?: string | null
          selected_team_id?: string | null
          selected_team_verified?: boolean
          selected_womens_team_id?: string | null
          stripe_identity_verification_session_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          username?: string | null
          years_pro?: number | null
        }
        Update: {
          account_type?: string
          agreed_to_terms?: boolean | null
          avatar_moderation_note?: string | null
          avatar_moderation_status?: string
          avatar_url?: string | null
          basketball_type?: string
          bio?: string | null
          birthdate?: string | null
          claimed_at?: string | null
          coach_profile_id?: string | null
          coach_verified?: boolean
          coach_verified_at?: string | null
          country?: string | null
          created_at?: string
          current_country?: string | null
          current_team?: string | null
          display_name?: string | null
          display_name_changed_at?: string | null
          experience_goal?: string | null
          experience_summary?: string | null
          favorite_leagues?: string | null
          favorite_teams?: string | null
          first_name?: string | null
          free_agent?: boolean
          gender?: string | null
          hometown?: string | null
          id?: string
          identity_verification_status?: string
          interests?: string | null
          is_adult?: boolean | null
          last_name?: string | null
          last_seen_at?: string | null
          moderation_note?: string | null
          moderation_status?: string
          moderation_updated_at?: string | null
          moderation_updated_by?: string | null
          nationality?: string | null
          player_verified?: boolean
          player_verified_at?: string | null
          position?: string | null
          professional_experience?: boolean
          profile_claimed?: boolean
          profile_visibility?: string
          research_preferences?: string | null
          selected_team_id?: string | null
          selected_team_verified?: boolean
          selected_womens_team_id?: string | null
          stripe_identity_verification_session_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          username?: string | null
          years_pro?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_selected_team_id_fkey"
            columns: ["selected_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_selected_womens_team_id_fkey"
            columns: ["selected_womens_team_id"]
            isOneToOne: false
            referencedRelation: "womens_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          review_id: string
          status: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          review_id: string
          status?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_moderation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_type: string
          from_status: string | null
          id: string
          report_id: string | null
          review_id: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_type: string
          from_status?: string | null
          id?: string
          report_id?: string | null
          review_id?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_type?: string
          from_status?: string | null
          id?: string
          report_id?: string | null
          review_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_moderation_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "review_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_moderation_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          review_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          review_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_submission_rate_limits: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          body: string
          coach_id: string | null
          communication_rating: number | null
          created_at: string
          development_rating: number | null
          id: string
          is_anonymous: boolean
          league_id: string | null
          legal_review_required: boolean
          overall_rating: number
          payment_rating: number | null
          player_season: string | null
          professionalism_rating: number | null
          status: string
          team_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          coach_id?: string | null
          communication_rating?: number | null
          created_at?: string
          development_rating?: number | null
          id?: string
          is_anonymous?: boolean
          league_id?: string | null
          legal_review_required?: boolean
          overall_rating: number
          payment_rating?: number | null
          player_season?: string | null
          professionalism_rating?: number | null
          status?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          coach_id?: string | null
          communication_rating?: number | null
          created_at?: string
          development_rating?: number | null
          id?: string
          is_anonymous?: boolean
          league_id?: string | null
          legal_review_required?: boolean
          overall_rating?: number
          payment_rating?: number | null
          player_season?: string | null
          professionalism_rating?: number | null
          status?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_registry: {
        Row: {
          approved_by: string | null
          commercial_approved_at: string | null
          commercial_use_allowed: boolean | null
          country: string
          country_code: string | null
          created_at: string
          data_owner: string | null
          evidence_note: string | null
          evidence_url: string | null
          id: string
          last_verified_at: string | null
          league_name: string
          league_short_name: string | null
          license_path: string | null
          license_requested_at: string | null
          license_verified_at: string | null
          notes: string | null
          production_approved: boolean
          production_approved_at: string | null
          redistribution_allowed: boolean | null
          redistribution_approved_at: string | null
          research_lead: string | null
          research_status: string
          updated_at: string
          workflow_note: string | null
          workflow_status: string
        }
        Insert: {
          approved_by?: string | null
          commercial_approved_at?: string | null
          commercial_use_allowed?: boolean | null
          country: string
          country_code?: string | null
          created_at?: string
          data_owner?: string | null
          evidence_note?: string | null
          evidence_url?: string | null
          id?: string
          last_verified_at?: string | null
          league_name: string
          league_short_name?: string | null
          license_path?: string | null
          license_requested_at?: string | null
          license_verified_at?: string | null
          notes?: string | null
          production_approved?: boolean
          production_approved_at?: string | null
          redistribution_allowed?: boolean | null
          redistribution_approved_at?: string | null
          research_lead?: string | null
          research_status?: string
          updated_at?: string
          workflow_note?: string | null
          workflow_status?: string
        }
        Update: {
          approved_by?: string | null
          commercial_approved_at?: string | null
          commercial_use_allowed?: boolean | null
          country?: string
          country_code?: string | null
          created_at?: string
          data_owner?: string | null
          evidence_note?: string | null
          evidence_url?: string | null
          id?: string
          last_verified_at?: string | null
          league_name?: string
          league_short_name?: string | null
          license_path?: string | null
          license_requested_at?: string | null
          license_verified_at?: string | null
          notes?: string | null
          production_approved?: boolean
          production_approved_at?: string | null
          redistribution_allowed?: boolean | null
          redistribution_approved_at?: string | null
          research_lead?: string | null
          research_status?: string
          updated_at?: string
          workflow_note?: string | null
          workflow_status?: string
        }
        Relationships: []
      }
      rights_registry_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          rights_registry_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          rights_registry_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          rights_registry_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rights_registry_events_rights_registry_id_fkey"
            columns: ["rights_registry_id"]
            isOneToOne: false
            referencedRelation: "rights_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_inquiries: {
        Row: {
          created_at: string
          id: string
          message: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_event_claims: {
        Row: {
          claim_token: string | null
          created_at: string
          event_type: string
          last_error: string | null
          lease_expires_at: string | null
          status: string
          stripe_event_id: string
          updated_at: string
        }
        Insert: {
          claim_token?: string | null
          created_at?: string
          event_type: string
          last_error?: string | null
          lease_expires_at?: string | null
          status?: string
          stripe_event_id: string
          updated_at?: string
        }
        Update: {
          claim_token?: string | null
          created_at?: string
          event_type?: string
          last_error?: string | null
          lease_expires_at?: string | null
          status?: string
          stripe_event_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          access_status: string
          billing_interval: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_status?: string
          billing_interval?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_status?: string
          billing_interval?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          body: string
          created_at: string
          id: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          requester_id: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          requester_id: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          requester_id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_league_memberships: {
        Row: {
          active: boolean
          created_at: string
          end_date: string | null
          id: string
          league_id: string
          season: string | null
          start_date: string | null
          team_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          league_id: string
          season?: string | null
          start_date?: string | null
          team_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          league_id?: string
          season?: string | null
          start_date?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_league_memberships_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_league_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          basketball_type: string
          city: string | null
          country: string | null
          created_at: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          league_id: string | null
          league_name: string | null
          logo_url: string | null
          name: string
          source: string | null
          source_id: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          basketball_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          league_id?: string | null
          league_name?: string | null
          logo_url?: string | null
          name: string
          source?: string | null
          source_id?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          basketball_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          league_id?: string | null
          league_name?: string | null
          logo_url?: string | null
          name?: string
          source?: string | null
          source_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "directory_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          language: string
          notifications_enabled: boolean
          reduced_motion: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          language?: string
          notifications_enabled?: boolean
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          language?: string
          notifications_enabled?: boolean
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_watchlists: {
        Row: {
          alert_ratings: boolean
          alert_reviews: boolean
          alert_updates: boolean
          created_at: string
          follow: boolean
          id: string
          notify: boolean
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          alert_ratings?: boolean
          alert_reviews?: boolean
          alert_updates?: boolean
          created_at?: string
          follow?: boolean
          id?: string
          notify?: boolean
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          alert_ratings?: boolean
          alert_reviews?: boolean
          alert_updates?: boolean
          created_at?: string
          follow?: boolean
          id?: string
          notify?: boolean
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      womens_leagues: {
        Row: {
          active: boolean
          country: string | null
          created_at: string
          id: string
          level: string | null
          name: string
        }
        Insert: {
          active?: boolean
          country?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
        }
        Update: {
          active?: boolean
          country?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
        }
        Relationships: []
      }
      womens_team_reviews: {
        Row: {
          author_id: string
          body: string
          communication_rating: number | null
          created_at: string
          development_rating: number | null
          id: string
          is_anonymous: boolean
          overall_rating: number
          payment_rating: number | null
          professionalism_rating: number | null
          status: string
          title: string | null
          womens_team_id: string
        }
        Insert: {
          author_id: string
          body: string
          communication_rating?: number | null
          created_at?: string
          development_rating?: number | null
          id?: string
          is_anonymous?: boolean
          overall_rating: number
          payment_rating?: number | null
          professionalism_rating?: number | null
          status?: string
          title?: string | null
          womens_team_id: string
        }
        Update: {
          author_id?: string
          body?: string
          communication_rating?: number | null
          created_at?: string
          development_rating?: number | null
          id?: string
          is_anonymous?: boolean
          overall_rating?: number
          payment_rating?: number | null
          professionalism_rating?: number | null
          status?: string
          title?: string | null
          womens_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "womens_team_reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "womens_team_reviews_womens_team_id_fkey"
            columns: ["womens_team_id"]
            isOneToOne: false
            referencedRelation: "womens_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      womens_teams: {
        Row: {
          active: boolean
          city: string | null
          country: string | null
          created_at: string
          id: string
          league_id: string | null
          league_name: string | null
          name: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          league_id?: string | null
          league_name?: string | null
          name: string
        }
        Update: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          league_id?: string | null
          league_name?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "womens_teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "womens_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_directory_entry: {
        Args: { p_id: string; p_type: string }
        Returns: boolean
      }
      admin_list_user_roles: {
        Args: { p_query?: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
          username: string
        }[]
      }
      admin_list_users: {
        Args: { p_account_type?: string; p_query?: string }
        Returns: {
          account_type: string
          avatar_moderation_status: string
          avatar_url: string
          bio: string
          created_at: string
          current_country: string
          current_team: string
          display_name: string
          email: string
          favorite_leagues: string
          free_agent: boolean
          id: string
          interests: string
          moderation_note: string
          moderation_status: string
          player_verified: boolean
          profile_visibility: string
          username: string
        }[]
      }
      admin_moderate_profile: {
        Args: { p_note?: string; p_profile_id: string; p_status: string }
        Returns: Json
      }
      admin_moderate_review_comment: {
        Args: { p_comment_id: string; p_status: string }
        Returns: Json
      }
      admin_resolve_profile_report: {
        Args: { p_report_id: string; p_status: string }
        Returns: Json
      }
      admin_review_coach_team_request: {
        Args: { p_note?: string; p_request_id: string; p_status: string }
        Returns: boolean
      }
      admin_review_directory_team_request: {
        Args: { p_note?: string; p_request_id: string; p_status: string }
        Returns: boolean
      }
      admin_set_membership: {
        Args: { p_plan: string; p_user_id: string }
        Returns: boolean
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: string
      }
      admin_update_profile: {
        Args: {
          p_account_type?: string
          p_avatar_moderation_note?: string
          p_avatar_moderation_status?: string
          p_bio?: string
          p_current_country?: string
          p_current_team?: string
          p_display_name?: string
          p_favorite_leagues?: string
          p_free_agent?: boolean
          p_interests?: string
          p_moderation_note?: string
          p_moderation_status?: string
          p_player_verified?: boolean
          p_profile_id: string
          p_profile_visibility?: string
        }
        Returns: Json
      }
      admin_update_support_ticket: {
        Args: { p_status: string; p_ticket_id: string }
        Returns: boolean
      }
      can_user_follow_target: {
        Args: { p_target_id: string; p_target_type: string; p_user_id: string }
        Returns: boolean
      }
      can_user_review_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_player_feed_post: {
        Args: { p_author_id: string }
        Returns: boolean
      }
      claim_review_submission_slot: { Args: never; Returns: number }
      claim_stripe_webhook_event: {
        Args: { p_event_type: string; p_stripe_event_id: string }
        Returns: Json
      }
      complete_stripe_webhook_event: {
        Args: {
          p_claim_token: string
          p_event_type: string
          p_payload: Json
          p_stripe_event_id: string
        }
        Returns: undefined
      }
      consume_copyright_report_rate_limit: {
        Args: { p_key_hash: string }
        Returns: boolean
      }
      get_current_user_admin_role: { Args: never; Returns: string }
      get_follow_count: {
        Args: { p_target_id: string; p_target_type: string }
        Returns: number
      }
      get_hoopcheck_kpis: { Args: never; Returns: Json }
      get_public_player_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          country: string
          current_country: string
          current_team: string
          display_name: string
          id: string
          player_position: string
          player_verified: boolean
          player_verified_at: string
          years_pro: number
        }[]
      }
      get_public_review_summary: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          communication_rating: number
          development_rating: number
          overall_rating: number
          payment_rating: number
          professionalism_rating: number
          review_count: number
        }[]
      }
      get_review_like_count: { Args: { p_review_id: string }; Returns: number }
      get_review_summary: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          communication_rating: number
          development_rating: number
          overall_rating: number
          payment_rating: number
          professionalism_rating: number
          review_count: number
        }[]
      }
      get_review_verification: {
        Args: { p_review_ids: string[] }
        Returns: {
          player_verified: boolean
          review_id: string
        }[]
      }
      get_womens_review_rating_summary: {
        Args: { p_team_id: string }
        Returns: {
          overall_rating: number
          review_count: number
        }[]
      }
      import_full_directory: {
        Args: { p_file_name: string; p_rows: Json }
        Returns: Json
      }
      is_current_user_admin_or_moderator: { Args: never; Returns: boolean }
      moderate_player_verification: {
        Args: {
          p_request_id: string
          p_reviewer_note?: string
          p_status: string
        }
        Returns: {
          created_at: string
          current_country: string | null
          current_team: string | null
          document_path: string | null
          document_type: string | null
          document_uploaded_at: string | null
          evidence_url: string | null
          id: string
          league: string | null
          note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          team_id: string | null
          user_id: string
          womens_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "player_verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_review_submission_slot: {
        Args: { p_slot_id: number; p_user_id: string }
        Returns: boolean
      }
      release_stripe_webhook_event: {
        Args: {
          p_claim_token: string
          p_error: string
          p_stripe_event_id: string
        }
        Returns: undefined
      }
      search_public_players: {
        Args: {
          p_country?: string
          p_limit?: number
          p_position?: string
          p_query?: string
          p_verified_only?: boolean
        }
        Returns: {
          avatar_url: string
          bio: string
          country: string
          current_country: string
          current_team: string
          display_name: string
          id: string
          player_position: string
          player_verified: boolean
          player_verified_at: string
          years_pro: number
        }[]
      }
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
