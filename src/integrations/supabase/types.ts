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
          level: string
          message_style: string
          original_congratulate_by_date: string | null
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
          level?: string
          message_style?: string
          original_congratulate_by_date?: string | null
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
          level?: string
          message_style?: string
          original_congratulate_by_date?: string | null
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
          phone_normalized: string | null
          phone_number: string
          province: string
          registration_status: string
          salutation_title: string
          sponsor_name: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken?: string
          additional_notes?: string
          aplgo_id?: string
          assigned_to?: string
          associate_status?: string
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
          phone_normalized?: string | null
          phone_number?: string
          province?: string
          registration_status?: string
          salutation_title?: string
          sponsor_name?: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken?: string
          additional_notes?: string
          aplgo_id?: string
          assigned_to?: string
          associate_status?: string
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
          phone_normalized?: string | null
          phone_number?: string
          province?: string
          registration_status?: string
          salutation_title?: string
          sponsor_name?: string
          state?: string
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
      integration_settings: {
        Row: {
          created_at: string
          daily_send_cap: number
          daily_token_cap: number
          maytapi_enabled: boolean
          maytapi_phone_allowlist: string[]
          prospector_can_auto_apply_low: boolean
          prospector_can_propose: boolean
          prospector_can_send_autonomous: boolean
          prospector_supervisor_required: boolean
          supervisor_block_threshold: number
          supervisor_leadership_fit_threshold: number
          supervisor_safety_threshold: number
          updated_at: string
          user_id: string
          zazi_prospector_enabled: boolean
        }
        Insert: {
          created_at?: string
          daily_send_cap?: number
          daily_token_cap?: number
          maytapi_enabled?: boolean
          maytapi_phone_allowlist?: string[]
          prospector_can_auto_apply_low?: boolean
          prospector_can_propose?: boolean
          prospector_can_send_autonomous?: boolean
          prospector_supervisor_required?: boolean
          supervisor_block_threshold?: number
          supervisor_leadership_fit_threshold?: number
          supervisor_safety_threshold?: number
          updated_at?: string
          user_id: string
          zazi_prospector_enabled?: boolean
        }
        Update: {
          created_at?: string
          daily_send_cap?: number
          daily_token_cap?: number
          maytapi_enabled?: boolean
          maytapi_phone_allowlist?: string[]
          prospector_can_auto_apply_low?: boolean
          prospector_can_propose?: boolean
          prospector_can_send_autonomous?: boolean
          prospector_supervisor_required?: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      normalize_email: { Args: { raw: string }; Returns: string }
      normalize_phone: { Args: { raw: string }; Returns: string }
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
