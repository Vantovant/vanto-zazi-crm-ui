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
          focus_area: string
          full_name: string
          id: string
          interest_level: string
          lead_path: string
          lead_temperature: string
          lead_type: string
          meeting_time: string
          next_action: string
          phone_number: string
          province: string
          registration_status: string
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
          focus_area?: string
          full_name: string
          id?: string
          interest_level?: string
          lead_path?: string
          lead_temperature?: string
          lead_type?: string
          meeting_time?: string
          next_action?: string
          phone_number?: string
          province?: string
          registration_status?: string
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
          focus_area?: string
          full_name?: string
          id?: string
          interest_level?: string
          lead_path?: string
          lead_temperature?: string
          lead_type?: string
          meeting_time?: string
          next_action?: string
          phone_number?: string
          province?: string
          registration_status?: string
          sponsor_name?: string
          state?: string
          updated_at?: string
          user_id?: string
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
          id: string
          order_date: string
          order_id: string
          product: string
          quantity: number
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
          id?: string
          order_date?: string
          order_id?: string
          product?: string
          quantity?: number
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
          id?: string
          order_date?: string
          order_id?: string
          product?: string
          quantity?: number
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
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_self_profile: { Args: { profile_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
