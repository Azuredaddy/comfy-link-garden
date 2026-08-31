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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          role?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          abn: string | null
          address: string | null
          bank_account: string | null
          bank_bsb: string | null
          bank_name: string | null
          business_name: string
          email: string | null
          gst_rate: number
          gst_registered: boolean
          ical_token: string
          id: number
          invoice_due_days: number
          invoice_prefix: string
          logo_url: string | null
          phone: string | null
          quote_prefix: string
          quote_terms_days: number
          updated_at: string
        }
        Insert: {
          abn?: string | null
          address?: string | null
          bank_account?: string | null
          bank_bsb?: string | null
          bank_name?: string | null
          business_name?: string
          email?: string | null
          gst_rate?: number
          gst_registered?: boolean
          ical_token?: string
          id?: number
          invoice_due_days?: number
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          quote_prefix?: string
          quote_terms_days?: number
          updated_at?: string
        }
        Update: {
          abn?: string | null
          address?: string | null
          bank_account?: string | null
          bank_bsb?: string | null
          bank_name?: string | null
          business_name?: string
          email?: string | null
          gst_rate?: number
          gst_registered?: boolean
          ical_token?: string
          id?: number
          invoice_due_days?: number
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          quote_prefix?: string
          quote_terms_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_counters: {
        Row: {
          doc_type: string
          fy: number
          last_number: number
        }
        Insert: {
          doc_type: string
          fy: number
          last_number?: number
        }
        Update: {
          doc_type?: string
          fy?: number
          last_number?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          gst_amount: number | null
          id: string
          receipt_url: string | null
          supplier: string | null
          tax_deductible: boolean
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          gst_amount?: number | null
          id?: string
          receipt_url?: string | null
          supplier?: string | null
          tax_deductible?: boolean
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          gst_amount?: number | null
          id?: string
          receipt_url?: string | null
          supplier?: string | null
          tax_deductible?: boolean
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total: number
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          discount_amount: number
          discount_percent: number
          due_date: string | null
          gst_amount: number
          id: string
          internal_notes: string | null
          issue_date: string
          number: string | null
          paid_at: string | null
          payment_method: string | null
          pdf_url: string | null
          quote_id: string | null
          quote_request_id: string | null
          sent_at: string | null
          status: string
          subtotal: number
          suburb: string | null
          total: number
          updated_at: string
          xero_contact_id: string | null
          xero_invoice_id: string | null
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          due_date?: string | null
          gst_amount?: number
          id?: string
          internal_notes?: string | null
          issue_date?: string
          number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          suburb?: string | null
          total?: number
          updated_at?: string
          xero_contact_id?: string | null
          xero_invoice_id?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          due_date?: string | null
          gst_amount?: number
          id?: string
          internal_notes?: string | null
          issue_date?: string
          number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          suburb?: string | null
          total?: number
          updated_at?: string
          xero_contact_id?: string | null
          xero_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          amount: number | null
          assigned_to: string | null
          confirmation_sent_at: string | null
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          description: string | null
          id: string
          invoice_id: string | null
          job_date: string
          job_time: string | null
          quote_id: string | null
          source: string | null
          status: string
          suburb: string | null
          time_note: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          job_date?: string
          job_time?: string | null
          quote_id?: string | null
          source?: string | null
          status?: string
          suburb?: string | null
          time_note?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          job_date?: string
          job_time?: string | null
          quote_id?: string | null
          source?: string | null
          status?: string
          suburb?: string | null
          time_note?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_subscribers: {
        Row: {
          consent_ip: string | null
          consented_at: string
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          consent_ip?: string | null
          consented_at?: string
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          consent_ip?: string | null
          consented_at?: string
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          direction: string
          email_status: string
          error: string | null
          id: string
          invoice_id: string | null
          quote_id: string | null
          quote_request_id: string | null
          subject: string | null
          to_email: string | null
          to_phone: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          direction?: string
          email_status?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          subject?: string | null
          to_email?: string | null
          to_phone?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          direction?: string
          email_status?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          subject?: string | null
          to_email?: string | null
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      other_income: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          income_date: string
          source: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          income_date?: string
          source?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          income_date?: string
          source?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          unit_price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          unit_price?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          unit_price?: number
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
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
      quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          discount_amount: number
          discount_percent: number
          expiry_date: string | null
          gst_amount: number
          id: string
          internal_notes: string | null
          issue_date: string
          number: string | null
          pdf_url: string | null
          quote_request_id: string | null
          sent_at: string | null
          status: string
          subtotal: number
          suburb: string | null
          total: number
          updated_at: string
          xero_contact_id: string | null
          xero_quote_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          expiry_date?: string | null
          gst_amount?: number
          id?: string
          internal_notes?: string | null
          issue_date?: string
          number?: string | null
          pdf_url?: string | null
          quote_request_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          suburb?: string | null
          total?: number
          updated_at?: string
          xero_contact_id?: string | null
          xero_quote_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          expiry_date?: string | null
          gst_amount?: number
          id?: string
          internal_notes?: string | null
          issue_date?: string
          number?: string | null
          pdf_url?: string | null
          quote_request_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          suburb?: string | null
          total?: number
          updated_at?: string
          xero_contact_id?: string | null
          xero_quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
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
      xero_connection: {
        Row: {
          access_token: string | null
          connected_at: string | null
          expires_at: string | null
          id: number
          refresh_token: string | null
          tenant_id: string | null
          tenant_name: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          expires_at?: string | null
          id?: number
          refresh_token?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          expires_at?: string | null
          id?: number
          refresh_token?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      xero_oauth_state: {
        Row: {
          created_at: string
          state: string
        }
        Insert: {
          created_at?: string
          state: string
        }
        Update: {
          created_at?: string
          state?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      au_fy_start: { Args: { d: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      my_role: { Args: never; Returns: string }
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
