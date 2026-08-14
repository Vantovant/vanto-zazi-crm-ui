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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_campaign_recipients: {
        Row: {
          activation_date: string | null
          activity_month: string | null
          amount: number | null
          attempts: number
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          email: string | null
          error: string | null
          first_name: string | null
          hub_decision: Json | null
          id: string
          last_attempt_at: string | null
          member_id: string | null
          name: string | null
          order_id: string | null
          pack_type: string | null
          phone_normalized: string
          provider_message_id: string | null
          read_at: string | null
          replied_at: string | null
          reply_preview: string | null
          sent_at: string | null
          sponsor_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_date?: string | null
          activity_month?: string | null
          amount?: number | null
          attempts?: number
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          error?: string | null
          first_name?: string | null
          hub_decision?: Json | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string | null
          name?: string | null
          order_id?: string | null
          pack_type?: string | null
          phone_normalized: string
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          reply_preview?: string | null
          sent_at?: string | null
          sponsor_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_date?: string | null
          activity_month?: string | null
          amount?: number | null
          attempts?: number
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          error?: string | null
          first_name?: string | null
          hub_decision?: Json | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string | null
          name?: string | null
          order_id?: string | null
          pack_type?: string | null
          phone_normalized?: string
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          reply_preview?: string | null
          sent_at?: string | null
          sponsor_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_campaign_recipients_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_goals: {
        Row: {
          created_at: string
          daily_call_goal: number
          daily_email_goal: number
          daily_whatsapp_goal: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_call_goal?: number
          daily_email_goal?: number
          daily_whatsapp_goal?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_call_goal?: number
          daily_email_goal?: number
          daily_whatsapp_goal?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_action_log: {
        Row: {
          auto_detected_success: boolean | null
          contact_id: string | null
          created_at: string
          executed_action: string
          final_success: boolean | null
          id: string
          manual_mark_success: boolean | null
          pattern_source: string | null
          recommended_action: string
          success_score: number | null
          success_source: string | null
          user_id: string
        }
        Insert: {
          auto_detected_success?: boolean | null
          contact_id?: string | null
          created_at?: string
          executed_action?: string
          final_success?: boolean | null
          id?: string
          manual_mark_success?: boolean | null
          pattern_source?: string | null
          recommended_action?: string
          success_score?: number | null
          success_source?: string | null
          user_id: string
        }
        Update: {
          auto_detected_success?: boolean | null
          contact_id?: string | null
          created_at?: string
          executed_action?: string
          final_success?: boolean | null
          id?: string
          manual_mark_success?: boolean | null
          pattern_source?: string | null
          recommended_action?: string
          success_score?: number | null
          success_source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_team_patterns: {
        Row: {
          action_type: string
          created_at: string
          id: string
          lifecycle_stage: string
          sample_count: number | null
          success_rate: number | null
          timing_pattern: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          lifecycle_stage: string
          sample_count?: number | null
          success_rate?: number | null
          timing_pattern?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          lifecycle_stage?: string
          sample_count?: number | null
          success_rate?: number | null
          timing_pattern?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auto_send_shadow_log: {
        Row: {
          block_reason: string
          contact_id: string | null
          contact_name: string
          created_at: string
          cycle_key: string
          dedupe_key: string
          eligibility: string
          entry_key: string
          gates: Json
          id: string
          lane: string
          message_style: string
          user_id: string
          would_send_at: string
        }
        Insert: {
          block_reason?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          cycle_key?: string
          dedupe_key: string
          eligibility: string
          entry_key?: string
          gates?: Json
          id?: string
          lane: string
          message_style?: string
          user_id: string
          would_send_at?: string
        }
        Update: {
          block_reason?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          cycle_key?: string
          dedupe_key?: string
          eligibility?: string
          entry_key?: string
          gates?: Json
          id?: string
          lane?: string
          message_style?: string
          user_id?: string
          would_send_at?: string
        }
        Relationships: []
      }
      birthday_campaign_recipients: {
        Row: {
          attempts: number
          birth_date: string | null
          congratulate_by_date: string | null
          contact_id: string | null
          created_at: string
          cycle_year: number
          delivered_at: string | null
          email: string | null
          error: string | null
          first_name: string | null
          hub_decision: Json | null
          id: string
          last_attempt_at: string | null
          member_id: string | null
          name: string | null
          phone_normalized: string
          provider_message_id: string | null
          read_at: string | null
          replied_at: string | null
          reply_preview: string | null
          sent_at: string | null
          status: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          birth_date?: string | null
          congratulate_by_date?: string | null
          contact_id?: string | null
          created_at?: string
          cycle_year: number
          delivered_at?: string | null
          email?: string | null
          error?: string | null
          first_name?: string | null
          hub_decision?: Json | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string | null
          name?: string | null
          phone_normalized: string
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          reply_preview?: string | null
          sent_at?: string | null
          status?: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          birth_date?: string | null
          congratulate_by_date?: string | null
          contact_id?: string | null
          created_at?: string
          cycle_year?: number
          delivered_at?: string | null
          email?: string | null
          error?: string | null
          first_name?: string | null
          hub_decision?: Json | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string | null
          name?: string | null
          phone_normalized?: string
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          reply_preview?: string | null
          sent_at?: string | null
          status?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_send_ledger: {
        Row: {
          campaign_key: string
          contact_id: string | null
          created_at: string
          cycle_key: string
          dedupe_key: string
          id: string
          maytapi_message_id: string | null
          phone_normalized: string
          recipient_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          campaign_key: string
          contact_id?: string | null
          created_at?: string
          cycle_key: string
          dedupe_key: string
          id?: string
          maytapi_message_id?: string | null
          phone_normalized: string
          recipient_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          campaign_key?: string
          contact_id?: string | null
          created_at?: string
          cycle_key?: string
          dedupe_key?: string
          id?: string
          maytapi_message_id?: string | null
          phone_normalized?: string
          recipient_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_settings: {
        Row: {
          active_windows: string
          campaign_key: string
          daily_cap: number
          enabled: boolean
          per_tick_cap: number
          updated_at: string
        }
        Insert: {
          active_windows?: string
          campaign_key: string
          daily_cap?: number
          enabled?: boolean
          per_tick_cap?: number
          updated_at?: string
        }
        Update: {
          active_windows?: string
          campaign_key?: string
          daily_cap?: number
          enabled?: boolean
          per_tick_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string
          id: string
          next_action: string | null
          notes: string | null
          summary: string
          user_id: string
        }
        Insert: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          next_action?: string | null
          notes?: string | null
          summary?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          next_action?: string | null
          notes?: string | null
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_birthdays: {
        Row: {
          associate_id: string
          birth_date: string | null
          birth_date_text: string
          congratulate_by_date: string | null
          congratulated_at: string | null
          contact_id: string | null
          created_at: string
          cycle_year: number
          first_name: string
          full_name: string
          id: string
          import_batch_label: string | null
          import_range_end: string | null
          import_range_start: string | null
          level: string
          message_style: string
          original_congratulate_by_date: string | null
          pasted_phone: string
          status: string
          updated_at: string
          user_id: string
          when_to_congratulate: string
        }
        Insert: {
          associate_id?: string
          birth_date?: string | null
          birth_date_text?: string
          congratulate_by_date?: string | null
          congratulated_at?: string | null
          contact_id?: string | null
          created_at?: string
          cycle_year?: number
          first_name?: string
          full_name?: string
          id?: string
          import_batch_label?: string | null
          import_range_end?: string | null
          import_range_start?: string | null
          level?: string
          message_style?: string
          original_congratulate_by_date?: string | null
          pasted_phone?: string
          status?: string
          updated_at?: string
          user_id: string
          when_to_congratulate?: string
        }
        Update: {
          associate_id?: string
          birth_date?: string | null
          birth_date_text?: string
          congratulate_by_date?: string | null
          congratulated_at?: string | null
          contact_id?: string | null
          created_at?: string
          cycle_year?: number
          first_name?: string
          full_name?: string
          id?: string
          import_batch_label?: string | null
          import_range_end?: string | null
          import_range_start?: string | null
          level?: string
          message_style?: string
          original_congratulate_by_date?: string | null
          pasted_phone?: string
          status?: string
          updated_at?: string
          user_id?: string
          when_to_congratulate?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_birthdays_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_waiting_room: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          issue_note: string
          issue_type: string
          priority: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          issue_note?: string
          issue_type?: string
          priority?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          issue_note?: string
          issue_type?: string
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_waiting_room_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          action_taken: string
          additional_notes: string
          aplgo_id: string
          assigned_to: string
          associate_status: string
          auto_send_opt_out: boolean
          city: string
          communication_status: string
          country: string
          created_at: string
          date_captured: string
          email_address: string
          email_normalized: string | null
          focus_area: string
          full_name: string
          go_status: string
          id: string
          interest_level: string
          lead_path: string
          lead_temperature: string
          lead_type: string
          leg: string
          level: string
          meeting_time: string
          next_action: string
          parent_contact_id: string | null
          phone_normalized: string | null
          phone_number: string
          province: string
          registration_status: string
          salutation_title: string
          sponsor_name: string
          state: string
          tree_depth: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken?: string
          additional_notes?: string
          aplgo_id?: string
          assigned_to?: string
          associate_status?: string
          auto_send_opt_out?: boolean
          city?: string
          communication_status?: string
          country?: string
          created_at?: string
          date_captured?: string
          email_address?: string
          email_normalized?: string | null
          focus_area?: string
          full_name: string
          go_status?: string
          id?: string
          interest_level?: string
          lead_path?: string
          lead_temperature?: string
          lead_type?: string
          leg?: string
          level?: string
          meeting_time?: string
          next_action?: string
          parent_contact_id?: string | null
          phone_normalized?: string | null
          phone_number?: string
          province?: string
          registration_status?: string
          salutation_title?: string
          sponsor_name?: string
          state?: string
          tree_depth?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken?: string
          additional_notes?: string
          aplgo_id?: string
          assigned_to?: string
          associate_status?: string
          auto_send_opt_out?: boolean
          city?: string
          communication_status?: string
          country?: string
          created_at?: string
          date_captured?: string
          email_address?: string
          email_normalized?: string | null
          focus_area?: string
          full_name?: string
          go_status?: string
          id?: string
          interest_level?: string
          lead_path?: string
          lead_temperature?: string
          lead_type?: string
          leg?: string
          level?: string
          meeting_time?: string
          next_action?: string
          parent_contact_id?: string | null
          phone_normalized?: string | null
          phone_number?: string
          province?: string
          registration_status?: string
          salutation_title?: string
          sponsor_name?: string
          state?: string
          tree_depth?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follow_up_states: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          follow_up_attempts: number
          id: string
          last_inbound_at: string | null
          last_message_preview: string
          last_outbound_at: string | null
          recommended_action: string
          reply_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          contact_id: string
          created_at?: string
          follow_up_attempts?: number
          id?: string
          last_inbound_at?: string | null
          last_message_preview?: string
          last_outbound_at?: string | null
          recommended_action?: string
          reply_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          follow_up_attempts?: number
          id?: string
          last_inbound_at?: string | null
          last_message_preview?: string
          last_outbound_at?: string | null
          recommended_action?: string
          reply_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_states_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_contacts_oauth_state: {
        Row: {
          created_at: string
          expires_at: string
          redirect_after: string | null
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          redirect_after?: string | null
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          redirect_after?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      google_contacts_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          google_email: string | null
          last_sync_at: string | null
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          google_email?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          google_email?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_contacts_mirror: {
        Row: {
          consent_email: boolean | null
          consent_sms: boolean | null
          consent_whatsapp: boolean | null
          contact_type: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          hub_updated_at: string | null
          id: string
          is_deleted: boolean
          last_name: string | null
          lead_type: string | null
          notes: string | null
          phone_e164: string | null
          synced_at: string
          tags: string[] | null
          temperature: string | null
          version: number
          whatsapp_display_name: string | null
        }
        Insert: {
          consent_email?: boolean | null
          consent_sms?: boolean | null
          consent_whatsapp?: boolean | null
          contact_type?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hub_updated_at?: string | null
          id: string
          is_deleted?: boolean
          last_name?: string | null
          lead_type?: string | null
          notes?: string | null
          phone_e164?: string | null
          synced_at?: string
          tags?: string[] | null
          temperature?: string | null
          version?: number
          whatsapp_display_name?: string | null
        }
        Update: {
          consent_email?: boolean | null
          consent_sms?: boolean | null
          consent_whatsapp?: boolean | null
          contact_type?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hub_updated_at?: string | null
          id?: string
          is_deleted?: boolean
          last_name?: string | null
          lead_type?: string | null
          notes?: string | null
          phone_e164?: string | null
          synced_at?: string
          tags?: string[] | null
          temperature?: string | null
          version?: number
          whatsapp_display_name?: string | null
        }
        Relationships: []
      }
      import_audit: {
        Row: {
          action: string
          batch_id: string
          created_at: string
          file_name: string
          id: string
          incoming_aplgo_id: string
          incoming_email: string
          incoming_full_name: string
          incoming_phone: string
          match_method: string
          matched_contact_id: string | null
          reason: string
          sheet_row: number
          user_id: string
        }
        Insert: {
          action?: string
          batch_id: string
          created_at?: string
          file_name?: string
          id?: string
          incoming_aplgo_id?: string
          incoming_email?: string
          incoming_full_name?: string
          incoming_phone?: string
          match_method?: string
          matched_contact_id?: string | null
          reason?: string
          sheet_row: number
          user_id: string
        }
        Update: {
          action?: string
          batch_id?: string
          created_at?: string
          file_name?: string
          id?: string
          incoming_aplgo_id?: string
          incoming_email?: string
          incoming_full_name?: string
          incoming_phone?: string
          match_method?: string
          matched_contact_id?: string | null
          reason?: string
          sheet_row?: number
          user_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          auto_send_appreciation_enabled: boolean
          auto_send_birthdays_enabled: boolean
          auto_send_daily_cap: number
          auto_send_enabled: boolean
          auto_send_micro_live_contact_allowlist: string[]
          auto_send_micro_live_daily_cap: number
          auto_send_micro_live_enabled: boolean
          auto_send_quiet_end_hour: number
          auto_send_quiet_start_hour: number
          created_at: string
          daily_send_cap: number
          daily_token_cap: number
          maytapi_enabled: boolean
          maytapi_phone_allowlist: string[]
          prospector_can_auto_apply_low: boolean
          prospector_can_propose: boolean
          prospector_can_send_autonomous: boolean
          prospector_supervisor_required: boolean
          prospector_write_activity_on_send: boolean
          supervisor_block_threshold: number
          supervisor_leadership_fit_threshold: number
          supervisor_safety_threshold: number
          updated_at: string
          user_id: string
          zazi_prospector_enabled: boolean
        }
        Insert: {
          auto_send_appreciation_enabled?: boolean
          auto_send_birthdays_enabled?: boolean
          auto_send_daily_cap?: number
          auto_send_enabled?: boolean
          auto_send_micro_live_contact_allowlist?: string[]
          auto_send_micro_live_daily_cap?: number
          auto_send_micro_live_enabled?: boolean
          auto_send_quiet_end_hour?: number
          auto_send_quiet_start_hour?: number
          created_at?: string
          daily_send_cap?: number
          daily_token_cap?: number
          maytapi_enabled?: boolean
          maytapi_phone_allowlist?: string[]
          prospector_can_auto_apply_low?: boolean
          prospector_can_propose?: boolean
          prospector_can_send_autonomous?: boolean
          prospector_supervisor_required?: boolean
          prospector_write_activity_on_send?: boolean
          supervisor_block_threshold?: number
          supervisor_leadership_fit_threshold?: number
          supervisor_safety_threshold?: number
          updated_at?: string
          user_id: string
          zazi_prospector_enabled?: boolean
        }
        Update: {
          auto_send_appreciation_enabled?: boolean
          auto_send_birthdays_enabled?: boolean
          auto_send_daily_cap?: number
          auto_send_enabled?: boolean
          auto_send_micro_live_contact_allowlist?: string[]
          auto_send_micro_live_daily_cap?: number
          auto_send_micro_live_enabled?: boolean
          auto_send_quiet_end_hour?: number
          auto_send_quiet_start_hour?: number
          created_at?: string
          daily_send_cap?: number
          daily_token_cap?: number
          maytapi_enabled?: boolean
          maytapi_phone_allowlist?: string[]
          prospector_can_auto_apply_low?: boolean
          prospector_can_propose?: boolean
          prospector_can_send_autonomous?: boolean
          prospector_supervisor_required?: boolean
          prospector_write_activity_on_send?: boolean
          supervisor_block_threshold?: number
          supervisor_leadership_fit_threshold?: number
          supervisor_safety_threshold?: number
          updated_at?: string
          user_id?: string
          zazi_prospector_enabled?: boolean
        }
        Relationships: []
      }
      inventory: {
        Row: {
          created_at: string
          id: string
          product_name: string
          stock_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          stock_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          stock_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_used: boolean
          label: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_used?: boolean
          label?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_used?: boolean
          label?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      maytapi_gate_audit: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          gate_id: string | null
          id: string
          linked_contact_id: string | null
          metadata: Json
          phone_last4: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          gate_id?: string | null
          id?: string
          linked_contact_id?: string | null
          metadata?: Json
          phone_last4?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          gate_id?: string | null
          id?: string
          linked_contact_id?: string | null
          metadata?: Json
          phone_last4?: string | null
          user_id?: string
        }
        Relationships: []
      }
      maytapi_inbound_unmatched: {
        Row: {
          created_at: string
          first_seen_at: string
          id: string
          last_body_preview: string | null
          last_seen_at: string
          linked_at: string | null
          linked_by: string | null
          linked_contact_id: string | null
          message_count: number
          phone_hash: string
          phone_last4: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_seen_at?: string
          id?: string
          last_body_preview?: string | null
          last_seen_at?: string
          linked_at?: string | null
          linked_by?: string | null
          linked_contact_id?: string | null
          message_count?: number
          phone_hash: string
          phone_last4: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_seen_at?: string
          id?: string
          last_body_preview?: string | null
          last_seen_at?: string
          linked_at?: string | null
          linked_by?: string | null
          linked_contact_id?: string | null
          message_count?: number
          phone_hash?: string
          phone_last4?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maytapi_messages: {
        Row: {
          body: string | null
          body_preview: string | null
          contact_id: string | null
          conversation_key: string
          created_at: string
          direction: string
          id: string
          maytapi_message_id: string | null
          media_type: string | null
          media_url: string | null
          phone_e164: string | null
          phone_hash: string
          phone_last4: string | null
          raw: Json
          read_at: string | null
          read_by: string | null
          received_at: string
          status: string
          user_id: string
          zazi_action_id: string | null
        }
        Insert: {
          body?: string | null
          body_preview?: string | null
          contact_id?: string | null
          conversation_key: string
          created_at?: string
          direction: string
          id?: string
          maytapi_message_id?: string | null
          media_type?: string | null
          media_url?: string | null
          phone_e164?: string | null
          phone_hash: string
          phone_last4?: string | null
          raw?: Json
          read_at?: string | null
          read_by?: string | null
          received_at?: string
          status?: string
          user_id: string
          zazi_action_id?: string | null
        }
        Update: {
          body?: string | null
          body_preview?: string | null
          contact_id?: string | null
          conversation_key?: string
          created_at?: string
          direction?: string
          id?: string
          maytapi_message_id?: string | null
          media_type?: string | null
          media_url?: string | null
          phone_e164?: string | null
          phone_hash?: string
          phone_last4?: string | null
          raw?: Json
          read_at?: string | null
          read_by?: string | null
          received_at?: string
          status?: string
          user_id?: string
          zazi_action_id?: string | null
        }
        Relationships: []
      }
      merge_log: {
        Row: {
          created_at: string
          id: string
          key_type: string
          key_value: string
          merged_ids: string[]
          primary_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_type?: string
          key_value?: string
          merged_ids?: string[]
          primary_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_type?: string
          key_value?: string
          merged_ids?: string[]
          primary_id?: string
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          category: string
          channel: string
          created_at: string
          id: string
          merge_fields_supported: string[]
          send_when_condition: string
          sort_order: number
          subject: string | null
          template_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          category?: string
          channel?: string
          created_at?: string
          id?: string
          merge_fields_supported?: string[]
          send_when_condition?: string
          sort_order?: number
          subject?: string | null
          template_name?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          channel?: string
          created_at?: string
          id?: string
          merge_fields_supported?: string[]
          send_when_condition?: string
          sort_order?: number
          subject?: string | null
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          activity_period_end: string | null
          activity_period_start: string | null
          amount: number
          badges: string[]
          contact_id: string | null
          contact_name: string
          created_at: string
          dedupe_key: string | null
          id: string
          order_date: string
          order_id: string
          product: string
          purchase_type: string
          pv_amount: number
          quantity: number
          sales_channel: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_period_end?: string | null
          activity_period_start?: string | null
          amount?: number
          badges?: string[]
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          order_date?: string
          order_id?: string
          product?: string
          purchase_type?: string
          pv_amount?: number
          quantity?: number
          sales_channel?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_period_end?: string | null
          activity_period_start?: string | null
          amount?: number
          badges?: string[]
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          order_date?: string
          order_id?: string
          product?: string
          purchase_type?: string
          pv_amount?: number
          quantity?: number
          sales_channel?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_rescue_candidates: {
        Row: {
          audit: Json
          confidence: string
          contact_id: string | null
          contact_name: string
          created_at: string
          entry_key: string
          id: string
          lane: string
          match_method: string
          old_phone: string
          recovered_aplgo_id: string
          recovered_full_name: string
          recovered_phone: string
          resolved_at: string | null
          resolved_by: string | null
          shadow_log_id: string | null
          source_table: string
          status: string
          user_id: string
        }
        Insert: {
          audit?: Json
          confidence?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          entry_key?: string
          id?: string
          lane?: string
          match_method?: string
          old_phone?: string
          recovered_aplgo_id?: string
          recovered_full_name?: string
          recovered_phone?: string
          resolved_at?: string | null
          resolved_by?: string | null
          shadow_log_id?: string | null
          source_table?: string
          status?: string
          user_id: string
        }
        Update: {
          audit?: Json
          confidence?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          entry_key?: string
          id?: string
          lane?: string
          match_method?: string
          old_phone?: string
          recovered_aplgo_id?: string
          recovered_full_name?: string
          recovered_phone?: string
          resolved_at?: string | null
          resolved_by?: string | null
          shadow_log_id?: string | null
          source_table?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospector_send_log: {
        Row: {
          attempted_at: string
          contact_id: string | null
          content_length: number | null
          created_at: string
          error_code: string | null
          id: string
          intended_send_type: string
          maytapi_message_id: string | null
          metadata: Json
          mode: string
          payload_hash: string | null
          phone_hash: string | null
          request_status: string
          responded_at: string | null
          response_status_code: number | null
          user_id: string
          zazi_action_id: string | null
        }
        Insert: {
          attempted_at?: string
          contact_id?: string | null
          content_length?: number | null
          created_at?: string
          error_code?: string | null
          id?: string
          intended_send_type: string
          maytapi_message_id?: string | null
          metadata?: Json
          mode: string
          payload_hash?: string | null
          phone_hash?: string | null
          request_status: string
          responded_at?: string | null
          response_status_code?: number | null
          user_id: string
          zazi_action_id?: string | null
        }
        Update: {
          attempted_at?: string
          contact_id?: string | null
          content_length?: number | null
          created_at?: string
          error_code?: string | null
          id?: string
          intended_send_type?: string
          maytapi_message_id?: string | null
          metadata?: Json
          mode?: string
          payload_hash?: string | null
          phone_hash?: string | null
          request_status?: string
          responded_at?: string | null
          response_status_code?: number | null
          user_id?: string
          zazi_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospector_send_log_zazi_action_id_fkey"
            columns: ["zazi_action_id"]
            isOneToOne: false
            referencedRelation: "zazi_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          page: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          gemini_api_key: string | null
          id: string
          openai_api_key: string | null
          preferred_provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gemini_api_key?: string | null
          id?: string
          openai_api_key?: string | null
          preferred_provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gemini_api_key?: string | null
          id?: string
          openai_api_key?: string | null
          preferred_provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_knowledge_docs: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          status: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          status?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          status?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          request_hash: string
          response_status: number
          response_summary: Json
          scope: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          request_hash?: string
          response_status?: number
          response_summary?: Json
          scope?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          request_hash?: string
          response_status?: number
          response_summary?: Json
          scope?: string
        }
        Relationships: []
      }
      webhook_rate_limit_buckets: {
        Row: {
          created_at: string
          id: string
          identity: string
          request_count: number
          scope: string
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          identity: string
          request_count?: number
          scope?: string
          updated_at?: string
          window_start: string
        }
        Update: {
          created_at?: string
          id?: string
          identity?: string
          request_count?: number
          scope?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      zazi_actions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          belief_risk: number
          channel: string
          contact_id: string | null
          created_at: string
          evidence: Json
          expected_next_step: string
          id: string
          leadership_need: string
          maytapi_message_id: string | null
          movement_stage: string
          next_best_business_action: string
          proposed_message: string
          reason_for_message: string
          recommended_tone: string
          sent_at: string | null
          snooze_reason: string | null
          snoozed_until: string | null
          status: string
          supervisor_block_reason: string | null
          supervisor_clarity: number | null
          supervisor_cultural_fit: number | null
          supervisor_grounding: number | null
          supervisor_leadership_fit: number | null
          supervisor_quality_score: number | null
          supervisor_relevance: number | null
          supervisor_safety: number | null
          supervisor_tone_fit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          belief_risk?: number
          channel?: string
          contact_id?: string | null
          created_at?: string
          evidence?: Json
          expected_next_step?: string
          id?: string
          leadership_need?: string
          maytapi_message_id?: string | null
          movement_stage?: string
          next_best_business_action?: string
          proposed_message?: string
          reason_for_message?: string
          recommended_tone?: string
          sent_at?: string | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          status?: string
          supervisor_block_reason?: string | null
          supervisor_clarity?: number | null
          supervisor_cultural_fit?: number | null
          supervisor_grounding?: number | null
          supervisor_leadership_fit?: number | null
          supervisor_quality_score?: number | null
          supervisor_relevance?: number | null
          supervisor_safety?: number | null
          supervisor_tone_fit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          belief_risk?: number
          channel?: string
          contact_id?: string | null
          created_at?: string
          evidence?: Json
          expected_next_step?: string
          id?: string
          leadership_need?: string
          maytapi_message_id?: string | null
          movement_stage?: string
          next_best_business_action?: string
          proposed_message?: string
          reason_for_message?: string
          recommended_tone?: string
          sent_at?: string | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          status?: string
          supervisor_block_reason?: string | null
          supervisor_clarity?: number | null
          supervisor_cultural_fit?: number | null
          supervisor_grounding?: number | null
          supervisor_leadership_fit?: number | null
          supervisor_quality_score?: number | null
          supervisor_relevance?: number | null
          supervisor_safety?: number | null
          supervisor_tone_fit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zoom_campaign_recipients: {
        Row: {
          attempts: number
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          email: string | null
          error: string | null
          event_date: string
          event_id: string
          event_name: string | null
          first_name: string | null
          hub_decision: Json | null
          id: string
          last_attempt_at: string | null
          member_id: string | null
          name: string | null
          phone_normalized: string
          provider_message_id: string | null
          read_at: string | null
          reminder_stage: string
          replied_at: string | null
          reply_preview: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
          zoom_url: string
        }
        Insert: {
          attempts?: number
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          error?: string | null
          event_date: string
          event_id: string
          event_name?: string | null
          first_name?: string | null
          hub_decision?: Json | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string | null
          name?: string | null
          phone_normalized: string
          provider_message_id?: string | null
          read_at?: string | null
          reminder_stage?: string
          replied_at?: string | null
          reply_preview?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          zoom_url: string
        }
        Update: {
          attempts?: number
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          error?: string | null
          event_date?: string
          event_id?: string
          event_name?: string | null
          first_name?: string | null
          hub_decision?: Json | null
          id?: string
          last_attempt_at?: string | null
          member_id?: string | null
          name?: string | null
          phone_normalized?: string
          provider_message_id?: string | null
          read_at?: string | null
          reminder_stage?: string
          replied_at?: string | null
          reply_preview?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          zoom_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_webhook_safety_tables: { Args: never; Returns: undefined }
      create_offline_order_and_deduct_stock: {
        Args: {
          p_amount: number
          p_badges: string[]
          p_contact_id: string
          p_contact_name: string
          p_order_date: string
          p_order_id: string
          p_product: string
          p_purchase_type: string
          p_pv_amount: number
          p_quantity: number
          p_sales_channel: string
          p_source: string
          p_status: string
          p_user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_self_profile: { Args: { profile_id: string }; Returns: boolean }
      mark_maytapi_thread_read: {
        Args: { p_conversation_key: string }
        Returns: number
      }
      mark_maytapi_thread_unread: {
        Args: { p_conversation_key: string }
        Returns: number
      }
      normalize_email: { Args: { raw: string }; Returns: string }
      normalize_phone: { Args: { raw: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
