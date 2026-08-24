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
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string | null
          handled: boolean
          id: string
          message: string | null
          name: string
          notification_attempted_at: string | null
          notification_attempts: number
          notification_error: string | null
          notified_at: string | null
          phone: string | null
          service: string | null
          source_url: string | null
          submission_key: string | null
          suburb: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          handled?: boolean
          id?: string
          message?: string | null
          name: string
          notification_attempted_at?: string | null
          notification_attempts?: number
          notification_error?: string | null
          notified_at?: string | null
          phone?: string | null
          service?: string | null
          source_url?: string | null
          submission_key?: string | null
          suburb?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          handled?: boolean
          id?: string
          message?: string | null
          name?: string
          notification_attempted_at?: string | null
          notification_attempts?: number
          notification_error?: string | null
          notified_at?: string | null
          phone?: string | null
          service?: string | null
          source_url?: string | null
          submission_key?: string | null
          suburb?: string | null
        }
        Relationships: []
      }
      server_errors: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          method: string | null
          resolved: boolean
          route: string | null
          source: string
          stack: string | null
          status: number | null
          user_agent: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          method?: string | null
          resolved?: boolean
          route?: string | null
          source: string
          stack?: string | null
          status?: number | null
          user_agent?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          method?: string | null
          resolved?: boolean
          route?: string | null
          source?: string
          stack?: string | null
          status?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          id: number
          business_name: string
          abn: string | null
          address: string | null
          phone: string | null
          email: string | null
          gst_registered: boolean
          gst_rate: number
          bank_name: string | null
          bank_bsb: string | null
          bank_account: string | null
          quote_prefix: string
          invoice_prefix: string
          quote_terms_days: number
          invoice_due_days: number
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          business_name?: string
          abn?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          gst_registered?: boolean
          gst_rate?: number
          bank_name?: string | null
          bank_bsb?: string | null
          bank_account?: string | null
          quote_prefix?: string
          invoice_prefix?: string
          quote_terms_days?: number
          invoice_due_days?: number
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          business_name?: string
          abn?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          gst_registered?: boolean
          gst_rate?: number
          bank_name?: string | null
          bank_bsb?: string | null
          bank_account?: string | null
          quote_prefix?: string
          invoice_prefix?: string
          quote_terms_days?: number
          invoice_due_days?: number
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_counters: {
        Row: { doc_type: string; fy: number; last_number: number }
        Insert: { doc_type: string; fy: number; last_number?: number }
        Update: { doc_type?: string; fy?: number; last_number?: number }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          number: string | null
          quote_request_id: string | null
          customer_name: string
          customer_email: string | null
          customer_phone: string | null
          customer_address: string | null
          suburb: string | null
          status: string
          issue_date: string
          expiry_date: string | null
          subtotal: number
          gst_amount: number
          total: number
          customer_notes: string | null
          internal_notes: string | null
          pdf_url: string | null
          sent_at: string | null
          accepted_at: string | null
          xero_quote_id: string | null
          xero_contact_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          number?: string | null
          quote_request_id?: string | null
          customer_name: string
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          suburb?: string | null
          status?: string
          issue_date?: string
          expiry_date?: string | null
          subtotal?: number
          gst_amount?: number
          total?: number
          customer_notes?: string | null
          internal_notes?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          accepted_at?: string | null
          xero_quote_id?: string | null
          xero_contact_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          number?: string | null
          quote_request_id?: string | null
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          suburb?: string | null
          status?: string
          issue_date?: string
          expiry_date?: string | null
          subtotal?: number
          gst_amount?: number
          total?: number
          customer_notes?: string | null
          internal_notes?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          accepted_at?: string | null
          xero_quote_id?: string | null
          xero_contact_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          description: string
          quantity: number
          unit_price: number
          line_total: number
          position: number
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          quantity?: number
          unit_price?: number
          line_total?: number
          position?: number
        }
        Update: {
          id?: string
          quote_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          line_total?: number
          position?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          number: string | null
          quote_id: string | null
          quote_request_id: string | null
          customer_name: string
          customer_email: string | null
          customer_phone: string | null
          customer_address: string | null
          suburb: string | null
          status: string
          issue_date: string
          due_date: string | null
          subtotal: number
          gst_amount: number
          total: number
          amount_paid: number
          paid_at: string | null
          payment_method: string | null
          customer_notes: string | null
          internal_notes: string | null
          pdf_url: string | null
          sent_at: string | null
          xero_invoice_id: string | null
          xero_contact_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          number?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          customer_name: string
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          suburb?: string | null
          status?: string
          issue_date?: string
          due_date?: string | null
          subtotal?: number
          gst_amount?: number
          total?: number
          amount_paid?: number
          paid_at?: string | null
          payment_method?: string | null
          customer_notes?: string | null
          internal_notes?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          xero_invoice_id?: string | null
          xero_contact_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          number?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          suburb?: string | null
          status?: string
          issue_date?: string
          due_date?: string | null
          subtotal?: number
          gst_amount?: number
          total?: number
          amount_paid?: number
          paid_at?: string | null
          payment_method?: string | null
          customer_notes?: string | null
          internal_notes?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          xero_invoice_id?: string | null
          xero_contact_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          line_total: number
          position: number
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity?: number
          unit_price?: number
          line_total?: number
          position?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          line_total?: number
          position?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          expense_date: string
          category: string
          description: string | null
          amount: number
          gst_amount: number | null
          supplier: string | null
          receipt_url: string | null
          tax_deductible: boolean
          created_at: string
        }
        Insert: {
          id?: string
          expense_date?: string
          category?: string
          description?: string | null
          amount?: number
          gst_amount?: number | null
          supplier?: string | null
          receipt_url?: string | null
          tax_deductible?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          expense_date?: string
          category?: string
          description?: string | null
          amount?: number
          gst_amount?: number | null
          supplier?: string | null
          receipt_url?: string | null
          tax_deductible?: boolean
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          quote_request_id: string | null
          quote_id: string | null
          invoice_id: string | null
          direction: string
          to_email: string | null
          subject: string | null
          body: string | null
          email_status: string
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quote_request_id?: string | null
          quote_id?: string | null
          invoice_id?: string | null
          direction?: string
          to_email?: string | null
          subject?: string | null
          body?: string | null
          email_status?: string
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quote_request_id?: string | null
          quote_id?: string | null
          invoice_id?: string | null
          direction?: string
          to_email?: string | null
          subject?: string | null
          body?: string | null
          email_status?: string
          error?: string | null
          created_at?: string
        }
        Relationships: []
      }
      xero_connection: {
        Row: {
          id: number
          access_token: string | null
          refresh_token: string | null
          expires_at: string | null
          tenant_id: string | null
          tenant_name: string | null
          connected_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          access_token?: string | null
          refresh_token?: string | null
          expires_at?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          connected_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          access_token?: string | null
          refresh_token?: string | null
          expires_at?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          connected_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      xero_oauth_state: {
        Row: { state: string; created_at: string }
        Insert: { state: string; created_at?: string }
        Update: { state?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      au_fy_start: { Args: { d: string }; Returns: number }
      next_document_number: { Args: { p_doc_type: string }; Returns: string }
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
