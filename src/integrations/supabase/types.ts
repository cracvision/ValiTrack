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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          account_expires_at: string | null
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          email: string
          failed_login_attempts: number
          first_failed_login_at: string | null
          full_name: string
          id: string
          is_blocked: boolean
          must_change_password: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          account_expires_at?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email: string
          failed_login_attempts?: number
          first_failed_login_at?: string | null
          full_name?: string
          id: string
          is_blocked?: boolean
          must_change_password?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_expires_at?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string
          failed_login_attempts?: number
          first_failed_login_at?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean
          must_change_password?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      review_case_transitions: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          review_case_id: string
          to_status: string
          transitioned_by: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          review_case_id: string
          to_status: string
          transitioned_by: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          review_case_id?: string
          to_status?: string
          transitioned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_case_transitions_review_case_id_fkey"
            columns: ["review_case_id"]
            isOneToOne: false
            referencedRelation: "review_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cases: {
        Row: {
          business_owner_id: string
          completed_at: string | null
          conclusion: string | null
          conclusion_notes: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string
          frozen_system_snapshot: Json
          id: string
          initiated_by: string
          is_deleted: boolean
          it_manager_id: string | null
          qa_id: string
          review_level: string
          review_period_end: string
          review_period_start: string
          status: string
          system_admin_id: string
          system_id: string
          system_owner_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_owner_id: string
          completed_at?: string | null
          conclusion?: string | null
          conclusion_notes?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date: string
          frozen_system_snapshot: Json
          id?: string
          initiated_by: string
          is_deleted?: boolean
          it_manager_id?: string | null
          qa_id: string
          review_level: string
          review_period_end: string
          review_period_start: string
          status?: string
          system_admin_id: string
          system_id: string
          system_owner_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_owner_id?: string
          completed_at?: string | null
          conclusion?: string | null
          conclusion_notes?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string
          frozen_system_snapshot?: Json
          id?: string
          initiated_by?: string
          is_deleted?: boolean
          it_manager_id?: string | null
          qa_id?: string
          review_level?: string
          review_period_end?: string
          review_period_start?: string
          status?: string
          system_admin_id?: string
          system_id?: string
          system_owner_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_cases_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "system_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_signoffs: {
        Row: {
          comments: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          phase: string
          requested_role: string
          requested_user_id: string
          review_case_id: string
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          comments?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          phase: string
          requested_role: string
          requested_user_id: string
          review_case_id: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          comments?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          phase?: string
          requested_role?: string
          requested_user_id?: string
          review_case_id?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_signoffs_review_case_id_fkey"
            columns: ["review_case_id"]
            isOneToOne: false
            referencedRelation: "review_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      review_tasks: {
        Row: {
          approved_by_user: string | null
          assigned_to: string
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          due_date: string
          execution_type: string
          id: string
          is_deleted: boolean
          phase: string
          review_case_id: string
          sort_order: number
          started_at: string | null
          status: string
          task_group: string
          template_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_by_user?: string | null
          assigned_to: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          due_date: string
          execution_type?: string
          id?: string
          is_deleted?: boolean
          phase: string
          review_case_id: string
          sort_order?: number
          started_at?: string | null
          status?: string
          task_group: string
          template_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_by_user?: string | null
          assigned_to?: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          due_date?: string
          execution_type?: string
          id?: string
          is_deleted?: boolean
          phase?: string
          review_case_id?: string
          sort_order?: number
          started_at?: string | null
          status?: string
          task_group?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_tasks_review_case_id_fkey"
            columns: ["review_case_id"]
            isOneToOne: false
            referencedRelation: "review_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      system_profiles: {
        Row: {
          business_owner_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          gamp_category: string
          gxp_classification: string
          id: string
          intended_use: string
          is_deleted: boolean
          it_manager_id: string | null
          name: string
          next_review_date: string
          owner_id: string
          qa_id: string
          review_period_months: number
          risk_level: string
          status: string
          system_admin_id: string
          system_environment: string
          system_identifier: string
          system_owner_id: string
          updated_at: string
          updated_by: string | null
          validation_date: string
          vendor_contact: string
          vendor_contract_ref: string
          vendor_name: string
        }
        Insert: {
          business_owner_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          gamp_category: string
          gxp_classification: string
          id?: string
          intended_use?: string
          is_deleted?: boolean
          it_manager_id?: string | null
          name: string
          next_review_date: string
          owner_id?: string
          qa_id?: string
          review_period_months?: number
          risk_level: string
          status?: string
          system_admin_id?: string
          system_environment: string
          system_identifier: string
          system_owner_id?: string
          updated_at?: string
          updated_by?: string | null
          validation_date: string
          vendor_contact?: string
          vendor_contract_ref?: string
          vendor_name?: string
        }
        Update: {
          business_owner_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          gamp_category?: string
          gxp_classification?: string
          id?: string
          intended_use?: string
          is_deleted?: boolean
          it_manager_id?: string | null
          name?: string
          next_review_date?: string
          owner_id?: string
          qa_id?: string
          review_period_months?: number
          risk_level?: string
          status?: string
          system_admin_id?: string
          system_environment?: string
          system_identifier?: string
          system_owner_id?: string
          updated_at?: string
          updated_by?: string | null
          validation_date?: string
          vendor_contact?: string
          vendor_contract_ref?: string
          vendor_name?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          code: string
          created_at: string
          created_by: string
          default_approver_role: string
          default_assignee_role: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          execution_type: string
          id: string
          is_active: boolean
          is_deleted: boolean
          phase: string
          review_level_min: number
          sort_order: number
          task_group: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          default_approver_role: string
          default_assignee_role: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          execution_type?: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          phase: string
          review_level_min?: number
          sort_order?: number
          task_group: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          default_approver_role?: string
          default_assignee_role?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          execution_type?: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          phase?: string
          review_level_min?: number
          sort_order?: number
          task_group?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_language_preference: {
        Row: {
          created_at: string
          language_code: string
          locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language_code?: string
          locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          language_code?: string
          locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_users_list: {
        Args: never
        Returns: {
          account_expires_at: string
          blocked_reason: string
          email: string
          full_name: string
          is_blocked: boolean
          language_code: string
          must_change_password: boolean
          registered_at: string
          roles: string
          user_id: string
          username: string
        }[]
      }
      get_signoff_summary: {
        Args: { p_phase: string; p_review_case_id: string }
        Returns: {
          has_objections: boolean
          total_completed: number
          total_required: number
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_users_by_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          full_name: string
          id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_user_names: {
        Args: { user_ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_user"
        | "system_owner"
        | "system_administrator"
        | "business_owner"
        | "quality_assurance"
        | "it_manager"
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
      app_role: [
        "super_user",
        "system_owner",
        "system_administrator",
        "business_owner",
        "quality_assurance",
        "it_manager",
      ],
    },
  },
} as const
