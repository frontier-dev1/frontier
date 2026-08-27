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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_news: {
        Row: {
          ai_category: string | null
          ai_company: string | null
          ai_importance: string | null
          ai_model: string | null
          ai_reasoning: string | null
          ai_relevance_score: number | null
          ai_reviewed_at: string | null
          ai_summary: string | null
          article_fetch_status: string
          article_text: string | null
          article_text_fetched_at: string | null
          article_text_length: number
          article_text_source: string | null
          article_url: string | null
          category: string | null
          created_at: string
          discovered_at: string
          id: string
          image_url: string | null
          published_at: string | null
          source_name: string
          source_url: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_category?: string | null
          ai_company?: string | null
          ai_importance?: string | null
          ai_model?: string | null
          ai_reasoning?: string | null
          ai_relevance_score?: number | null
          ai_reviewed_at?: string | null
          ai_summary?: string | null
          article_fetch_status?: string
          article_text?: string | null
          article_text_fetched_at?: string | null
          article_text_length?: number
          article_text_source?: string | null
          article_url?: string | null
          category?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          source_name: string
          source_url: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_category?: string | null
          ai_company?: string | null
          ai_importance?: string | null
          ai_model?: string | null
          ai_reasoning?: string | null
          ai_relevance_score?: number | null
          ai_reviewed_at?: string | null
          ai_summary?: string | null
          article_fetch_status?: string
          article_text?: string | null
          article_text_fetched_at?: string | null
          article_text_length?: number
          article_text_source?: string | null
          article_url?: string | null
          category?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          source_name?: string
          source_url?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      discovery_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          discovered: number
          error_message: string | null
          id: string
          inserted: number
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          discovered?: number
          error_message?: string | null
          id?: string
          inserted?: number
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          discovered?: number
          error_message?: string | null
          id?: string
          inserted?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      incident_candidates: {
        Row: {
          ai_additional_sources: Json
          ai_category: string | null
          ai_company: string | null
          ai_confidence: number | null
          ai_evidence_quality: number | null
          ai_evidence_summary: string | null
          ai_incident_description: string | null
          ai_incident_summary: string | null
          ai_intended_behavior: string | null
          ai_is_incident: boolean | null
          ai_model: string | null
          ai_observed_behavior: string | null
          ai_reasoning: string | null
          ai_recommendation: string | null
          ai_review_status: string
          ai_reviewed_at: string | null
          ai_scope_violation: string | null
          ai_severity: string | null
          article_fetch_status: string | null
          article_text: string | null
          article_text_fetched_at: string | null
          article_text_length: number | null
          article_text_source: string | null
          article_url: string
          created_at: string
          discovered_at: string
          id: string
          matched_keywords: string[] | null
          notes: string | null
          published_at: string | null
          relevance_score: number | null
          source_name: string | null
          source_url: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_additional_sources?: Json
          ai_category?: string | null
          ai_company?: string | null
          ai_confidence?: number | null
          ai_evidence_quality?: number | null
          ai_evidence_summary?: string | null
          ai_incident_description?: string | null
          ai_incident_summary?: string | null
          ai_intended_behavior?: string | null
          ai_is_incident?: boolean | null
          ai_model?: string | null
          ai_observed_behavior?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_review_status?: string
          ai_reviewed_at?: string | null
          ai_scope_violation?: string | null
          ai_severity?: string | null
          article_fetch_status?: string | null
          article_text?: string | null
          article_text_fetched_at?: string | null
          article_text_length?: number | null
          article_text_source?: string | null
          article_url: string
          created_at?: string
          discovered_at?: string
          id?: string
          matched_keywords?: string[] | null
          notes?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source_name?: string | null
          source_url: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_additional_sources?: Json
          ai_category?: string | null
          ai_company?: string | null
          ai_confidence?: number | null
          ai_evidence_quality?: number | null
          ai_evidence_summary?: string | null
          ai_incident_description?: string | null
          ai_incident_summary?: string | null
          ai_intended_behavior?: string | null
          ai_is_incident?: boolean | null
          ai_model?: string | null
          ai_observed_behavior?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_review_status?: string
          ai_reviewed_at?: string | null
          ai_scope_violation?: string | null
          ai_severity?: string | null
          article_fetch_status?: string | null
          article_text?: string | null
          article_text_fetched_at?: string | null
          article_text_length?: number | null
          article_text_source?: string | null
          article_url?: string
          created_at?: string
          discovered_at?: string
          id?: string
          matched_keywords?: string[] | null
          notes?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source_name?: string | null
          source_url?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          additional_sources: Json | null
          category: string | null
          company: string
          created_at: string | null
          description: string
          id: string
          model: string | null
          occurred_at: string | null
          reported_at: string | null
          severity: string
          source_name: string
          source_url: string
          summary: string
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_at_timestamp: string | null
          verification_status: string
        }
        Insert: {
          additional_sources?: Json | null
          category?: string | null
          company: string
          created_at?: string | null
          description: string
          id: string
          model?: string | null
          occurred_at?: string | null
          reported_at?: string | null
          severity: string
          source_name: string
          source_url: string
          summary: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_at_timestamp?: string | null
          verification_status?: string
        }
        Update: {
          additional_sources?: Json | null
          category?: string | null
          company?: string
          created_at?: string | null
          description?: string
          id?: string
          model?: string | null
          occurred_at?: string | null
          reported_at?: string | null
          severity?: string
          source_name?: string
          source_url?: string
          summary?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_at_timestamp?: string | null
          verification_status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_incident_candidate: {
        Args: {
          p_candidate_id: string
          p_category: string
          p_company: string
          p_description: string
          p_model: string
          p_occurred_at: string
          p_severity: string
          p_summary: string
          p_title: string
        }
        Returns: {
          additional_sources: Json | null
          category: string | null
          company: string
          created_at: string | null
          description: string
          id: string
          model: string | null
          occurred_at: string | null
          reported_at: string | null
          severity: string
          source_name: string
          source_url: string
          summary: string
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_at_timestamp: string | null
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
