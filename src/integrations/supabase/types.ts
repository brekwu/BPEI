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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abuse_log: {
        Row: {
          endpoint: string
          event_type: Database["public"]["Enums"]["abuse_event_type"]
          fingerprint: string | null
          id: string
          ip: string | null
          ip_hash: string
          metadata: Json
          occurred_at: string
          severity: Database["public"]["Enums"]["abuse_severity"]
          shop_id: string | null
          user_agent: string | null
        }
        Insert: {
          endpoint: string
          event_type: Database["public"]["Enums"]["abuse_event_type"]
          fingerprint?: string | null
          id?: string
          ip?: string | null
          ip_hash: string
          metadata?: Json
          occurred_at?: string
          severity?: Database["public"]["Enums"]["abuse_severity"]
          shop_id?: string | null
          user_agent?: string | null
        }
        Update: {
          endpoint?: string
          event_type?: Database["public"]["Enums"]["abuse_event_type"]
          fingerprint?: string | null
          id?: string
          ip?: string | null
          ip_hash?: string
          metadata?: Json
          occurred_at?: string
          severity?: Database["public"]["Enums"]["abuse_severity"]
          shop_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abuse_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abuse_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          shop_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          shop_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          ended_at: string | null
          expires_at: string | null
          export_performed: boolean
          files_downloaded: number
          id: string
          ip_address: string | null
          pages_accessed: string[] | null
          reason: string
          reason_category: string
          sensitive_actions: Json | null
          session_id: string | null
          shop_id: string | null
          started_at: string
          ticket_reference: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string | null
          export_performed?: boolean
          files_downloaded?: number
          id?: string
          ip_address?: string | null
          pages_accessed?: string[] | null
          reason: string
          reason_category: string
          sensitive_actions?: Json | null
          session_id?: string | null
          shop_id?: string | null
          started_at?: string
          ticket_reference?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string | null
          export_performed?: boolean
          files_downloaded?: number
          id?: string
          ip_address?: string | null
          pages_accessed?: string[] | null
          reason?: string
          reason_category?: string
          sensitive_actions?: Json | null
          session_id?: string | null
          shop_id?: string | null
          started_at?: string
          ticket_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      appointment_blocked_slots: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          reason: string | null
          shop_id: string
          starts_at: string
          technician_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          reason?: string | null
          shop_id: string
          starts_at: string
          technician_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          reason?: string | null
          shop_id?: string
          starts_at?: string
          technician_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_blocked_slots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_blocked_slots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_sent_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          device_description: string | null
          ends_at: string
          id: string
          internal_notes: string | null
          is_urgent: boolean
          problem_description: string | null
          reminder_sent_at: string | null
          repair_id: string | null
          service_id: string | null
          shop_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          technician_user_id: string | null
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          device_description?: string | null
          ends_at: string
          id?: string
          internal_notes?: string | null
          is_urgent?: boolean
          problem_description?: string | null
          reminder_sent_at?: string | null
          repair_id?: string | null
          service_id?: string | null
          shop_id: string
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          technician_user_id?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          device_description?: string | null
          ends_at?: string
          id?: string
          internal_notes?: string | null
          is_urgent?: boolean
          problem_description?: string | null
          reminder_sent_at?: string | null
          repair_id?: string | null
          service_id?: string | null
          shop_id?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          technician_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          category: Database["public"]["Enums"]["bug_report_category"]
          created_at: string
          description: string
          id: string
          page_url: string | null
          reporter_email: string | null
          reporter_name: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["bug_report_severity"]
          status: Database["public"]["Enums"]["bug_report_status"]
          submitted_by: string | null
          title: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["bug_report_category"]
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["bug_report_severity"]
          status?: Database["public"]["Enums"]["bug_report_status"]
          submitted_by?: string | null
          title: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["bug_report_category"]
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["bug_report_severity"]
          status?: Database["public"]["Enums"]["bug_report_status"]
          submitted_by?: string | null
          title?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount_cents: number
          created_at: string
          credit_note_id: string | null
          id: string
          kind: Database["public"]["Enums"]["cash_movement_kind"]
          note: string | null
          payment_id: string | null
          performed_by: string | null
          reason: string | null
          sale_id: string | null
          session_id: string
          shop_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_note_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["cash_movement_kind"]
          note?: string | null
          payment_id?: string | null
          performed_by?: string | null
          reason?: string | null
          sale_id?: string | null
          session_id: string
          shop_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_note_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["cash_movement_kind"]
          note?: string | null
          payment_id?: string | null
          performed_by?: string | null
          reason?: string | null
          sale_id?: string | null
          session_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cash_cents: number | null
          created_at: string
          expected_cash_cents: number
          id: string
          opened_at: string
          opened_by: string | null
          opening_float_cents: number
          opening_notes: string | null
          register_label: string | null
          shop_id: string
          status: Database["public"]["Enums"]["cash_session_status"]
          updated_at: string
          variance_cents: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cash_cents?: number | null
          created_at?: string
          expected_cash_cents?: number
          id?: string
          opened_at?: string
          opened_by?: string | null
          opening_float_cents?: number
          opening_notes?: string | null
          register_label?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
          variance_cents?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cash_cents?: number | null
          created_at?: string
          expected_cash_cents?: number
          id?: string
          opened_at?: string
          opened_by?: string | null
          opening_float_cents?: number
          opening_notes?: string | null
          register_label?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
          variance_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          city: string | null
          consent: boolean
          created_at: string
          email: string
          first_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          internal_note: string | null
          ip: string | null
          last_name: string
          message: string
          next_action: string | null
          next_action_at: string | null
          origin_path: string | null
          phone: string | null
          priority: string | null
          reference: string
          shop_id: string | null
          shop_name: string | null
          status: string
          subject_kind: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          consent?: boolean
          created_at?: string
          email: string
          first_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          ip?: string | null
          last_name: string
          message: string
          next_action?: string | null
          next_action_at?: string | null
          origin_path?: string | null
          phone?: string | null
          priority?: string | null
          reference: string
          shop_id?: string | null
          shop_name?: string | null
          status?: string
          subject_kind: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          consent?: boolean
          created_at?: string
          email?: string
          first_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          ip?: string | null
          last_name?: string
          message?: string
          next_action?: string | null
          next_action_at?: string | null
          origin_path?: string | null
          phone?: string | null
          priority?: string | null
          reference?: string
          shop_id?: string | null
          shop_name?: string | null
          status?: string
          subject_kind?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_submissions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          attachments: Json
          category: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          description: string
          good_faith_declared: boolean
          id: string
          legal_basis: string | null
          report_number: string
          reporter_email: string | null
          reporter_name: string | null
          reporter_phone: string | null
          reporter_user_id: string | null
          status: string
          target_id: string | null
          target_shop_id: string | null
          target_type: string | null
          target_url: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          category: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          description: string
          good_faith_declared?: boolean
          id?: string
          legal_basis?: string | null
          report_number?: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_user_id?: string | null
          status?: string
          target_id?: string | null
          target_shop_id?: string | null
          target_type?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          description?: string
          good_faith_declared?: boolean
          id?: string
          legal_basis?: string | null
          report_number?: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_user_id?: string | null
          status?: string
          target_id?: string | null
          target_shop_id?: string | null
          target_type?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_target_shop_id_fkey"
            columns: ["target_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_target_shop_id_fkey"
            columns: ["target_shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          advertising: boolean
          analytics: boolean
          created_at: string
          expires_at: string
          external_features: boolean
          id: string
          necessary: boolean
          policy_version: string
          preferences: boolean
          pseudonym_id: string
          user_id: string | null
        }
        Insert: {
          advertising?: boolean
          analytics?: boolean
          created_at?: string
          expires_at?: string
          external_features?: boolean
          id?: string
          necessary?: boolean
          policy_version: string
          preferences?: boolean
          pseudonym_id: string
          user_id?: string | null
        }
        Update: {
          advertising?: boolean
          analytics?: boolean
          created_at?: string
          expires_at?: string
          external_features?: boolean
          id?: string
          necessary?: boolean
          policy_version?: string
          preferences?: boolean
          pseudonym_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_note_lines: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          display_order: number
          id: string
          line_subtotal_cents: number
          line_tax_cents: number
          line_total_cents: number
          quantity: number
          shop_id: string
          tax_rate: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          display_order?: number
          id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          quantity?: number
          shop_id: string
          tax_rate?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          display_order?: number
          id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          quantity?: number
          shop_id?: string
          tax_rate?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          billing_identity_snapshot: Json | null
          created_at: string
          created_by: string | null
          credit_note_number: string | null
          currency: string
          customer_id: string | null
          customer_identity_snapshot: Json | null
          id: string
          invoice_id: string
          issue_date: string | null
          issued_at: string | null
          legal_mentions_snapshot: string | null
          locked_at: string | null
          reason: string | null
          refund_method: Database["public"]["Enums"]["payment_method"] | null
          refunded_amount_cents: number
          shop_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_excluding_tax_cents: number
          tax_total_cents: number
          total_including_tax_cents: number
          updated_at: string
        }
        Insert: {
          billing_identity_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          credit_note_number?: string | null
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          id?: string
          invoice_id: string
          issue_date?: string | null
          issued_at?: string | null
          legal_mentions_snapshot?: string | null
          locked_at?: string | null
          reason?: string | null
          refund_method?: Database["public"]["Enums"]["payment_method"] | null
          refunded_amount_cents?: number
          shop_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          total_including_tax_cents?: number
          updated_at?: string
        }
        Update: {
          billing_identity_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          credit_note_number?: string | null
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          id?: string
          invoice_id?: string
          issue_date?: string | null
          issued_at?: string | null
          legal_mentions_snapshot?: string | null
          locked_at?: string | null
          reason?: string | null
          refund_method?: Database["public"]["Enums"]["payment_method"] | null
          refunded_amount_cents?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          total_including_tax_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          customer_id: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          shop_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          customer_id: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          shop_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          customer_id?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          shop_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_invitations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_invitations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_invitations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_links: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          linked_via: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          linked_via?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          linked_via?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_links_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_links_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          archived_at: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string | null
          first_name: string | null
          id: string
          internal_notes: string | null
          last_name: string | null
          marketing_email_consent: boolean
          marketing_sms_consent: boolean
          phone: string | null
          postal_code: string | null
          secondary_phone: string | null
          shop_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived_at?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          first_name?: string | null
          id?: string
          internal_notes?: string | null
          last_name?: string | null
          marketing_email_consent?: boolean
          marketing_sms_consent?: boolean
          phone?: string | null
          postal_code?: string | null
          secondary_phone?: string | null
          shop_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived_at?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          first_name?: string | null
          id?: string
          internal_notes?: string | null
          last_name?: string | null
          marketing_email_consent?: boolean
          marketing_sms_consent?: boolean
          phone?: string | null
          postal_code?: string | null
          secondary_phone?: string | null
          shop_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_jobs: {
        Row: {
          audit_id: string | null
          categories_deleted: string[] | null
          categories_retained: string[] | null
          completed_at: string | null
          created_at: string
          errors: string | null
          executed_by: string | null
          id: string
          retention_reason: string | null
          scheduled_at: string | null
          shop_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audit_id?: string | null
          categories_deleted?: string[] | null
          categories_retained?: string[] | null
          completed_at?: string | null
          created_at?: string
          errors?: string | null
          executed_by?: string | null
          id?: string
          retention_reason?: string | null
          scheduled_at?: string | null
          shop_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audit_id?: string | null
          categories_deleted?: string[] | null
          categories_retained?: string[] | null
          completed_at?: string | null
          created_at?: string
          errors?: string | null
          executed_by?: string | null
          id?: string
          retention_reason?: string | null
          scheduled_at?: string | null
          shop_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_jobs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_deletion_jobs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          created_at: string
          downloaded_at: string | null
          expires_at: string | null
          failure_reason: string | null
          file_hash: string | null
          file_path: string | null
          format: string
          generated_at: string | null
          id: string
          requested_at: string
          requested_by: string
          scope: string[] | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          downloaded_at?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          file_hash?: string | null
          file_path?: string | null
          format?: string
          generated_at?: string | null
          id?: string
          requested_at?: string
          requested_by: string
          scope?: string[] | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          downloaded_at?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          file_hash?: string | null
          file_path?: string | null
          format?: string
          generated_at?: string | null
          id?: string
          requested_at?: string
          requested_by?: string
          scope?: string[] | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          active_retention: string | null
          anonymization_possible: boolean
          backup_retention: string | null
          category: string
          created_at: string
          deletion_method: string | null
          id: string
          justification: string | null
          legal_retention: string | null
          post_termination_retention: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          active_retention?: string | null
          anonymization_possible?: boolean
          backup_retention?: string | null
          category: string
          created_at?: string
          deletion_method?: string | null
          id?: string
          justification?: string | null
          legal_retention?: string | null
          post_termination_retention?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          active_retention?: string | null
          anonymization_possible?: boolean
          backup_retention?: string | null
          category?: string
          created_at?: string
          deletion_method?: string | null
          id?: string
          justification?: string | null
          legal_retention?: string | null
          post_termination_retention?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          city: string | null
          consent: boolean
          created_at: string
          email: string
          establishments_count: number | null
          first_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          internal_note: string | null
          ip: string | null
          last_name: string
          message: string | null
          next_action: string | null
          next_action_at: string | null
          phone: string
          preferred_slot: string | null
          priority: string | null
          reference: string
          shop_name: string
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          consent?: boolean
          created_at?: string
          email: string
          establishments_count?: number | null
          first_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          ip?: string | null
          last_name: string
          message?: string | null
          next_action?: string | null
          next_action_at?: string | null
          phone: string
          preferred_slot?: string | null
          priority?: string | null
          reference: string
          shop_name: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          consent?: boolean
          created_at?: string
          email?: string
          establishments_count?: number | null
          first_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          ip?: string | null
          last_name?: string
          message?: string | null
          next_action?: string | null
          next_action_at?: string | null
          phone?: string
          preferred_slot?: string | null
          priority?: string | null
          reference?: string
          shop_name?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          archived_at: string | null
          brand: string | null
          color: string | null
          created_at: string
          created_by: string | null
          customer_description: string | null
          customer_id: string
          device_type: Database["public"]["Enums"]["device_type"]
          id: string
          imei: string | null
          internal_notes: string | null
          model: string | null
          operating_system: string | null
          purchase_date: string | null
          serial_number: string | null
          shop_id: string
          updated_at: string
          warranty_end_date: string | null
        }
        Insert: {
          archived_at?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          customer_description?: string | null
          customer_id: string
          device_type?: Database["public"]["Enums"]["device_type"]
          id?: string
          imei?: string | null
          internal_notes?: string | null
          model?: string | null
          operating_system?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          shop_id: string
          updated_at?: string
          warranty_end_date?: string | null
        }
        Update: {
          archived_at?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          customer_description?: string | null
          customer_id?: string
          device_type?: Database["public"]["Enums"]["device_type"]
          id?: string
          imei?: string | null
          internal_notes?: string | null
          model?: string | null
          operating_system?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          shop_id?: string
          updated_at?: string
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      document_number_counters: {
        Row: {
          kind: Database["public"]["Enums"]["document_number_kind"]
          next_value: number
          shop_id: string
          year: number
        }
        Insert: {
          kind: Database["public"]["Enums"]["document_number_kind"]
          next_value?: number
          shop_id: string
          year: number
        }
        Update: {
          kind?: Database["public"]["Enums"]["document_number_kind"]
          next_value?: number
          shop_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_number_counters_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_number_counters_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      electronic_invoice_events: {
        Row: {
          event_type: string
          external_reference: string | null
          id: string
          invoice_id: string | null
          occurred_at: string | null
          payload_metadata: Json | null
          provider: string | null
          recorded_at: string
          status: string | null
        }
        Insert: {
          event_type: string
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          occurred_at?: string | null
          payload_metadata?: Json | null
          provider?: string | null
          recorded_at?: string
          status?: string | null
        }
        Update: {
          event_type?: string
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          occurred_at?: string | null
          payload_metadata?: Json | null
          provider?: string | null
          recorded_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electronic_invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      import_audit_logs: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          job_id: string | null
          shop_id: string
        }
        Insert: {
          action: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          job_id?: string | null
          shop_id: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          job_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_audit_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_audit_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_audit_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      import_beta_feedback: {
        Row: {
          allow_contact: boolean
          comment: string | null
          created_at: string
          id: string
          job_id: string
          missing_feature: string | null
          poorly_recognized: string | null
          rating_ease: number | null
          rating_recognition: number | null
          shop_id: string
          submitted_by: string | null
          time_saved_minutes: number | null
        }
        Insert: {
          allow_contact?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          job_id: string
          missing_feature?: string | null
          poorly_recognized?: string | null
          rating_ease?: number | null
          rating_recognition?: number | null
          shop_id: string
          submitted_by?: string | null
          time_saved_minutes?: number | null
        }
        Update: {
          allow_contact?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          job_id?: string
          missing_feature?: string | null
          poorly_recognized?: string | null
          rating_ease?: number | null
          rating_recognition?: number | null
          shop_id?: string
          submitted_by?: string | null
          time_saved_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_beta_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_beta_feedback_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_beta_feedback_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      import_files: {
        Row: {
          created_at: string
          id: string
          job_id: string
          kind: Database["public"]["Enums"]["import_file_kind"]
          mime_type: string
          original_name: string
          parsed_summary: Json | null
          scan_status: string
          sha256: string | null
          shop_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          kind?: Database["public"]["Enums"]["import_file_kind"]
          mime_type: string
          original_name: string
          parsed_summary?: Json | null
          scan_status?: string
          sha256?: string | null
          shop_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          kind?: Database["public"]["Enums"]["import_file_kind"]
          mime_type?: string
          original_name?: string
          parsed_summary?: Json | null
          scan_status?: string
          sha256?: string | null
          shop_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_files_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_files_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          ai_summary: Json | null
          bpei_assignee_user_id: string | null
          bpei_assistance_requested_at: string | null
          bpei_assistance_status: string
          bpei_assisted: boolean
          bpei_authorized_at: string | null
          bpei_authorized_by: string | null
          bpei_notes: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          error: string | null
          generation_lock_token: string | null
          generation_started_at: string | null
          id: string
          kind: Database["public"]["Enums"]["import_job_kind"]
          metric_ai_cost_cents: number | null
          metric_ai_ms: number | null
          metric_file_bytes: number | null
          metric_file_format: string | null
          metric_final_outcome: string | null
          metric_generation_ms: number | null
          metric_parse_ms: number | null
          metric_rows_duplicates: number | null
          metric_rows_errors: number | null
          metric_rows_manual_fixes: number | null
          metric_rows_recognized: number | null
          metric_rows_total: number | null
          notes: string | null
          rollback_available_until: string | null
          shop_id: string
          status: Database["public"]["Enums"]["import_job_status"]
          title: string | null
          totals: Json
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_digest: string | null
        }
        Insert: {
          ai_summary?: Json | null
          bpei_assignee_user_id?: string | null
          bpei_assistance_requested_at?: string | null
          bpei_assistance_status?: string
          bpei_assisted?: boolean
          bpei_authorized_at?: string | null
          bpei_authorized_by?: string | null
          bpei_notes?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          error?: string | null
          generation_lock_token?: string | null
          generation_started_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["import_job_kind"]
          metric_ai_cost_cents?: number | null
          metric_ai_ms?: number | null
          metric_file_bytes?: number | null
          metric_file_format?: string | null
          metric_final_outcome?: string | null
          metric_generation_ms?: number | null
          metric_parse_ms?: number | null
          metric_rows_duplicates?: number | null
          metric_rows_errors?: number | null
          metric_rows_manual_fixes?: number | null
          metric_rows_recognized?: number | null
          metric_rows_total?: number | null
          notes?: string | null
          rollback_available_until?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["import_job_status"]
          title?: string | null
          totals?: Json
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_digest?: string | null
        }
        Update: {
          ai_summary?: Json | null
          bpei_assignee_user_id?: string | null
          bpei_assistance_requested_at?: string | null
          bpei_assistance_status?: string
          bpei_assisted?: boolean
          bpei_authorized_at?: string | null
          bpei_authorized_by?: string | null
          bpei_notes?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error?: string | null
          generation_lock_token?: string | null
          generation_started_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["import_job_kind"]
          metric_ai_cost_cents?: number | null
          metric_ai_ms?: number | null
          metric_file_bytes?: number | null
          metric_file_format?: string | null
          metric_final_outcome?: string | null
          metric_generation_ms?: number | null
          metric_parse_ms?: number | null
          metric_rows_duplicates?: number | null
          metric_rows_errors?: number | null
          metric_rows_manual_fixes?: number | null
          metric_rows_recognized?: number | null
          metric_rows_total?: number | null
          notes?: string | null
          rollback_available_until?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          title?: string | null
          totals?: Json
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_digest?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      import_row_notes: {
        Row: {
          author_role: string
          author_user_id: string
          created_at: string
          id: string
          job_id: string
          note: string
          row_id: string
          shop_id: string
          suggested: Json | null
        }
        Insert: {
          author_role: string
          author_user_id: string
          created_at?: string
          id?: string
          job_id: string
          note: string
          row_id: string
          shop_id: string
          suggested?: Json | null
        }
        Update: {
          author_role?: string
          author_user_id?: string
          created_at?: string
          id?: string
          job_id?: string
          note?: string
          row_id?: string
          shop_id?: string
          suggested?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_row_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_row_notes_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_row_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_row_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          duplicate_of: string | null
          entity_kind: string
          errors: Json | null
          file_id: string | null
          id: string
          imported_at: string | null
          job_id: string
          normalized: Json
          raw: Json
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          source_index: number | null
          status: Database["public"]["Enums"]["import_row_status"]
          suggested: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          created_at?: string
          duplicate_of?: string | null
          entity_kind: string
          errors?: Json | null
          file_id?: string | null
          id?: string
          imported_at?: string | null
          job_id: string
          normalized?: Json
          raw?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          source_index?: number | null
          status?: Database["public"]["Enums"]["import_row_status"]
          suggested?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          created_at?: string
          duplicate_of?: string | null
          entity_kind?: string
          errors?: Json | null
          file_id?: string | null
          id?: string
          imported_at?: string | null
          job_id?: string
          normalized?: Json
          raw?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          source_index?: number | null
          status?: Database["public"]["Enums"]["import_row_status"]
          suggested?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "import_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      import_site_drafts: {
        Row: {
          ai_notes: string | null
          created_at: string
          draft: Json
          id: string
          job_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          created_at?: string
          draft?: Json
          id?: string
          job_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          created_at?: string
          draft?: Json
          id?: string
          job_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_site_drafts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_site_drafts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_site_drafts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_requests: {
        Row: {
          acquisition_detail: string | null
          acquisition_source: string | null
          availability: string | null
          city: string
          company_name: string | null
          consent: boolean
          created_at: string
          description: string
          device_type: string | null
          email: string
          first_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          internal_note: string | null
          last_name: string
          phone: string
          postal_code: string
          preferred_mode: string | null
          problem_category: string | null
          reference: string
          referral_code: string | null
          requester_type: string
          status: string
          updated_at: string
          urgency: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          acquisition_detail?: string | null
          acquisition_source?: string | null
          availability?: string | null
          city: string
          company_name?: string | null
          consent?: boolean
          created_at?: string
          description: string
          device_type?: string | null
          email: string
          first_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          last_name: string
          phone: string
          postal_code: string
          preferred_mode?: string | null
          problem_category?: string | null
          reference: string
          referral_code?: string | null
          requester_type?: string
          status?: string
          updated_at?: string
          urgency?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          acquisition_detail?: string | null
          acquisition_source?: string | null
          availability?: string | null
          city?: string
          company_name?: string | null
          consent?: boolean
          created_at?: string
          description?: string
          device_type?: string | null
          email?: string
          first_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          last_name?: string
          phone?: string
          postal_code?: string
          preferred_mode?: string | null
          problem_category?: string | null
          reference?: string
          referral_code?: string | null
          requester_type?: string
          status?: string
          updated_at?: string
          urgency?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          description: string
          discount_percent: number
          display_order: number
          id: string
          invoice_id: string
          line_subtotal_cents: number
          line_tax_cents: number
          line_total_cents: number
          line_type: Database["public"]["Enums"]["document_line_type"]
          quantity: number
          shop_id: string
          tax_rate: number
          unit: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          description: string
          discount_percent?: number
          display_order?: number
          id?: string
          invoice_id: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          line_type?: Database["public"]["Enums"]["document_line_type"]
          quantity?: number
          shop_id: string
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string
          discount_percent?: number
          display_order?: number
          id?: string
          invoice_id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          line_type?: Database["public"]["Enums"]["document_line_type"]
          quantity?: number
          shop_id?: string
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          billing_identity_snapshot: Json | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_identity_snapshot: Json | null
          customer_message: string | null
          device_id: string | null
          discount_total_cents: number
          document_hash: string | null
          due_date: string | null
          id: string
          internal_notes: string | null
          invoice_number: string | null
          issue_date: string | null
          issued_at: string | null
          legal_mentions_snapshot: string | null
          locked_at: string | null
          paid_at: string | null
          payment_terms_snapshot: string | null
          quote_id: string | null
          repair_id: string | null
          sent_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_excluding_tax_cents: number
          tax_total_cents: number
          total_including_tax_cents: number
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          billing_identity_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          customer_message?: string | null
          device_id?: string | null
          discount_total_cents?: number
          document_hash?: string | null
          due_date?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number?: string | null
          issue_date?: string | null
          issued_at?: string | null
          legal_mentions_snapshot?: string | null
          locked_at?: string | null
          paid_at?: string | null
          payment_terms_snapshot?: string | null
          quote_id?: string | null
          repair_id?: string | null
          sent_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          total_including_tax_cents?: number
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          billing_identity_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          customer_message?: string | null
          device_id?: string | null
          discount_total_cents?: number
          document_hash?: string | null
          due_date?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number?: string | null
          issue_date?: string | null
          issued_at?: string | null
          legal_mentions_snapshot?: string | null
          locked_at?: string | null
          paid_at?: string | null
          payment_terms_snapshot?: string | null
          quote_id?: string | null
          repair_id?: string | null
          sent_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          total_including_tax_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          created_by: string | null
          id: string
          ip: string | null
          ip_hash: string
          reason: string
        }
        Insert: {
          blocked_until: string
          created_at?: string
          created_by?: string | null
          id?: string
          ip?: string | null
          ip_hash: string
          reason?: string
        }
        Update: {
          blocked_until?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ip?: string | null
          ip_hash?: string
          reason?: string
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          acceptance_type: string
          accepted_at: string
          content_hash: string | null
          document_code: string
          document_id: string | null
          document_version: number
          guest_identifier: string | null
          id: string
          ip_address_if_authorized: unknown
          order_id: string | null
          session_id: string | null
          shop_id: string | null
          user_agent_if_authorized: string | null
          user_id: string | null
        }
        Insert: {
          acceptance_type?: string
          accepted_at?: string
          content_hash?: string | null
          document_code: string
          document_id?: string | null
          document_version: number
          guest_identifier?: string | null
          id?: string
          ip_address_if_authorized?: unknown
          order_id?: string | null
          session_id?: string | null
          shop_id?: string | null
          user_agent_if_authorized?: string | null
          user_id?: string | null
        }
        Update: {
          acceptance_type?: string
          accepted_at?: string
          content_hash?: string | null
          document_code?: string
          document_id?: string | null
          document_version?: number
          guest_identifier?: string | null
          id?: string
          ip_address_if_authorized?: unknown
          order_id?: string | null
          session_id?: string | null
          shop_id?: string | null
          user_agent_if_authorized?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_decisions: {
        Row: {
          consequences: string | null
          created_at: string
          created_by: string | null
          decision_date: string | null
          description: string | null
          effective_date: string | null
          id: string
          impacted_documents: string[] | null
          impacted_features: string[] | null
          justification: string | null
          options_considered: string | null
          reviewed_by: string | null
          selected_option: string | null
          status: string
          subject: string | null
          supersedes: string | null
          title: string
          updated_at: string
          validation_required_from: string | null
        }
        Insert: {
          consequences?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          impacted_documents?: string[] | null
          impacted_features?: string[] | null
          justification?: string | null
          options_considered?: string | null
          reviewed_by?: string | null
          selected_option?: string | null
          status?: string
          subject?: string | null
          supersedes?: string | null
          title: string
          updated_at?: string
          validation_required_from?: string | null
        }
        Update: {
          consequences?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string
          impacted_documents?: string[] | null
          impacted_features?: string[] | null
          justification?: string | null
          options_considered?: string | null
          reviewed_by?: string | null
          selected_option?: string | null
          status?: string
          subject?: string | null
          supersedes?: string | null
          title?: string
          updated_at?: string
          validation_required_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_decisions_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "legal_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          archived_at: string | null
          audience: string
          content: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          document_code: string
          effective_date: string | null
          id: string
          language: string
          previous_version_id: string | null
          published_at: string | null
          published_by: string | null
          requires_acceptance: boolean
          requires_reacceptance: boolean
          restored_from_version_id: string | null
          reviewed_by: string | null
          scope: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          audience?: string
          content?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          document_code: string
          effective_date?: string | null
          id?: string
          language?: string
          previous_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          requires_acceptance?: boolean
          requires_reacceptance?: boolean
          restored_from_version_id?: string | null
          reviewed_by?: string | null
          scope?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          audience?: string
          content?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          document_code?: string
          effective_date?: string | null
          id?: string
          language?: string
          previous_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          requires_acceptance?: boolean
          requires_reacceptance?: boolean
          restored_from_version_id?: string | null
          reviewed_by?: string | null
          scope?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_restored_from_version_id_fkey"
            columns: ["restored_from_version_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_role_definitions: {
        Row: {
          activation_status: string
          applicable_contracts: string[] | null
          contracting_party: string | null
          created_at: string
          created_by: string | null
          customer_role: string | null
          customer_support_party: string | null
          effective_date: string | null
          feature_category: string | null
          feature_code: string
          feature_name: string
          id: string
          independent_role: string | null
          invoicing_party: string | null
          legal_validation_status: string
          notes: string | null
          operational_responsibility: string | null
          platform_role: string | null
          required_insurances: string[] | null
          rgpd_platform_role: string | null
          rgpd_professional_role: string | null
          service_provider_role: string | null
          shop_role: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          activation_status?: string
          applicable_contracts?: string[] | null
          contracting_party?: string | null
          created_at?: string
          created_by?: string | null
          customer_role?: string | null
          customer_support_party?: string | null
          effective_date?: string | null
          feature_category?: string | null
          feature_code: string
          feature_name: string
          id?: string
          independent_role?: string | null
          invoicing_party?: string | null
          legal_validation_status?: string
          notes?: string | null
          operational_responsibility?: string | null
          platform_role?: string | null
          required_insurances?: string[] | null
          rgpd_platform_role?: string | null
          rgpd_professional_role?: string | null
          service_provider_role?: string | null
          shop_role?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          activation_status?: string
          applicable_contracts?: string[] | null
          contracting_party?: string | null
          created_at?: string
          created_by?: string | null
          customer_role?: string | null
          customer_support_party?: string | null
          effective_date?: string | null
          feature_category?: string | null
          feature_code?: string
          feature_name?: string
          id?: string
          independent_role?: string | null
          invoicing_party?: string | null
          legal_validation_status?: string
          notes?: string | null
          operational_responsibility?: string | null
          platform_role?: string | null
          required_insurances?: string[] | null
          rgpd_platform_role?: string | null
          rgpd_professional_role?: string | null
          service_provider_role?: string | null
          shop_role?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          category: string | null
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          shop_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          category?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          shop_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          shop_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_orders: {
        Row: {
          address: string | null
          cancellation_terms: string | null
          compensation_independent: number | null
          confidentiality: string | null
          created_at: string
          created_by: string | null
          customer_contracting_party: string | null
          customer_id: string | null
          deadlines: string | null
          deliverables: string | null
          device_details: string | null
          entrusted_material: string | null
          expenses: string | null
          framework_agreement_id: string | null
          id: string
          independent_acceptance_hash: string | null
          independent_accepted_at: string | null
          independent_user_id: string
          insurance_requirements: string | null
          liability_terms: string | null
          price_customer: number | null
          reference: string
          report_requirements: string | null
          reservations: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_details: string | null
          shop_id: string
          status: string
          subject: string | null
          transmitted_data: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancellation_terms?: string | null
          compensation_independent?: number | null
          confidentiality?: string | null
          created_at?: string
          created_by?: string | null
          customer_contracting_party?: string | null
          customer_id?: string | null
          deadlines?: string | null
          deliverables?: string | null
          device_details?: string | null
          entrusted_material?: string | null
          expenses?: string | null
          framework_agreement_id?: string | null
          id?: string
          independent_acceptance_hash?: string | null
          independent_accepted_at?: string | null
          independent_user_id: string
          insurance_requirements?: string | null
          liability_terms?: string | null
          price_customer?: number | null
          reference: string
          report_requirements?: string | null
          reservations?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_details?: string | null
          shop_id: string
          status?: string
          subject?: string | null
          transmitted_data?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancellation_terms?: string | null
          compensation_independent?: number | null
          confidentiality?: string | null
          created_at?: string
          created_by?: string | null
          customer_contracting_party?: string | null
          customer_id?: string | null
          deadlines?: string | null
          deliverables?: string | null
          device_details?: string | null
          entrusted_material?: string | null
          expenses?: string | null
          framework_agreement_id?: string | null
          id?: string
          independent_acceptance_hash?: string | null
          independent_accepted_at?: string | null
          independent_user_id?: string
          insurance_requirements?: string | null
          liability_terms?: string | null
          price_customer?: number | null
          reference?: string
          report_requirements?: string | null
          reservations?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_details?: string | null
          shop_id?: string
          status?: string
          subject?: string | null
          transmitted_data?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_orders_framework_agreement_id_fkey"
            columns: ["framework_agreement_id"]
            isOneToOne: false
            referencedRelation: "shop_independent_framework_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link_url: string | null
          read_at: string | null
          shop_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link_url?: string | null
          read_at?: string | null
          shop_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link_url?: string | null
          read_at?: string | null
          shop_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          line_subtotal_cents: number
          line_tax_cents: number
          line_total_cents: number
          name: string
          order_id: string
          quantity: number
          service_id: string | null
          shop_id: string
          stock_item_id: string | null
          tax_rate: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          name: string
          order_id: string
          quantity?: number
          service_id?: string | null
          shop_id: string
          stock_item_id?: string | null
          tax_rate?: number
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          name?: string
          order_id?: string
          quantity?: number
          service_id?: string | null
          shop_id?: string
          stock_item_id?: string | null
          tax_rate?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          author_name: string | null
          author_type: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          order_id: string
          read_by_customer_at: string | null
          read_by_shop_at: string | null
          shop_id: string
        }
        Insert: {
          author_name?: string | null
          author_type: string
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          order_id: string
          read_by_customer_at?: string | null
          read_by_shop_at?: string | null
          shop_id: string
        }
        Update: {
          author_name?: string | null
          author_type?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          read_by_customer_at?: string | null
          read_by_shop_at?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          currency: string
          customer_id: string | null
          delivered_at: string | null
          fulfillment_mode: string
          id: string
          ip_hash: string | null
          notes: string | null
          order_number: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          public_token: string
          ready_at: string | null
          shop_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivered_at?: string | null
          fulfillment_mode?: string
          id?: string
          ip_hash?: string | null
          notes?: string | null
          order_number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          public_token?: string
          ready_at?: string | null
          shop_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivered_at?: string | null
          fulfillment_mode?: string
          id?: string
          ip_hash?: string | null
          notes?: string | null
          order_number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          public_token?: string
          ready_at?: string | null
          shop_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          application_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
          reason: string | null
          shop_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          application_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          reason?: string | null
          shop_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          application_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          reason?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "shop_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_audit_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_audit_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link_url: string | null
          read_at: string | null
          read_by: string | null
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link_url?: string | null
          read_at?: string | null
          read_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link_url?: string | null
          read_at?: string | null
          read_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      partner_agreement_events: {
        Row: {
          actor_user_id: string | null
          agreement_id: string
          created_at: string
          details: Json | null
          event_type: string
          id: string
        }
        Insert: {
          actor_user_id?: string | null
          agreement_id: string
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          actor_user_id?: string | null
          agreement_id?: string
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_agreement_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "partner_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_agreement_versions: {
        Row: {
          agreement_id: string
          became_active_at: string | null
          change_summary: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          id: string
          independent_accepted_at: string | null
          independent_accepted_by: string | null
          shop_accepted_at: string | null
          shop_accepted_by: string | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          agreement_id: string
          became_active_at?: string | null
          change_summary?: string | null
          content_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          independent_accepted_at?: string | null
          independent_accepted_by?: string | null
          shop_accepted_at?: string | null
          shop_accepted_by?: string | null
          snapshot: Json
          version_number: number
        }
        Update: {
          agreement_id?: string
          became_active_at?: string | null
          change_summary?: string | null
          content_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          independent_accepted_at?: string | null
          independent_accepted_by?: string | null
          shop_accepted_at?: string | null
          shop_accepted_by?: string | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_agreement_versions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "partner_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_agreements: {
        Row: {
          application_id: string | null
          became_active_at: string | null
          compensation_details: string | null
          compensation_model: string | null
          created_at: string
          created_by: string | null
          current_version: number
          end_date: string | null
          exclusivity_kind: string
          id: string
          independent_shop_id: string
          independent_signed_at: string | null
          opportunity_id: string | null
          requires_exclusivity: boolean
          scope: string | null
          shop_id: string
          shop_signed_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["partner_agreement_status"]
          suspended_by: string | null
          suspended_reason: string | null
          terminated_at: string | null
          terminated_reason: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          application_id?: string | null
          became_active_at?: string | null
          compensation_details?: string | null
          compensation_model?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          end_date?: string | null
          exclusivity_kind?: string
          id?: string
          independent_shop_id: string
          independent_signed_at?: string | null
          opportunity_id?: string | null
          requires_exclusivity?: boolean
          scope?: string | null
          shop_id: string
          shop_signed_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["partner_agreement_status"]
          suspended_by?: string | null
          suspended_reason?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          application_id?: string | null
          became_active_at?: string | null
          compensation_details?: string | null
          compensation_model?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          end_date?: string | null
          exclusivity_kind?: string
          id?: string
          independent_shop_id?: string
          independent_signed_at?: string | null
          opportunity_id?: string | null
          requires_exclusivity?: boolean
          scope?: string | null
          shop_id?: string
          shop_signed_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["partner_agreement_status"]
          suspended_by?: string | null
          suspended_reason?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_agreements_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "partner_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_agreements_independent_shop_id_fkey"
            columns: ["independent_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_agreements_independent_shop_id_fkey"
            columns: ["independent_shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_agreements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "partner_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_agreements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_agreements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          applied_by: string | null
          created_at: string
          id: string
          independent_shop_id: string
          message: string | null
          opportunity_id: string
          proposed_rate: string | null
          review_notes: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["partner_application_status"]
          updated_at: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          id?: string
          independent_shop_id: string
          message?: string | null
          opportunity_id: string
          proposed_rate?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["partner_application_status"]
          updated_at?: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          id?: string
          independent_shop_id?: string
          message?: string | null
          opportunity_id?: string
          proposed_rate?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["partner_application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_independent_shop_id_fkey"
            columns: ["independent_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_independent_shop_id_fkey"
            columns: ["independent_shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "partner_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_missions: {
        Row: {
          accepted_at: string | null
          agreement_id: string | null
          assigned_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          city: string | null
          compensation_amount_cents: number | null
          compensation_model: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_reference: string | null
          description: string | null
          id: string
          independent_notes: string | null
          independent_shop_id: string
          opportunity_id: string | null
          postal_code: string | null
          response_deadline: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_category: string | null
          shop_id: string
          shop_notes: string | null
          started_at: string | null
          status: string
          title: string
          travel_fee_cents: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agreement_id?: string | null
          assigned_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city?: string | null
          compensation_amount_cents?: number | null
          compensation_model?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_reference?: string | null
          description?: string | null
          id?: string
          independent_notes?: string | null
          independent_shop_id: string
          opportunity_id?: string | null
          postal_code?: string | null
          response_deadline?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_category?: string | null
          shop_id: string
          shop_notes?: string | null
          started_at?: string | null
          status?: string
          title: string
          travel_fee_cents?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agreement_id?: string | null
          assigned_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city?: string | null
          compensation_amount_cents?: number | null
          compensation_model?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_reference?: string | null
          description?: string | null
          id?: string
          independent_notes?: string | null
          independent_shop_id?: string
          opportunity_id?: string | null
          postal_code?: string | null
          response_deadline?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_category?: string | null
          shop_id?: string
          shop_notes?: string | null
          started_at?: string | null
          status?: string
          title?: string
          travel_fee_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_missions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "partner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_missions_independent_shop_id_fkey"
            columns: ["independent_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_missions_independent_shop_id_fkey"
            columns: ["independent_shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_missions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "partner_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_missions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_missions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_opportunities: {
        Row: {
          compensation_details: string | null
          compensation_model: string | null
          covered_cities: string[]
          covered_postal_codes: string[]
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          invited_partner_shop_ids: string[]
          min_availability: string | null
          require_verified: boolean
          requires_exclusivity: boolean
          shop_id: string
          specialties: string[]
          status: Database["public"]["Enums"]["partner_opportunity_status"]
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          compensation_details?: string | null
          compensation_model?: string | null
          covered_cities?: string[]
          covered_postal_codes?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          invited_partner_shop_ids?: string[]
          min_availability?: string | null
          require_verified?: boolean
          requires_exclusivity?: boolean
          shop_id: string
          specialties?: string[]
          status?: Database["public"]["Enums"]["partner_opportunity_status"]
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          compensation_details?: string | null
          compensation_model?: string | null
          covered_cities?: string[]
          covered_postal_codes?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          invited_partner_shop_ids?: string[]
          min_availability?: string | null
          require_verified?: boolean
          requires_exclusivity?: boolean
          shop_id?: string
          specialties?: string[]
          status?: Database["public"]["Enums"]["partner_opportunity_status"]
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_opportunities_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_opportunities_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          accepted_methods: string[]
          amount_cents: number
          bank_reference: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          expires_at: string | null
          id: string
          invoice_id: string | null
          label: string | null
          paid_at: string | null
          paid_payment_id: string | null
          repair_id: string | null
          sale_id: string | null
          shop_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_methods?: string[]
          amount_cents: number
          bank_reference: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          label?: string | null
          paid_at?: string | null
          paid_payment_id?: string | null
          repair_id?: string | null
          sale_id?: string | null
          shop_id: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_methods?: string[]
          amount_cents?: number
          bank_reference?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          label?: string | null
          paid_at?: string | null
          paid_payment_id?: string | null
          repair_id?: string | null
          sale_id?: string | null
          shop_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_paid_payment_id_fkey"
            columns: ["paid_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          card_brand: string | null
          card_last4: string | null
          connector_type: string
          created_at: string
          currency: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          livemode: boolean | null
          local_state: string | null
          method: Database["public"]["Enums"]["payment_method"]
          mixed_parent_id: string | null
          notes: string | null
          paid_at: string
          platform_fee_cents: number | null
          provider: string
          provider_reference: string | null
          recorded_by: string | null
          reference: string | null
          refunded_amount_cents: number
          repair_id: string | null
          sale_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_account_id: string | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_reader_id: string | null
          stripe_refund_id: string | null
          terminal_completed_at: string | null
          terminal_id: string | null
          terminal_last_error: string | null
          terminal_started_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          card_brand?: string | null
          card_last4?: string | null
          connector_type?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          livemode?: boolean | null
          local_state?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          mixed_parent_id?: string | null
          notes?: string | null
          paid_at?: string
          platform_fee_cents?: number | null
          provider?: string
          provider_reference?: string | null
          recorded_by?: string | null
          reference?: string | null
          refunded_amount_cents?: number
          repair_id?: string | null
          sale_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_account_id?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_reader_id?: string | null
          stripe_refund_id?: string | null
          terminal_completed_at?: string | null
          terminal_id?: string | null
          terminal_last_error?: string | null
          terminal_started_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          card_brand?: string | null
          card_last4?: string | null
          connector_type?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          livemode?: boolean | null
          local_state?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          mixed_parent_id?: string | null
          notes?: string | null
          paid_at?: string
          platform_fee_cents?: number | null
          provider?: string
          provider_reference?: string | null
          recorded_by?: string | null
          reference?: string | null
          refunded_amount_cents?: number
          repair_id?: string | null
          sale_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_account_id?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_reader_id?: string | null
          stripe_refund_id?: string | null
          terminal_completed_at?: string | null
          terminal_id?: string | null
          terminal_last_error?: string | null
          terminal_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_mixed_parent_id_fkey"
            columns: ["mixed_parent_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_platform_roles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
        }
        Relationships: []
      }
      platform_feature_flags: {
        Row: {
          configuration: Json | null
          created_at: string
          enabled: boolean
          environment: string
          feature_key: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          enabled?: boolean
          environment: string
          feature_key: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          enabled?: boolean
          environment?: string
          feature_key?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_insurance_records: {
        Row: {
          coverage_amount: number | null
          covered_activities: string[] | null
          created_at: string
          deductible: number | null
          document_path: string | null
          expiration_date: string | null
          id: string
          insurance_type: string
          last_reviewed_at: string | null
          notes: string | null
          policy_number: string | null
          provider: string | null
          start_date: string | null
          status: string
          territory: string | null
          updated_at: string
        }
        Insert: {
          coverage_amount?: number | null
          covered_activities?: string[] | null
          created_at?: string
          deductible?: number | null
          document_path?: string | null
          expiration_date?: string | null
          id?: string
          insurance_type: string
          last_reviewed_at?: string | null
          notes?: string | null
          policy_number?: string | null
          provider?: string | null
          start_date?: string | null
          status?: string
          territory?: string | null
          updated_at?: string
        }
        Update: {
          coverage_amount?: number | null
          covered_activities?: string[] | null
          created_at?: string
          deductible?: number | null
          document_path?: string | null
          expiration_date?: string | null
          id?: string
          insurance_type?: string
          last_reviewed_at?: string | null
          notes?: string | null
          policy_number?: string | null
          provider?: string | null
          start_date?: string | null
          status?: string
          territory?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_legal_settings: {
        Row: {
          capital_amount: string | null
          commercial_name: string | null
          competent_court_information: string | null
          complaint_email: string | null
          complaint_postal_address: string | null
          data_protection_officer_email: string | null
          data_protection_officer_name: string | null
          governing_law: string | null
          hosting_provider_address: string | null
          hosting_provider_name: string | null
          hosting_provider_phone: string | null
          hosting_provider_website: string | null
          id: string
          legal_form: string | null
          legal_name: string | null
          legal_representative_name: string | null
          mediator_address: string | null
          mediator_name: string | null
          mediator_website: string | null
          privacy_contact_email: string | null
          professional_email: string | null
          professional_insurance_coverage_area: string | null
          professional_insurance_name: string | null
          professional_insurance_policy_reference: string | null
          professional_phone: string | null
          publication_director_name: string | null
          rcs_city: string | null
          registered_office_address: string | null
          registered_office_city: string | null
          registered_office_country: string | null
          registered_office_postal_code: string | null
          rne_registration: string | null
          singleton: boolean
          siren: string | null
          siret: string | null
          support_email: string | null
          updated_at: string
          updated_by: string | null
          vat_number: string | null
        }
        Insert: {
          capital_amount?: string | null
          commercial_name?: string | null
          competent_court_information?: string | null
          complaint_email?: string | null
          complaint_postal_address?: string | null
          data_protection_officer_email?: string | null
          data_protection_officer_name?: string | null
          governing_law?: string | null
          hosting_provider_address?: string | null
          hosting_provider_name?: string | null
          hosting_provider_phone?: string | null
          hosting_provider_website?: string | null
          id?: string
          legal_form?: string | null
          legal_name?: string | null
          legal_representative_name?: string | null
          mediator_address?: string | null
          mediator_name?: string | null
          mediator_website?: string | null
          privacy_contact_email?: string | null
          professional_email?: string | null
          professional_insurance_coverage_area?: string | null
          professional_insurance_name?: string | null
          professional_insurance_policy_reference?: string | null
          professional_phone?: string | null
          publication_director_name?: string | null
          rcs_city?: string | null
          registered_office_address?: string | null
          registered_office_city?: string | null
          registered_office_country?: string | null
          registered_office_postal_code?: string | null
          rne_registration?: string | null
          singleton?: boolean
          siren?: string | null
          siret?: string | null
          support_email?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
        }
        Update: {
          capital_amount?: string | null
          commercial_name?: string | null
          competent_court_information?: string | null
          complaint_email?: string | null
          complaint_postal_address?: string | null
          data_protection_officer_email?: string | null
          data_protection_officer_name?: string | null
          governing_law?: string | null
          hosting_provider_address?: string | null
          hosting_provider_name?: string | null
          hosting_provider_phone?: string | null
          hosting_provider_website?: string | null
          id?: string
          legal_form?: string | null
          legal_name?: string | null
          legal_representative_name?: string | null
          mediator_address?: string | null
          mediator_name?: string | null
          mediator_website?: string | null
          privacy_contact_email?: string | null
          professional_email?: string | null
          professional_insurance_coverage_area?: string | null
          professional_insurance_name?: string | null
          professional_insurance_policy_reference?: string | null
          professional_phone?: string | null
          publication_director_name?: string | null
          rcs_city?: string | null
          registered_office_address?: string | null
          registered_office_city?: string | null
          registered_office_country?: string | null
          registered_office_postal_code?: string | null
          rne_registration?: string | null
          singleton?: boolean
          siren?: string | null
          siret?: string | null
          support_email?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      platform_probe_test_flags: {
        Row: {
          fail_consumer_keys: string[]
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fail_consumer_keys?: string[]
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fail_consumer_keys?: string[]
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_public_settings: {
        Row: {
          draft: Json
          draft_updated_at: string
          draft_updated_by: string | null
          id: number
          published: Json
          published_at: string | null
          published_by: string | null
          published_version: number
        }
        Insert: {
          draft?: Json
          draft_updated_at?: string
          draft_updated_by?: string | null
          id?: number
          published?: Json
          published_at?: string | null
          published_by?: string | null
          published_version?: number
        }
        Update: {
          draft?: Json
          draft_updated_at?: string
          draft_updated_by?: string | null
          id?: number
          published?: Json
          published_at?: string | null
          published_by?: string | null
          published_version?: number
        }
        Relationships: []
      }
      platform_settings_consumer_status: {
        Row: {
          attempts: number
          consumer_key: string
          created_at: string
          expected_version: number
          id: string
          is_essential: boolean
          last_attempt_at: string | null
          last_checked_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          observed_version: number | null
          publication_id: string
          status: string
        }
        Insert: {
          attempts?: number
          consumer_key: string
          created_at?: string
          expected_version: number
          id?: string
          is_essential?: boolean
          last_attempt_at?: string | null
          last_checked_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          observed_version?: number | null
          publication_id: string
          status?: string
        }
        Update: {
          attempts?: number
          consumer_key?: string
          created_at?: string
          expected_version?: number
          id?: string
          is_essential?: boolean
          last_attempt_at?: string | null
          last_checked_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          observed_version?: number | null
          publication_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_consumer_status_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "platform_settings_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings_publications: {
        Row: {
          changed_fields: string[]
          id: string
          note: string | null
          published_at: string
          published_by: string | null
          restored_from_version: number | null
          rollback_of: string | null
          rollback_reason: string | null
          snapshot: Json
          status: string
          version: number
        }
        Insert: {
          changed_fields?: string[]
          id?: string
          note?: string | null
          published_at?: string
          published_by?: string | null
          restored_from_version?: number | null
          rollback_of?: string | null
          rollback_reason?: string | null
          snapshot: Json
          status?: string
          version: number
        }
        Update: {
          changed_fields?: string[]
          id?: string
          note?: string | null
          published_at?: string
          published_by?: string | null
          restored_from_version?: number | null
          rollback_of?: string | null
          rollback_reason?: string | null
          snapshot?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_publications_rollback_of_fkey"
            columns: ["rollback_of"]
            isOneToOne: false
            referencedRelation: "platform_settings_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          handled_by: string | null
          id: string
          identity_verification: string | null
          request_number: string
          request_type: string
          requester_email: string
          requester_full_name: string
          requester_user_id: string | null
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          handled_by?: string | null
          id?: string
          identity_verification?: string | null
          request_number?: string
          request_type: string
          requester_email: string
          requester_full_name: string
          requester_user_id?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          handled_by?: string | null
          id?: string
          identity_verification?: string | null
          request_number?: string
          request_type?: string
          requester_email?: string
          requester_full_name?: string
          requester_user_id?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      processing_activity_roles: {
        Row: {
          created_at: string
          data_categories: string[] | null
          data_subjects: string[] | null
          dpa_required: boolean
          dpia_review_required: boolean
          id: string
          joint_controller_possible: boolean
          legal_basis: string | null
          platform_role: string
          processing_code: string
          processing_name: string
          professional_role: string
          purpose: string | null
          recipients: string[] | null
          retention_rule: string | null
          security_requirements: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          data_categories?: string[] | null
          data_subjects?: string[] | null
          dpa_required?: boolean
          dpia_review_required?: boolean
          id?: string
          joint_controller_possible?: boolean
          legal_basis?: string | null
          platform_role?: string
          processing_code: string
          processing_name: string
          professional_role?: string
          purpose?: string | null
          recipients?: string[] | null
          retention_rule?: string | null
          security_requirements?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          data_categories?: string[] | null
          data_subjects?: string[] | null
          dpa_required?: boolean
          dpia_review_required?: boolean
          id?: string
          joint_controller_possible?: boolean
          legal_basis?: string | null
          platform_role?: string
          processing_code?: string
          processing_name?: string
          professional_role?: string
          purpose?: string | null
          recipients?: string[] | null
          retention_rule?: string | null
          security_requirements?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      professional_verification_checks: {
        Row: {
          check_type: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          evidence_reference: string | null
          expires_at: string | null
          id: string
          notes: string | null
          professional_user_id: string | null
          result: string | null
          shop_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          check_type: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          evidence_reference?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          professional_user_id?: string | null
          result?: string | null
          shop_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          check_type?: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          evidence_reference?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          professional_user_id?: string | null
          result?: string | null
          shop_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_verification_checks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_verification_checks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          damaged_quantity: number
          id: string
          item_id: string | null
          name: string
          position: number
          purchase_order_id: string
          quantity: number
          received_quantity: number
          reception_notes: string | null
          shop_id: string
          sku: string | null
          snapshot_lead_days: number | null
          snapshot_min_order_qty: number | null
          snapshot_pack_qty: number | null
          snapshot_shipping_cents: number | null
          snapshot_supplier_product_name: string | null
          snapshot_supplier_reference: string | null
          stock_item_supplier_id: string | null
          tax_rate: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          damaged_quantity?: number
          id?: string
          item_id?: string | null
          name: string
          position?: number
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          reception_notes?: string | null
          shop_id: string
          sku?: string | null
          snapshot_lead_days?: number | null
          snapshot_min_order_qty?: number | null
          snapshot_pack_qty?: number | null
          snapshot_shipping_cents?: number | null
          snapshot_supplier_product_name?: string | null
          snapshot_supplier_reference?: string | null
          stock_item_supplier_id?: string | null
          tax_rate?: number
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          damaged_quantity?: number
          id?: string
          item_id?: string | null
          name?: string
          position?: number
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          reception_notes?: string | null
          shop_id?: string
          sku?: string | null
          snapshot_lead_days?: number | null
          snapshot_min_order_qty?: number | null
          snapshot_pack_qty?: number | null
          snapshot_shipping_cents?: number | null
          snapshot_supplier_product_name?: string | null
          snapshot_supplier_reference?: string | null
          stock_item_supplier_id?: string | null
          tax_rate?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_stock_item_supplier_id_fkey"
            columns: ["stock_item_supplier_id"]
            isOneToOne: false
            referencedRelation: "stock_item_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["purchase_order_status"]
          note: string | null
          old_status:
            | Database["public"]["Enums"]["purchase_order_status"]
            | null
          purchase_order_id: string
          reason: string | null
          shop_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["purchase_order_status"]
          note?: string | null
          old_status?:
            | Database["public"]["Enums"]["purchase_order_status"]
            | null
          purchase_order_id: string
          reason?: string | null
          shop_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["purchase_order_status"]
          note?: string | null
          old_status?:
            | Database["public"]["Enums"]["purchase_order_status"]
            | null
          purchase_order_id?: string
          reason?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_status_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_status_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_status_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_note_reference: string | null
          expected_date: string | null
          id: string
          lines_snapshot: Json | null
          notes: string | null
          order_date: string
          received_date: string | null
          reference: string
          sent_at: string | null
          shop_id: string
          shop_snapshot: Json | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          supplier_reference: string | null
          supplier_snapshot: Json | null
          total_ht_cents: number
          total_ttc_cents: number
          updated_at: string
          variance_closed_at: string | null
          variance_closed_by: string | null
          variance_note: string | null
          variance_reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_note_reference?: string | null
          expected_date?: string | null
          id?: string
          lines_snapshot?: Json | null
          notes?: string | null
          order_date?: string
          received_date?: string | null
          reference: string
          sent_at?: string | null
          shop_id: string
          shop_snapshot?: Json | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          supplier_reference?: string | null
          supplier_snapshot?: Json | null
          total_ht_cents?: number
          total_ttc_cents?: number
          updated_at?: string
          variance_closed_at?: string | null
          variance_closed_by?: string | null
          variance_note?: string | null
          variance_reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_note_reference?: string | null
          expected_date?: string | null
          id?: string
          lines_snapshot?: Json | null
          notes?: string | null
          order_date?: string
          received_date?: string | null
          reference?: string
          sent_at?: string | null
          shop_id?: string
          shop_snapshot?: Json | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          supplier_reference?: string | null
          supplier_snapshot?: Json | null
          total_ht_cents?: number
          total_ttc_cents?: number
          updated_at?: string
          variance_closed_at?: string | null
          variance_closed_by?: string | null
          variance_note?: string | null
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          description: string
          discount_percent: number
          display_order: number
          id: string
          line_subtotal_cents: number
          line_tax_cents: number
          line_total_cents: number
          line_type: Database["public"]["Enums"]["document_line_type"]
          quantity: number
          quote_id: string
          shop_id: string
          tax_rate: number
          unit: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          description: string
          discount_percent?: number
          display_order?: number
          id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          line_type?: Database["public"]["Enums"]["document_line_type"]
          quantity?: number
          quote_id: string
          shop_id: string
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string
          discount_percent?: number
          display_order?: number
          id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          line_type?: Database["public"]["Enums"]["document_line_type"]
          quantity?: number
          quote_id?: string
          shop_id?: string
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_public_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          quote_id: string
          revoked_at: string | null
          shop_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          quote_id: string
          revoked_at?: string | null
          shop_id: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          quote_id?: string
          revoked_at?: string | null
          shop_id?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_public_tokens_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_public_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_public_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
          billing_identity_snapshot: Json | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_identity_snapshot: Json | null
          customer_message: string | null
          deposit_requested_cents: number
          device_id: string | null
          discount_total_cents: number
          document_hash: string | null
          id: string
          internal_notes: string | null
          issue_date: string | null
          locked_at: string | null
          quote_number: string | null
          refusal_reason: string | null
          refused_at: string | null
          repair_id: string | null
          sent_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_excluding_tax_cents: number
          tax_total_cents: number
          terms_snapshot: string | null
          total_including_tax_cents: number
          updated_at: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          billing_identity_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          customer_message?: string | null
          deposit_requested_cents?: number
          device_id?: string | null
          discount_total_cents?: number
          document_hash?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string | null
          locked_at?: string | null
          quote_number?: string | null
          refusal_reason?: string | null
          refused_at?: string | null
          repair_id?: string | null
          sent_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          terms_snapshot?: string | null
          total_including_tax_cents?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          billing_identity_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          customer_message?: string | null
          deposit_requested_cents?: number
          device_id?: string | null
          discount_total_cents?: number
          document_hash?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string | null
          locked_at?: string | null
          quote_number?: string | null
          refusal_reason?: string | null
          refused_at?: string | null
          repair_id?: string | null
          sent_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          terms_snapshot?: string | null
          total_including_tax_cents?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          count: number
          endpoint: string
          id: number
          scope_key: string
          scope_type: string
          window_start: string
        }
        Insert: {
          count?: number
          endpoint: string
          id?: number
          scope_key: string
          scope_type: string
          window_start: string
        }
        Update: {
          count?: number
          endpoint?: string
          id?: number
          scope_key?: string
          scope_type?: string
          window_start?: string
        }
        Relationships: []
      }
      repair_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          repair_id: string
          shop_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"]
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          repair_id: string
          shop_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          repair_id?: string
          shop_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "repair_notes_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_number_counters: {
        Row: {
          next_value: number
          shop_id: string
          year: number
        }
        Insert: {
          next_value?: number
          shop_id: string
          year: number
        }
        Update: {
          next_value?: number
          shop_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_number_counters_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_number_counters_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_public_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          repair_id: string
          revoked_at: string | null
          shop_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          repair_id: string
          revoked_at?: string | null
          shop_id: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          repair_id?: string
          revoked_at?: string | null
          shop_id?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_public_tokens_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: true
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_public_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_public_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_history: {
        Row: {
          changed_by: string | null
          comment: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["repair_status"]
          old_status: Database["public"]["Enums"]["repair_status"] | null
          repair_id: string
          shop_id: string
        }
        Insert: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["repair_status"]
          old_status?: Database["public"]["Enums"]["repair_status"] | null
          repair_id: string
          shop_id: string
        }
        Update: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["repair_status"]
          old_status?: Database["public"]["Enums"]["repair_status"] | null
          repair_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_history_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_status_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_status_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          accessories_received: string | null
          archived_at: string | null
          assigned_technician_id: string | null
          collected_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_issue: string | null
          customer_visible_notes: string | null
          device_id: string
          estimated_completion_at: string | null
          id: string
          initial_condition: string | null
          intake_channel: string | null
          internal_notes: string | null
          priority: Database["public"]["Enums"]["repair_priority"]
          repair_number: string
          shop_id: string
          status: Database["public"]["Enums"]["repair_status"]
          technical_diagnosis: string | null
          updated_at: string
          work_performed: string | null
        }
        Insert: {
          accessories_received?: string | null
          archived_at?: string | null
          assigned_technician_id?: string | null
          collected_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_issue?: string | null
          customer_visible_notes?: string | null
          device_id: string
          estimated_completion_at?: string | null
          id?: string
          initial_condition?: string | null
          intake_channel?: string | null
          internal_notes?: string | null
          priority?: Database["public"]["Enums"]["repair_priority"]
          repair_number: string
          shop_id: string
          status?: Database["public"]["Enums"]["repair_status"]
          technical_diagnosis?: string | null
          updated_at?: string
          work_performed?: string | null
        }
        Update: {
          accessories_received?: string | null
          archived_at?: string | null
          assigned_technician_id?: string | null
          collected_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_issue?: string | null
          customer_visible_notes?: string | null
          device_id?: string
          estimated_completion_at?: string | null
          id?: string
          initial_condition?: string | null
          intake_channel?: string | null
          internal_notes?: string | null
          priority?: Database["public"]["Enums"]["repair_priority"]
          repair_number?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["repair_status"]
          technical_diagnosis?: string | null
          updated_at?: string
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          customer_id: string | null
          id: string
          ip: string | null
          published_at: string | null
          rating: number
          rating_communication: number | null
          rating_quality: number | null
          rating_speed: number | null
          repair_id: string | null
          replied_at: string | null
          replied_by: string | null
          reply_text: string | null
          shop_id: string
          status: Database["public"]["Enums"]["review_status"]
          submitted_by_user_id: string | null
          title: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          published_at?: string | null
          rating: number
          rating_communication?: number | null
          rating_quality?: number | null
          rating_speed?: number | null
          repair_id?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_text?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_by_user_id?: string | null
          title?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          published_at?: string | null
          rating?: number
          rating_communication?: number | null
          rating_quality?: number | null
          rating_speed?: number | null
          repair_id?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_text?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_by_user_id?: string | null
          title?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_lines: {
        Row: {
          created_at: string
          description_snapshot: string | null
          discount_percent: number
          display_order: number
          id: string
          line_subtotal_cents: number
          line_tax_cents: number
          line_total_cents: number
          line_type: Database["public"]["Enums"]["sale_line_type"]
          name_snapshot: string
          note: string | null
          quantity: number
          repair_id: string | null
          sale_id: string
          service_catalog_id: string | null
          shop_id: string
          sku_snapshot: string | null
          stock_item_id: string | null
          tax_rate: number
          unit: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_snapshot?: string | null
          discount_percent?: number
          display_order?: number
          id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          line_type: Database["public"]["Enums"]["sale_line_type"]
          name_snapshot: string
          note?: string | null
          quantity?: number
          repair_id?: string | null
          sale_id: string
          service_catalog_id?: string | null
          shop_id: string
          sku_snapshot?: string | null
          stock_item_id?: string | null
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_snapshot?: string | null
          discount_percent?: number
          display_order?: number
          id?: string
          line_subtotal_cents?: number
          line_tax_cents?: number
          line_total_cents?: number
          line_type?: Database["public"]["Enums"]["sale_line_type"]
          name_snapshot?: string
          note?: string | null
          quantity?: number
          repair_id?: string | null
          sale_id?: string
          service_catalog_id?: string | null
          shop_id?: string
          sku_snapshot?: string | null
          stock_item_id?: string | null
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_lines_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          billing_identity_snapshot: Json | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_identity_snapshot: Json | null
          discount_total_cents: number
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          linked_order_id: string | null
          linked_quote_id: string | null
          linked_repair_id: string | null
          notes: string | null
          receipt_number: string | null
          sale_number: string | null
          seller_id: string | null
          shop_id: string
          source: Database["public"]["Enums"]["sale_source"]
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_excluding_tax_cents: number
          tax_total_cents: number
          total_including_tax_cents: number
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          billing_identity_snapshot?: Json | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          discount_total_cents?: number
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          linked_order_id?: string | null
          linked_quote_id?: string | null
          linked_repair_id?: string | null
          notes?: string | null
          receipt_number?: string | null
          sale_number?: string | null
          seller_id?: string | null
          shop_id: string
          source?: Database["public"]["Enums"]["sale_source"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          total_including_tax_cents?: number
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          billing_identity_snapshot?: Json | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_identity_snapshot?: Json | null
          discount_total_cents?: number
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          linked_order_id?: string | null
          linked_quote_id?: string | null
          linked_repair_id?: string | null
          notes?: string | null
          receipt_number?: string | null
          sale_number?: string | null
          seller_id?: string | null
          shop_id?: string
          source?: Database["public"]["Enums"]["sale_source"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_excluding_tax_cents?: number
          tax_total_cents?: number
          total_including_tax_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_linked_quote_id_fkey"
            columns: ["linked_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_linked_repair_id_fkey"
            columns: ["linked_repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          affected_data_categories: string[] | null
          affected_party_notification_status: string | null
          affected_shops: string[] | null
          affected_systems: string[] | null
          authority_notification_status: string | null
          containment_actions: string | null
          corrective_actions: string | null
          created_at: string
          description: string | null
          detected_at: string
          detected_by: string | null
          estimated_people_affected: number | null
          evidence: string | null
          id: string
          notification_required: boolean
          post_incident_review: string | null
          resolved_at: string | null
          risk_level: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_data_categories?: string[] | null
          affected_party_notification_status?: string | null
          affected_shops?: string[] | null
          affected_systems?: string[] | null
          authority_notification_status?: string | null
          containment_actions?: string | null
          corrective_actions?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          detected_by?: string | null
          estimated_people_affected?: number | null
          evidence?: string | null
          id?: string
          notification_required?: boolean
          post_incident_review?: string | null
          resolved_at?: string | null
          risk_level?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_data_categories?: string[] | null
          affected_party_notification_status?: string | null
          affected_shops?: string[] | null
          affected_systems?: string[] | null
          authority_notification_status?: string | null
          containment_actions?: string | null
          corrective_actions?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          detected_by?: string | null
          estimated_people_affected?: number | null
          evidence?: string | null
          id?: string
          notification_required?: boolean
          post_incident_review?: string | null
          resolved_at?: string | null
          risk_level?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_legal_profiles: {
        Row: {
          commercial_name: string | null
          consumer_service_email: string | null
          consumer_service_phone: string | null
          insurance_expiration: string | null
          insurance_name: string | null
          insurance_reference: string | null
          last_verified_at: string | null
          legal_form: string | null
          legal_name: string | null
          legal_status: string
          mediator_address: string | null
          mediator_name: string | null
          mediator_website: string | null
          next_review_at: string | null
          payment_account_identifier_masked: string | null
          payment_account_provider: string | null
          professional_email: string | null
          professional_phone: string | null
          rcs_or_rne_registration: string | null
          registered_address: string | null
          representative_name: string | null
          self_certification_accepted_at: string | null
          self_certification_version: string | null
          shop_id: string
          siren: string | null
          siret: string | null
          updated_at: string
          vat_number: string | null
          verified_by: string | null
        }
        Insert: {
          commercial_name?: string | null
          consumer_service_email?: string | null
          consumer_service_phone?: string | null
          insurance_expiration?: string | null
          insurance_name?: string | null
          insurance_reference?: string | null
          last_verified_at?: string | null
          legal_form?: string | null
          legal_name?: string | null
          legal_status?: string
          mediator_address?: string | null
          mediator_name?: string | null
          mediator_website?: string | null
          next_review_at?: string | null
          payment_account_identifier_masked?: string | null
          payment_account_provider?: string | null
          professional_email?: string | null
          professional_phone?: string | null
          rcs_or_rne_registration?: string | null
          registered_address?: string | null
          representative_name?: string | null
          self_certification_accepted_at?: string | null
          self_certification_version?: string | null
          shop_id: string
          siren?: string | null
          siret?: string | null
          updated_at?: string
          vat_number?: string | null
          verified_by?: string | null
        }
        Update: {
          commercial_name?: string | null
          consumer_service_email?: string | null
          consumer_service_phone?: string | null
          insurance_expiration?: string | null
          insurance_name?: string | null
          insurance_reference?: string | null
          last_verified_at?: string | null
          legal_form?: string | null
          legal_name?: string | null
          legal_status?: string
          mediator_address?: string | null
          mediator_name?: string | null
          mediator_website?: string | null
          next_review_at?: string | null
          payment_account_identifier_masked?: string | null
          payment_account_provider?: string | null
          professional_email?: string | null
          professional_phone?: string | null
          rcs_or_rne_registration?: string | null
          registered_address?: string | null
          representative_name?: string | null
          self_certification_accepted_at?: string | null
          self_certification_version?: string | null
          shop_id?: string
          siren?: string | null
          siret?: string | null
          updated_at?: string
          vat_number?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_legal_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_legal_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_module_access_log: {
        Row: {
          action: string | null
          created_at: string
          id: string
          module_code: string
          reason: string | null
          result: string
          route: string | null
          status_at_check: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          module_code: string
          reason?: string | null
          result: string
          route?: string | null
          status_at_check?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          module_code?: string
          reason?: string | null
          result?: string
          route?: string | null
          status_at_check?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sensitive_module_approvals: {
        Row: {
          accounting_review_required: boolean
          approved_at: string | null
          approved_by: string | null
          blockers: string | null
          created_at: string
          current_status: string
          expiration_or_review_date: string | null
          id: string
          insurance_review_required: boolean
          legal_review_required: boolean
          module_code: string
          module_name: string
          notes: string | null
          risk_level: string
          technical_audit_required: boolean
          updated_at: string
        }
        Insert: {
          accounting_review_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          blockers?: string | null
          created_at?: string
          current_status?: string
          expiration_or_review_date?: string | null
          id?: string
          insurance_review_required?: boolean
          legal_review_required?: boolean
          module_code: string
          module_name: string
          notes?: string | null
          risk_level?: string
          technical_audit_required?: boolean
          updated_at?: string
        }
        Update: {
          accounting_review_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          blockers?: string | null
          created_at?: string
          current_status?: string
          expiration_or_review_date?: string | null
          id?: string
          insurance_review_required?: boolean
          legal_review_required?: boolean
          module_code?: string
          module_name?: string
          notes?: string | null
          risk_level?: string
          technical_audit_required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          active: boolean
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          default_quantity: number
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          internal_reference: string | null
          line_type: Database["public"]["Enums"]["document_line_type"]
          name: string
          shop_id: string
          tax_rate: number
          unit: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_quantity?: number
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          internal_reference?: string | null
          line_type?: Database["public"]["Enums"]["document_line_type"]
          name: string
          shop_id: string
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_quantity?: number
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          internal_reference?: string | null
          line_type?: Database["public"]["Enums"]["document_line_type"]
          name?: string
          shop_id?: string
          tax_rate?: number
          unit?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_applications: {
        Row: {
          address: string | null
          business_type: Database["public"]["Enums"]["business_type"]
          city: string | null
          commercial_name: string
          consent_contact: boolean
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone: string | null
          covered_cities: string[]
          covered_postal_codes: string[]
          created_at: string
          description: string | null
          employees_count: number | null
          establishments_count: number | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          internal_notes: string | null
          legal_form: string | null
          legal_name: string | null
          linked_user_id: string | null
          main_services: string | null
          message: string | null
          postal_code: string | null
          professional_experience_years: number | null
          reference: string
          service_radius_km: number | null
          shop_id: string | null
          siren: string | null
          siret: string | null
          status: string
          travel_fee_amount_cents: number | null
          travel_fee_policy: string | null
          updated_at: string
          users_count: number | null
          vat_number: string | null
          wants_maintenance_contracts: boolean
          wants_partnerships: boolean
          wants_subcontracting: boolean
          website: string | null
        }
        Insert: {
          address?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          commercial_name: string
          consent_contact?: boolean
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone?: string | null
          covered_cities?: string[]
          covered_postal_codes?: string[]
          created_at?: string
          description?: string | null
          employees_count?: number | null
          establishments_count?: number | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          internal_notes?: string | null
          legal_form?: string | null
          legal_name?: string | null
          linked_user_id?: string | null
          main_services?: string | null
          message?: string | null
          postal_code?: string | null
          professional_experience_years?: number | null
          reference?: string
          service_radius_km?: number | null
          shop_id?: string | null
          siren?: string | null
          siret?: string | null
          status?: string
          travel_fee_amount_cents?: number | null
          travel_fee_policy?: string | null
          updated_at?: string
          users_count?: number | null
          vat_number?: string | null
          wants_maintenance_contracts?: boolean
          wants_partnerships?: boolean
          wants_subcontracting?: boolean
          website?: string | null
        }
        Update: {
          address?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          commercial_name?: string
          consent_contact?: boolean
          contact_email?: string
          contact_first_name?: string
          contact_last_name?: string
          contact_phone?: string | null
          covered_cities?: string[]
          covered_postal_codes?: string[]
          created_at?: string
          description?: string | null
          employees_count?: number | null
          establishments_count?: number | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          internal_notes?: string | null
          legal_form?: string | null
          legal_name?: string | null
          linked_user_id?: string | null
          main_services?: string | null
          message?: string | null
          postal_code?: string | null
          professional_experience_years?: number | null
          reference?: string
          service_radius_km?: number | null
          shop_id?: string | null
          siren?: string | null
          siret?: string | null
          status?: string
          travel_fee_amount_cents?: number | null
          travel_fee_policy?: string | null
          updated_at?: string
          users_count?: number | null
          vat_number?: string | null
          wants_maintenance_contracts?: boolean
          wants_partnerships?: boolean
          wants_subcontracting?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_applications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_applications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_billing_settings: {
        Row: {
          accepts_bank_transfer: boolean
          accepts_card_in_store: boolean
          accepts_cash: boolean
          accepts_cheque: boolean
          accepts_manual_payment: boolean
          accepts_payment_on_pickup: boolean
          bank_account_holder: string | null
          bank_transfer_instructions: string | null
          bic: string | null
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          created_at: string
          credit_note_prefix: string
          currency: string
          default_deposit_percent: number
          default_quote_validity_days: number
          default_tax_rate: number
          extra_mentions: string | null
          fixed_recovery_indemnity: string | null
          footer_text: string | null
          franchise_base_mention: string | null
          iban: string | null
          invoice_prefix: string
          late_penalty: string | null
          legal_form: string | null
          legal_name: string | null
          logo_url: string | null
          payment_due_days: number
          payment_preparation_delay: string | null
          payment_terms: string | null
          purchase_price_variance_require_manager: boolean
          purchase_price_variance_warning_cents: number
          purchase_price_variance_warning_pct: number
          quote_prefix: string
          rcs: string | null
          shop_id: string
          siren: string | null
          siret: string | null
          tax_regime: Database["public"]["Enums"]["tax_regime"]
          trade_name: string | null
          updated_at: string
          updated_by: string | null
          vat_number: string | null
        }
        Insert: {
          accepts_bank_transfer?: boolean
          accepts_card_in_store?: boolean
          accepts_cash?: boolean
          accepts_cheque?: boolean
          accepts_manual_payment?: boolean
          accepts_payment_on_pickup?: boolean
          bank_account_holder?: string | null
          bank_transfer_instructions?: string | null
          bic?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          created_at?: string
          credit_note_prefix?: string
          currency?: string
          default_deposit_percent?: number
          default_quote_validity_days?: number
          default_tax_rate?: number
          extra_mentions?: string | null
          fixed_recovery_indemnity?: string | null
          footer_text?: string | null
          franchise_base_mention?: string | null
          iban?: string | null
          invoice_prefix?: string
          late_penalty?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          payment_due_days?: number
          payment_preparation_delay?: string | null
          payment_terms?: string | null
          purchase_price_variance_require_manager?: boolean
          purchase_price_variance_warning_cents?: number
          purchase_price_variance_warning_pct?: number
          quote_prefix?: string
          rcs?: string | null
          shop_id: string
          siren?: string | null
          siret?: string | null
          tax_regime?: Database["public"]["Enums"]["tax_regime"]
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
        }
        Update: {
          accepts_bank_transfer?: boolean
          accepts_card_in_store?: boolean
          accepts_cash?: boolean
          accepts_cheque?: boolean
          accepts_manual_payment?: boolean
          accepts_payment_on_pickup?: boolean
          bank_account_holder?: string | null
          bank_transfer_instructions?: string | null
          bic?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          created_at?: string
          credit_note_prefix?: string
          currency?: string
          default_deposit_percent?: number
          default_quote_validity_days?: number
          default_tax_rate?: number
          extra_mentions?: string | null
          fixed_recovery_indemnity?: string | null
          footer_text?: string | null
          franchise_base_mention?: string | null
          iban?: string | null
          invoice_prefix?: string
          late_penalty?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          payment_due_days?: number
          payment_preparation_delay?: string | null
          payment_terms?: string | null
          purchase_price_variance_require_manager?: boolean
          purchase_price_variance_warning_cents?: number
          purchase_price_variance_warning_pct?: number
          quote_prefix?: string
          rcs?: string | null
          shop_id?: string
          siren?: string | null
          siret?: string | null
          tax_regime?: Database["public"]["Enums"]["tax_regime"]
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_billing_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_billing_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          closes_at: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          opens_at: string | null
          shop_id: string
          slot_index: number
          updated_at: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          closes_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          shop_id: string
          slot_index?: number
          updated_at?: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          closes_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          shop_id?: string
          slot_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_business_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_business_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_checkout_settings: {
        Row: {
          allow_free_line: boolean
          allow_price_override: boolean
          allow_technician_checkout: boolean
          auto_invoice: boolean
          auto_print: boolean
          auto_receipt: boolean
          cash_requires_session: boolean
          created_at: string
          customer_required: boolean
          default_document: string
          discount_manager_threshold: number
          discount_max_employee: number
          discount_max_technician: number
          enabled_methods: Json
          manage_stock: boolean
          shop_id: string
          terminal_reference_required: boolean
          updated_at: string
        }
        Insert: {
          allow_free_line?: boolean
          allow_price_override?: boolean
          allow_technician_checkout?: boolean
          auto_invoice?: boolean
          auto_print?: boolean
          auto_receipt?: boolean
          cash_requires_session?: boolean
          created_at?: string
          customer_required?: boolean
          default_document?: string
          discount_manager_threshold?: number
          discount_max_employee?: number
          discount_max_technician?: number
          enabled_methods?: Json
          manage_stock?: boolean
          shop_id: string
          terminal_reference_required?: boolean
          updated_at?: string
        }
        Update: {
          allow_free_line?: boolean
          allow_price_override?: boolean
          allow_technician_checkout?: boolean
          auto_invoice?: boolean
          auto_print?: boolean
          auto_receipt?: boolean
          cash_requires_session?: boolean
          created_at?: string
          customer_required?: boolean
          default_document?: string
          discount_manager_threshold?: number
          discount_max_employee?: number
          discount_max_technician?: number
          enabled_methods?: Json
          manage_stock?: boolean
          shop_id?: string
          terminal_reference_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_checkout_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_checkout_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_closures: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          reason: string | null
          shop_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          reason?: string | null
          shop_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          reason?: string | null
          shop_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_closures_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_closures_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_enabled_modules: {
        Row: {
          enabled: boolean
          id: string
          module_key: string
          shop_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          module_key: string
          shop_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          module_key?: string
          shop_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_enabled_modules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_enabled_modules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_feature_pilot_access: {
        Row: {
          created_at: string
          enabled: boolean
          environment: string
          feature_key: string
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment: string
          feature_key: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment?: string
          feature_key?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_feature_pilot_access_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_feature_pilot_access_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_independent_framework_agreements: {
        Row: {
          content_hash: string | null
          created_at: string
          document_id: string | null
          document_version: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          independent_accepted_at: string | null
          independent_user_id: string
          notes: string | null
          shop_accepted_at: string | null
          shop_accepted_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          document_version?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          independent_accepted_at?: string | null
          independent_user_id: string
          notes?: string | null
          shop_accepted_at?: string | null
          shop_accepted_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          document_version?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          independent_accepted_at?: string | null
          independent_user_id?: string
          notes?: string | null
          shop_accepted_at?: string | null
          shop_accepted_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_independent_framework_agreements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_independent_framework_agreements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_independent_framework_agreements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          attempts_count: number
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          last_attempt_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          attempts_count?: number
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_attempt_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          attempts_count?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_attempt_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_invitations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_invitations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_memberships_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_subscription_history: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_state: Json | null
          note: string | null
          old_state: Json | null
          shop_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_state?: Json | null
          note?: string | null
          old_state?: Json | null
          shop_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_state?: Json | null
          note?: string | null
          old_state?: Json | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_subscription_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_subscription_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_subscriptions: {
        Row: {
          activated_by: string | null
          auto_renew: boolean
          beta_target_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          created_at: string
          ends_at: string | null
          id: string
          note: string | null
          origin: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_cents_current: number
          price_cents_future: number
          shop_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          activated_by?: string | null
          auto_renew?: boolean
          beta_target_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          created_at?: string
          ends_at?: string | null
          id?: string
          note?: string | null
          origin?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_cents_current?: number
          price_cents_future?: number
          shop_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          activated_by?: string | null
          auto_renew?: boolean
          beta_target_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          created_at?: string
          ends_at?: string | null
          id?: string
          note?: string | null
          origin?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_cents_current?: number
          price_cents_future?: number
          shop_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          admin_notes: string | null
          ai_import_pilot_access: boolean
          ai_import_pilot_granted_at: string | null
          ai_import_pilot_granted_by: string | null
          business_type: Database["public"]["Enums"]["business_type"]
          city: string | null
          cover_image_url: string | null
          covered_cities: string[]
          covered_postal_codes: string[]
          created_at: string
          description: string | null
          email: string | null
          favicon_url: string | null
          gallery_images: Json
          id: string
          insurance_expires_on: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          internal_name: string | null
          last_seen_at: string | null
          legal_form: string | null
          legal_name: string | null
          legal_notes: string | null
          legal_reviewed_at: string | null
          legal_reviewed_by: string | null
          legal_status: string
          legal_submitted_at: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_current_step: string | null
          onboarding_data: Json
          onboarding_status: string
          owner_user_id: string
          phone: string | null
          postal_code: string | null
          private_address: string | null
          private_city: string | null
          private_postal_code: string | null
          public_description: string | null
          public_email: string | null
          public_logo_url: string | null
          public_name: string | null
          public_profile_status: string
          public_status: string
          publication_notes: string | null
          publication_requested_at: string | null
          publication_reviewed_at: string | null
          publication_reviewed_by: string | null
          service_radius_km: number | null
          siren: string | null
          siret: string | null
          social_links: Json
          social_share_image_url: string | null
          status: Database["public"]["Enums"]["shop_status"]
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_environment: string
          stripe_onboarding_status: string
          stripe_payouts_enabled: boolean
          stripe_platform_fee_bps: number
          stripe_requirements: Json | null
          stripe_synced_at: string | null
          theme_accent_color: string | null
          theme_primary_color: string | null
          travel_fee_amount_cents: number | null
          travel_fee_policy: string | null
          updated_at: string
          validated_at: string | null
          vat_number: string | null
          verification_notes: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          ai_import_pilot_access?: boolean
          ai_import_pilot_granted_at?: string | null
          ai_import_pilot_granted_by?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          cover_image_url?: string | null
          covered_cities?: string[]
          covered_postal_codes?: string[]
          created_at?: string
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          gallery_images?: Json
          id?: string
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          internal_name?: string | null
          last_seen_at?: string | null
          legal_form?: string | null
          legal_name?: string | null
          legal_notes?: string | null
          legal_reviewed_at?: string | null
          legal_reviewed_by?: string | null
          legal_status?: string
          legal_submitted_at?: string | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_current_step?: string | null
          onboarding_data?: Json
          onboarding_status?: string
          owner_user_id: string
          phone?: string | null
          postal_code?: string | null
          private_address?: string | null
          private_city?: string | null
          private_postal_code?: string | null
          public_description?: string | null
          public_email?: string | null
          public_logo_url?: string | null
          public_name?: string | null
          public_profile_status?: string
          public_status?: string
          publication_notes?: string | null
          publication_requested_at?: string | null
          publication_reviewed_at?: string | null
          publication_reviewed_by?: string | null
          service_radius_km?: number | null
          siren?: string | null
          siret?: string | null
          social_links?: Json
          social_share_image_url?: string | null
          status?: Database["public"]["Enums"]["shop_status"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_environment?: string
          stripe_onboarding_status?: string
          stripe_payouts_enabled?: boolean
          stripe_platform_fee_bps?: number
          stripe_requirements?: Json | null
          stripe_synced_at?: string | null
          theme_accent_color?: string | null
          theme_primary_color?: string | null
          travel_fee_amount_cents?: number | null
          travel_fee_policy?: string | null
          updated_at?: string
          validated_at?: string | null
          vat_number?: string | null
          verification_notes?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          ai_import_pilot_access?: boolean
          ai_import_pilot_granted_at?: string | null
          ai_import_pilot_granted_by?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          cover_image_url?: string | null
          covered_cities?: string[]
          covered_postal_codes?: string[]
          created_at?: string
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          gallery_images?: Json
          id?: string
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          internal_name?: string | null
          last_seen_at?: string | null
          legal_form?: string | null
          legal_name?: string | null
          legal_notes?: string | null
          legal_reviewed_at?: string | null
          legal_reviewed_by?: string | null
          legal_status?: string
          legal_submitted_at?: string | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_current_step?: string | null
          onboarding_data?: Json
          onboarding_status?: string
          owner_user_id?: string
          phone?: string | null
          postal_code?: string | null
          private_address?: string | null
          private_city?: string | null
          private_postal_code?: string | null
          public_description?: string | null
          public_email?: string | null
          public_logo_url?: string | null
          public_name?: string | null
          public_profile_status?: string
          public_status?: string
          publication_notes?: string | null
          publication_requested_at?: string | null
          publication_reviewed_at?: string | null
          publication_reviewed_by?: string | null
          service_radius_km?: number | null
          siren?: string | null
          siret?: string | null
          social_links?: Json
          social_share_image_url?: string | null
          status?: Database["public"]["Enums"]["shop_status"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_environment?: string
          stripe_onboarding_status?: string
          stripe_payouts_enabled?: boolean
          stripe_platform_fee_bps?: number
          stripe_requirements?: Json | null
          stripe_synced_at?: string | null
          theme_accent_color?: string | null
          theme_primary_color?: string | null
          travel_fee_amount_cents?: number | null
          travel_fee_policy?: string | null
          updated_at?: string
          validated_at?: string | null
          vat_number?: string | null
          verification_notes?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      stock_inventories: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          shop_id: string
          started_at: string
          status: Database["public"]["Enums"]["stock_inventory_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          shop_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["stock_inventory_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          shop_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["stock_inventory_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_inventories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_inventory_lines: {
        Row: {
          counted_qty: number | null
          created_at: string
          expected_qty: number
          id: string
          inventory_id: string
          item_id: string
          note: string | null
          shop_id: string
          variance: number | null
        }
        Insert: {
          counted_qty?: number | null
          created_at?: string
          expected_qty?: number
          id?: string
          inventory_id: string
          item_id: string
          note?: string | null
          shop_id: string
          variance?: number | null
        }
        Update: {
          counted_qty?: number | null
          created_at?: string
          expected_qty?: number
          id?: string
          inventory_id?: string
          item_id?: string
          note?: string | null
          shop_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_inventory_lines_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "stock_inventories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventory_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventory_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventory_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_item_suppliers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          estimated_delivery_days: number | null
          id: string
          is_primary: boolean
          last_price_update_at: string | null
          min_order_qty: number
          notes: string | null
          pack_qty: number
          purchase_price_cents: number
          shipping_cost_cents: number
          shop_id: string
          stock_item_id: string
          supplier_id: string
          supplier_product_name: string | null
          supplier_product_reference: string | null
          tax_rate: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          estimated_delivery_days?: number | null
          id?: string
          is_primary?: boolean
          last_price_update_at?: string | null
          min_order_qty?: number
          notes?: string | null
          pack_qty?: number
          purchase_price_cents?: number
          shipping_cost_cents?: number
          shop_id: string
          stock_item_id: string
          supplier_id: string
          supplier_product_name?: string | null
          supplier_product_reference?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          estimated_delivery_days?: number | null
          id?: string
          is_primary?: boolean
          last_price_update_at?: string | null
          min_order_qty?: number
          notes?: string | null
          pack_qty?: number
          purchase_price_cents?: number
          shipping_cost_cents?: number
          shop_id?: string
          stock_item_id?: string
          supplier_id?: string
          supplier_product_name?: string | null
          supplier_product_reference?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_item_suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_item_suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_item_suppliers_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_item_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          active: boolean
          archived_at: string | null
          barcode: string | null
          brand: string | null
          category: string | null
          cost_price_cents: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          item_type: Database["public"]["Enums"]["stock_item_type"]
          location: string | null
          min_threshold: number
          name: string
          quantity: number
          quarantine_quantity: number
          reserved_quantity: number
          sell_price_cents: number
          shop_id: string
          sku: string | null
          supplier_ref: string | null
          tax_rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cost_price_cents?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["stock_item_type"]
          location?: string | null
          min_threshold?: number
          name: string
          quantity?: number
          quarantine_quantity?: number
          reserved_quantity?: number
          sell_price_cents?: number
          shop_id: string
          sku?: string | null
          supplier_ref?: string | null
          tax_rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cost_price_cents?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["stock_item_type"]
          location?: string | null
          min_threshold?: number
          name?: string
          quantity?: number
          quarantine_quantity?: number
          reserved_quantity?: number
          sell_price_cents?: number
          shop_id?: string
          sku?: string | null
          supplier_ref?: string | null
          tax_rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          note: string | null
          payment_id: string | null
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          sale_line_id: string | null
          shop_id: string
          user_id: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          note?: string | null
          payment_id?: string | null
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sale_line_id?: string | null
          shop_id: string
          user_id?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["stock_movement_kind"]
          note?: string | null
          payment_id?: string | null
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sale_line_id?: string | null
          shop_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_line_id_fkey"
            columns: ["sale_line_id"]
            isOneToOne: false
            referencedRelation: "sale_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_purchase_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          currency: string
          decision: string | null
          id: string
          new_price_cents: number
          old_price_cents: number | null
          purchase_order_id: string | null
          reason: string | null
          shop_id: string
          source: string
          stock_item_id: string
          supplier_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          currency?: string
          decision?: string | null
          id?: string
          new_price_cents: number
          old_price_cents?: number | null
          purchase_order_id?: string | null
          reason?: string | null
          shop_id: string
          source: string
          stock_item_id: string
          supplier_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          currency?: string
          decision?: string | null
          id?: string
          new_price_cents?: number
          old_price_cents?: number | null
          purchase_order_id?: string | null
          reason?: string | null
          shop_id?: string
          source?: string
          stock_item_id?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_purchase_price_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchase_price_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchase_price_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchase_price_history_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchase_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          released_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["stock_reservation_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          released_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          released_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          account_id: string | null
          event_type: string
          id: string
          livemode: boolean
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
          shop_id: string | null
          stripe_event_id: string
        }
        Insert: {
          account_id?: string | null
          event_type: string
          id?: string
          livemode: boolean
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          shop_id?: string | null
          stripe_event_id: string
        }
        Update: {
          account_id?: string | null
          event_type?: string
          id?: string
          livemode?: boolean
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          shop_id?: string | null
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          archived_at: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          default_lead_days: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          shop_id: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          archived_at?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          default_lead_days?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          archived_at?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          default_lead_days?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suspension_appeals: {
        Row: {
          attachments: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          observations: string
          original_decision: string | null
          shop_id: string
          status: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          observations: string
          original_decision?: string | null
          shop_id: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          observations?: string
          original_decision?: string | null
          shop_id?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suspension_appeals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspension_appeals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_applications: {
        Row: {
          acquisition_detail: string | null
          acquisition_source: string | null
          availability: string | null
          business_status: string
          city: string
          consent: boolean
          consent_version: string | null
          covered_area: string | null
          created_at: string
          email: string
          experience_level: string | null
          first_name: string
          handled_at: string | null
          handled_by: string | null
          has_insurance: boolean | null
          id: string
          internal_note: string | null
          intervention_modes: string[]
          last_name: string
          legal_form: string | null
          message: string | null
          phone: string
          postal_code: string
          reference: string
          referral_code: string | null
          service_radius_km: number | null
          siret: string | null
          skills: string[]
          skills_other: string | null
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          acquisition_detail?: string | null
          acquisition_source?: string | null
          availability?: string | null
          business_status: string
          city: string
          consent?: boolean
          consent_version?: string | null
          covered_area?: string | null
          created_at?: string
          email: string
          experience_level?: string | null
          first_name: string
          handled_at?: string | null
          handled_by?: string | null
          has_insurance?: boolean | null
          id?: string
          internal_note?: string | null
          intervention_modes?: string[]
          last_name: string
          legal_form?: string | null
          message?: string | null
          phone: string
          postal_code: string
          reference: string
          referral_code?: string | null
          service_radius_km?: number | null
          siret?: string | null
          skills?: string[]
          skills_other?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          acquisition_detail?: string | null
          acquisition_source?: string | null
          availability?: string | null
          business_status?: string
          city?: string
          consent?: boolean
          consent_version?: string | null
          covered_area?: string | null
          created_at?: string
          email?: string
          experience_level?: string | null
          first_name?: string
          handled_at?: string | null
          handled_by?: string | null
          has_insurance?: boolean | null
          id?: string
          internal_note?: string | null
          intervention_modes?: string[]
          last_name?: string
          legal_form?: string | null
          message?: string | null
          phone?: string
          postal_code?: string
          reference?: string
          referral_code?: string | null
          service_radius_km?: number | null
          siret?: string | null
          skills?: string[]
          skills_other?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      technician_availability: {
        Row: {
          closes_at: string
          created_at: string
          day_of_week: number
          id: string
          is_available: boolean
          opens_at: string
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          day_of_week: number
          id?: string
          is_available?: boolean
          opens_at: string
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_available?: boolean
          opens_at?: string
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_availability_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_availability_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          shop_id: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          shop_id: string
          starts_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          shop_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_time_off_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_time_off_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_locations: {
        Row: {
          active: boolean
          address: Json | null
          created_at: string
          id: string
          is_default: boolean
          livemode: boolean
          name: string
          shop_id: string
          stripe_account_id: string
          stripe_location_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          livemode?: boolean
          name: string
          shop_id: string
          stripe_account_id: string
          stripe_location_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          livemode?: boolean
          name?: string
          shop_id?: string
          stripe_account_id?: string
          stripe_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_locations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminal_locations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_readers: {
        Row: {
          active: boolean
          created_at: string
          device_type: string | null
          id: string
          is_default: boolean
          is_simulated: boolean
          label: string
          last_seen_at: string | null
          livemode: boolean
          location_id: string | null
          serial_number: string | null
          shop_id: string
          status: string | null
          stripe_account_id: string
          stripe_location_id: string | null
          stripe_reader_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          device_type?: string | null
          id?: string
          is_default?: boolean
          is_simulated?: boolean
          label: string
          last_seen_at?: string | null
          livemode?: boolean
          location_id?: string | null
          serial_number?: string | null
          shop_id: string
          status?: string | null
          stripe_account_id: string
          stripe_location_id?: string | null
          stripe_reader_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          device_type?: string | null
          id?: string
          is_default?: boolean
          is_simulated?: boolean
          label?: string
          last_seen_at?: string | null
          livemode?: boolean
          location_id?: string | null
          serial_number?: string | null
          shop_id?: string
          status?: string | null
          stripe_account_id?: string
          stripe_location_id?: string | null
          stripe_reader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_readers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "terminal_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminal_readers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminal_readers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_platform_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          mime_type: string | null
          notes: string | null
          original_filename: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      shops_public: {
        Row: {
          address: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          city: string | null
          cover_image_url: string | null
          covered_cities: string[] | null
          covered_postal_codes: string[] | null
          description: string | null
          email: string | null
          favicon_url: string | null
          gallery_images: Json | null
          id: string | null
          name: string | null
          phone: string | null
          postal_code: string | null
          public_description: string | null
          public_email: string | null
          public_logo_url: string | null
          public_name: string | null
          public_profile_status: string | null
          service_radius_km: number | null
          social_links: Json | null
          social_share_image_url: string | null
          status: Database["public"]["Enums"]["shop_status"] | null
          theme_accent_color: string | null
          theme_primary_color: string | null
          travel_fee_amount_cents: number | null
          travel_fee_policy: string | null
          updated_at: string | null
          validated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          city?: string | null
          cover_image_url?: string | null
          covered_cities?: string[] | null
          covered_postal_codes?: string[] | null
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          gallery_images?: Json | null
          id?: string | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          public_description?: string | null
          public_email?: string | null
          public_logo_url?: string | null
          public_name?: string | null
          public_profile_status?: string | null
          service_radius_km?: number | null
          social_links?: Json | null
          social_share_image_url?: string | null
          status?: Database["public"]["Enums"]["shop_status"] | null
          theme_accent_color?: string | null
          theme_primary_color?: string | null
          travel_fee_amount_cents?: number | null
          travel_fee_policy?: string | null
          updated_at?: string | null
          validated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          city?: string | null
          cover_image_url?: string | null
          covered_cities?: string[] | null
          covered_postal_codes?: string[] | null
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          gallery_images?: Json | null
          id?: string | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          public_description?: string | null
          public_email?: string | null
          public_logo_url?: string | null
          public_name?: string | null
          public_profile_status?: string | null
          service_radius_km?: number | null
          social_links?: Json | null
          social_share_image_url?: string | null
          status?: Database["public"]["Enums"]["shop_status"] | null
          theme_accent_color?: string | null
          theme_primary_color?: string | null
          travel_fee_amount_cents?: number | null
          travel_fee_policy?: string | null
          updated_at?: string | null
          validated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _partner_shop_label: { Args: { _shop_id: string }; Returns: string }
      accept_customer_portal_invitation: {
        Args: { _token: string }
        Returns: {
          customer_id: string
          shop_id: string
        }[]
      }
      accept_shop_invitation: { Args: { _token: string }; Returns: string }
      acquire_import_generation_lock: {
        Args: { _job_id: string; _token: string }
        Returns: boolean
      }
      add_cash_movement: {
        Args: {
          _amount_cents: number
          _kind: Database["public"]["Enums"]["cash_movement_kind"]
          _note?: string
          _reason?: string
          _session: string
        }
        Returns: string
      }
      add_sale_line: {
        Args: {
          _custom_name?: string
          _custom_price_cents?: number
          _custom_tax_rate?: number
          _discount_percent?: number
          _line_type: Database["public"]["Enums"]["sale_line_type"]
          _note?: string
          _quantity?: number
          _repair_id?: string
          _sale_id: string
          _service_catalog_id?: string
          _stock_item_id?: string
        }
        Returns: string
      }
      admin_block_ip: {
        Args: {
          _ip: string
          _ip_hash: string
          _minutes: number
          _reason: string
        }
        Returns: string
      }
      admin_list_abuse: {
        Args: { _limit?: number }
        Returns: {
          endpoint: string
          event_type: Database["public"]["Enums"]["abuse_event_type"]
          fingerprint: string | null
          id: string
          ip: string | null
          ip_hash: string
          metadata: Json
          occurred_at: string
          severity: Database["public"]["Enums"]["abuse_severity"]
          shop_id: string | null
          user_agent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "abuse_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_active_blocks: {
        Args: never
        Returns: {
          blocked_until: string
          created_at: string
          created_by: string | null
          id: string
          ip: string | null
          ip_hash: string
          reason: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ip_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_seed_demo_shop: { Args: never; Returns: string }
      admin_unblock_ip: { Args: { _ip_hash: string }; Returns: number }
      append_shop_gallery: {
        Args: { _alt: string; _path: string; _shop_id: string }
        Returns: undefined
      }
      apply_stock_movement: {
        Args: {
          _item_id: string
          _kind: Database["public"]["Enums"]["stock_movement_kind"]
          _note?: string
          _quantity: number
          _reason?: string
          _reference_id?: string
          _reference_type?: string
          _shop_id: string
        }
        Returns: {
          balance_after: number
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          note: string | null
          payment_id: string | null
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          sale_line_id: string | null
          shop_id: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_sensitive_module_available: {
        Args: { _module_code: string }
        Returns: Json
      }
      book_public_appointment: {
        Args: {
          _device_description: string
          _email: string
          _name: string
          _phone: string
          _problem_description: string
          _service_id: string
          _shop_id: string
          _starts_at: string
        }
        Returns: string
      }
      bpei_can_access_job: {
        Args: { _job_id: string; _user: string }
        Returns: boolean
      }
      can_manage_shop: {
        Args: { _shop: string; _user: string }
        Returns: boolean
      }
      cancel_payment_link: { Args: { _id: string }; Returns: undefined }
      cancel_sale_draft: { Args: { _sale_id: string }; Returns: undefined }
      check_appointment_slot: {
        Args: {
          _ends_at: string
          _exclude_appointment_id?: string
          _shop_id: string
          _starts_at: string
          _technician_user_id?: string
        }
        Returns: undefined
      }
      check_legal_document_publishable: {
        Args: { _document_id: string }
        Returns: Json
      }
      close_cash_session: {
        Args: {
          _counted_cash_cents: number
          _notes?: string
          _pickup_cents?: number
          _session: string
        }
        Returns: Json
      }
      close_purchase_order_variance: {
        Args: { _note?: string; _po_id: string; _reason: string }
        Returns: undefined
      }
      close_stock_inventory: {
        Args: { _inventory_id: string; _shop_id: string }
        Returns: number
      }
      confirm_import_validation: {
        Args: { _digest: string; _job_id: string }
        Returns: undefined
      }
      confirm_sale: {
        Args: {
          _create_document?: string
          _idempotency_key?: string
          _payments: Json
          _sale_id: string
        }
        Returns: Json
      }
      consumption_last_days: {
        Args: { _days?: number; _item_id: string; _shop_id: string }
        Returns: number
      }
      convert_appointment_to_repair: {
        Args: {
          _appointment_id: string
          _customer_id: string
          _device_id: string
        }
        Returns: string
      }
      convert_quote_to_invoice: { Args: { _quote_id: string }; Returns: string }
      create_customer_portal_invitation: {
        Args: { _customer_id: string; _expires_days?: number }
        Returns: {
          expires_at: string
          id: string
          token: string
        }[]
      }
      create_legal_document_revision: {
        Args: { _source_document_id: string }
        Returns: string
      }
      create_owner_notification: {
        Args: {
          _body: string
          _category: string
          _entity_id: string
          _entity_type: string
          _link_url: string
          _severity: string
          _title: string
        }
        Returns: string
      }
      create_payment_link: {
        Args: {
          _accepted_methods?: string[]
          _amount_cents: number
          _customer_id?: string
          _expires_days?: number
          _invoice_id?: string
          _label?: string
          _repair_id?: string
          _sale_id?: string
          _shop_id: string
        }
        Returns: {
          bank_reference: string
          id: string
          token: string
        }[]
      }
      create_sale_draft: {
        Args: {
          _customer_id?: string
          _idempotency_key?: string
          _linked_order_id?: string
          _linked_quote_id?: string
          _linked_repair_id?: string
          _shop_id: string
          _source?: Database["public"]["Enums"]["sale_source"]
        }
        Returns: string
      }
      effective_now: { Args: never; Returns: string }
      ensure_checkout_settings: {
        Args: { _shop_id: string }
        Returns: {
          allow_free_line: boolean
          allow_price_override: boolean
          allow_technician_checkout: boolean
          auto_invoice: boolean
          auto_print: boolean
          auto_receipt: boolean
          cash_requires_session: boolean
          created_at: string
          customer_required: boolean
          default_document: string
          discount_manager_threshold: number
          discount_max_employee: number
          discount_max_technician: number
          enabled_methods: Json
          manage_stock: boolean
          shop_id: string
          terminal_reference_required: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shop_checkout_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_document_number: {
        Args: {
          _kind: Database["public"]["Enums"]["document_number_kind"]
          _shop: string
        }
        Returns: string
      }
      generate_repair_number: { Args: { _shop: string }; Returns: string }
      get_active_cash_session_id: { Args: { _shop: string }; Returns: string }
      get_available_slots: {
        Args: {
          _from: string
          _service_id: string
          _shop_id: string
          _to: string
        }
        Returns: Json
      }
      get_my_application: {
        Args: never
        Returns: {
          address: string | null
          business_type: Database["public"]["Enums"]["business_type"]
          city: string | null
          commercial_name: string
          consent_contact: boolean
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone: string | null
          covered_cities: string[]
          covered_postal_codes: string[]
          created_at: string
          description: string | null
          employees_count: number | null
          establishments_count: number | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          internal_notes: string | null
          legal_form: string | null
          legal_name: string | null
          linked_user_id: string | null
          main_services: string | null
          message: string | null
          postal_code: string | null
          professional_experience_years: number | null
          reference: string
          service_radius_km: number | null
          shop_id: string | null
          siren: string | null
          siret: string | null
          status: string
          travel_fee_amount_cents: number | null
          travel_fee_policy: string | null
          updated_at: string
          users_count: number | null
          vat_number: string | null
          wants_maintenance_contracts: boolean
          wants_partnerships: boolean
          wants_subcontracting: boolean
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "shop_applications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_or_create_repair_token: {
        Args: { _repair_id: string }
        Returns: string
      }
      get_payment_link_public: {
        Args: { _token: string }
        Returns: {
          accepted_methods: string[]
          amount_cents: number
          bank_reference: string
          currency: string
          expires_at: string
          id: string
          label: string
          shop_bic: string
          shop_holder: string
          shop_iban: string
          shop_id: string
          shop_name: string
          shop_stripe_ready: boolean
          shop_transfer_instructions: string
          status: string
        }[]
      }
      get_public_platform_settings: { Args: never; Returns: Json }
      get_published_legal_document_public: {
        Args: { p_document_code: string; p_language?: string }
        Returns: {
          content: string
          content_hash: string
          document_code: string
          effective_date: string
          id: string
          language: string
          published_at: string
          summary: string
          title: string
          updated_at: string
          version: number
        }[]
      }
      get_published_platform_legal_settings: {
        Args: never
        Returns: {
          capital_amount: string | null
          commercial_name: string | null
          competent_court_information: string | null
          complaint_email: string | null
          complaint_postal_address: string | null
          data_protection_officer_email: string | null
          data_protection_officer_name: string | null
          governing_law: string | null
          hosting_provider_address: string | null
          hosting_provider_name: string | null
          hosting_provider_phone: string | null
          hosting_provider_website: string | null
          id: string
          legal_form: string | null
          legal_name: string | null
          legal_representative_name: string | null
          mediator_address: string | null
          mediator_name: string | null
          mediator_website: string | null
          privacy_contact_email: string | null
          professional_email: string | null
          professional_insurance_coverage_area: string | null
          professional_insurance_name: string | null
          professional_insurance_policy_reference: string | null
          professional_phone: string | null
          publication_director_name: string | null
          rcs_city: string | null
          registered_office_address: string | null
          registered_office_city: string | null
          registered_office_country: string | null
          registered_office_postal_code: string | null
          rne_registration: string | null
          singleton: boolean
          siren: string | null
          siret: string | null
          support_email: string | null
          updated_at: string
          updated_by: string | null
          vat_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_legal_settings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_published_platform_public_settings: {
        Args: never
        Returns: {
          published: Json
          published_at: string
          published_version: number
        }[]
      }
      get_seller_public_legal: {
        Args: { _shop_id: string }
        Returns: {
          commercial_name: string
          legal_form: string
          legal_name: string
          legal_status: string
          mediator_name: string
          mediator_website: string
          professional_email: string
          professional_phone: string
          rcs_or_rne_registration: string
          siren: string
          siret: string
          vat_number: string
        }[]
      }
      get_shop_review_stats: {
        Args: { _shop_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
      grant_ai_import_pilot_env: {
        Args: { _enabled: boolean; _env: string; _shop_id: string }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user: string
        }
        Returns: boolean
      }
      has_shop_role: {
        Args: {
          _role: Database["public"]["Enums"]["shop_role"]
          _shop: string
          _user: string
        }
        Returns: boolean
      }
      hash_ip: { Args: { _ip: string; _pepper?: string }; Returns: string }
      is_admin_bpei: { Args: { _user: string }; Returns: boolean }
      is_ai_import_enabled: { Args: never; Returns: boolean }
      is_ai_import_enabled_env: { Args: { _env: string }; Returns: boolean }
      is_ai_import_pilot: { Args: { _shop_id: string }; Returns: boolean }
      is_ai_import_pilot_env: {
        Args: { _env: string; _shop_id: string }
        Returns: boolean
      }
      is_ip_blocked: { Args: { _ip_hash: string }; Returns: boolean }
      is_owner_bpei: { Args: { _user: string }; Returns: boolean }
      is_shop_member: {
        Args: { _shop: string; _user: string }
        Returns: boolean
      }
      issue_credit_note: { Args: { _credit_note_id: string }; Returns: string }
      issue_invoice: { Args: { _invoice_id: string }; Returns: string }
      issue_quote: { Args: { _quote_id: string }; Returns: string }
      link_customer_records_for_user: { Args: never; Returns: number }
      list_shop_public_reviews: {
        Args: { _limit?: number; _shop_id: string }
        Returns: {
          author_name: string
          comment: string
          id: string
          published_at: string
          rating: number
          rating_communication: number
          rating_quality: number
          rating_speed: number
          replied_at: string
          reply_text: string
          title: string
        }[]
      }
      list_shop_technicians: {
        Args: { _shop_id: string }
        Returns: {
          first_name: string
          last_name: string
          role: Database["public"]["Enums"]["shop_role"]
          user_id: string
        }[]
      }
      log_sensitive_module_denial: {
        Args: {
          _action: string
          _module_code: string
          _reason: string
          _route: string
          _status: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: {
        Args: { p_shop_id: string }
        Returns: number
      }
      mark_all_owner_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_owner_notification_read: {
        Args: { _id: string }
        Returns: undefined
      }
      onboarding_complete: { Args: { _shop_id: string }; Returns: undefined }
      onboarding_save_step: {
        Args: { _data: Json; _shop_id: string; _step: string }
        Returns: undefined
      }
      onboarding_skip_optional: {
        Args: { _shop_id: string; _step: string }
        Returns: undefined
      }
      open_cash_session: {
        Args: {
          _notes?: string
          _opening_float_cents?: number
          _register_label?: string
          _shop: string
        }
        Returns: string
      }
      owner_activate_paid: {
        Args: {
          _ends_at: string
          _note?: string
          _plan: Database["public"]["Enums"]["subscription_plan"]
          _shop_id: string
        }
        Returns: undefined
      }
      owner_approve_legal: {
        Args: { _notes?: string; _shop_id: string }
        Returns: undefined
      }
      owner_approve_publication: {
        Args: { _notes?: string; _shop_id: string }
        Returns: undefined
      }
      owner_archive_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      owner_change_invitation_email: {
        Args: { _id: string; _new_email: string }
        Returns: undefined
      }
      owner_compute_publication_status: {
        Args: { p_publication_id: string }
        Returns: string
      }
      owner_extend_subscription: {
        Args: { _new_end: string; _note?: string; _shop_id: string }
        Returns: undefined
      }
      owner_get_platform_settings: { Args: never; Returns: Json }
      owner_get_probe_test_flags: { Args: never; Returns: string[] }
      owner_list_publication_consumers: {
        Args: { p_publication_id: string }
        Returns: {
          attempts: number
          consumer_key: string
          created_at: string
          expected_version: number
          id: string
          is_essential: boolean
          last_attempt_at: string | null
          last_checked_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          observed_version: number | null
          publication_id: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_settings_consumer_status"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      owner_mark_consumer_retry: {
        Args: { p_consumer_key: string; p_publication_id: string }
        Returns: undefined
      }
      owner_publish_platform_settings: {
        Args: { p_changed_fields?: string[]; p_note?: string }
        Returns: Json
      }
      owner_reactivate_subscription: {
        Args: { _shop_id: string }
        Returns: undefined
      }
      owner_record_consumer_observation: {
        Args: {
          p_consumer_key: string
          p_error_code?: string
          p_error_message?: string
          p_observed_version: number
          p_publication_id: string
          p_status: string
        }
        Returns: undefined
      }
      owner_refuse_application: {
        Args: { _application_id: string; _reason?: string }
        Returns: undefined
      }
      owner_regenerate_invitation: {
        Args: { _email: string; _shop_id: string }
        Returns: string
      }
      owner_reject_legal: {
        Args: { _notes: string; _shop_id: string }
        Returns: undefined
      }
      owner_reject_publication: {
        Args: { _notes: string; _shop_id: string }
        Returns: undefined
      }
      owner_resend_invitation: { Args: { _id: string }; Returns: string }
      owner_restore_platform_settings_version: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      owner_review_verification: {
        Args: { _decision: string; _notes?: string; _shop_id: string }
        Returns: undefined
      }
      owner_review_verification_document: {
        Args: { _document_id: string; _notes?: string; _status: string }
        Returns: undefined
      }
      owner_revoke_invitation: { Args: { _id: string }; Returns: undefined }
      owner_rollback_platform_settings_with_reason: {
        Args: { p_publication_id: string; p_reason: string }
        Returns: Json
      }
      owner_save_platform_settings_draft: {
        Args: { p_draft: Json }
        Returns: undefined
      }
      owner_seed_publication_consumers: {
        Args: { p_publication_id: string }
        Returns: number
      }
      owner_set_probe_test_flags: {
        Args: { p_keys: string[] }
        Returns: string[]
      }
      owner_set_simulated_now: { Args: { _ts: string }; Returns: undefined }
      owner_start_consumer_retry: {
        Args: { p_consumer_key: string; p_publication_id: string }
        Returns: boolean
      }
      owner_suspend_subscription: {
        Args: { _reason?: string; _shop_id: string }
        Returns: undefined
      }
      owner_toggle_module: {
        Args: { _enabled: boolean; _module: string; _shop_id: string }
        Returns: undefined
      }
      owner_update_application_notes: {
        Args: { _application_id: string; _new_status?: string; _notes: string }
        Returns: undefined
      }
      owner_update_shop_names: {
        Args: {
          _internal_name: string
          _public_name: string
          _public_status?: string
          _shop_id: string
        }
        Returns: undefined
      }
      owner_validate_application: {
        Args: {
          _activate_beta?: boolean
          _application_id: string
          _internal_name?: string
          _public_name?: string
        }
        Returns: Json
      }
      partner_accept_agreement_version: {
        Args: {
          _agreement_id: string
          _content_hash: string
          _version_number: number
        }
        Returns: string
      }
      partner_accept_application: {
        Args: {
          _application_id: string
          _compensation_details?: string
          _compensation_model?: string
          _end_date?: string
          _requires_exclusivity?: boolean
          _scope?: string
          _start_date?: string
          _title: string
        }
        Returns: string
      }
      partner_apply: {
        Args: {
          _independent_shop_id: string
          _message?: string
          _opportunity_id: string
          _proposed_rate?: string
        }
        Returns: string
      }
      partner_mark_application_viewed: {
        Args: { _application_id: string }
        Returns: undefined
      }
      partner_owner_expire_due_agreements: { Args: never; Returns: number }
      partner_owner_force_expire_agreement: {
        Args: { _agreement_id: string; _reason: string }
        Returns: undefined
      }
      partner_owner_reactivate_agreement: {
        Args: { _agreement_id: string; _note: string }
        Returns: undefined
      }
      partner_owner_suspend_agreement: {
        Args: { _agreement_id: string; _reason: string }
        Returns: undefined
      }
      partner_propose_agreement_version: {
        Args: {
          _agreement_id: string
          _change_summary?: string
          _snapshot: Json
        }
        Returns: number
      }
      partner_reject_application: {
        Args: { _application_id: string; _notes?: string }
        Returns: undefined
      }
      partner_shortlist_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      partner_sign_agreement: {
        Args: { _agreement_id: string }
        Returns: undefined
      }
      partner_terminate_agreement: {
        Args: { _agreement_id: string; _reason?: string }
        Returns: undefined
      }
      partner_withdraw_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      portal_cancel_appointment: {
        Args: { _appointment_id: string; _reason?: string }
        Returns: undefined
      }
      public_accept_quote: {
        Args: {
          _ip?: string
          _name: string
          _signature?: string
          _token: string
          _ua?: string
        }
        Returns: boolean
      }
      public_get_order: { Args: { _token: string }; Returns: Json }
      public_get_quote: { Args: { _token: string }; Returns: Json }
      public_get_repair_status: { Args: { _token: string }; Returns: Json }
      public_get_shop_payment_methods: {
        Args: { _shop_id: string }
        Returns: Json
      }
      public_get_shop_public_view: { Args: { _shop_id: string }; Returns: Json }
      public_post_order_message: {
        Args: { _author_name: string; _body: string; _token: string }
        Returns: string
      }
      public_refuse_quote: {
        Args: { _reason?: string; _token: string }
        Returns: boolean
      }
      public_search_shops_v2: {
        Args: { _business_type?: string; _limit?: number; _q?: string }
        Returns: {
          address: string
          business_type: Database["public"]["Enums"]["business_type"]
          city: string
          covered_cities: string[]
          covered_postal_codes: string[]
          description: string
          id: string
          name: string
          phone: string
          postal_code: string
          service_radius_km: number
          verified: boolean
        }[]
      }
      public_shop_is_published: { Args: { _shop_id: string }; Returns: boolean }
      publish_legal_document: {
        Args: { _document_id: string; _effective_date?: string }
        Returns: Json
      }
      quarantine_action: {
        Args: {
          _action: string
          _item_id: string
          _note?: string
          _quantity: number
          _shop_id: string
        }
        Returns: undefined
      }
      quick_create_customer: {
        Args: {
          _email?: string
          _first_name?: string
          _last_name: string
          _phone?: string
          _shop_id: string
        }
        Returns: string
      }
      rate_limit_hit: {
        Args: {
          _endpoint: string
          _scope_key: string
          _scope_type: string
          _window_start: string
        }
        Returns: number
      }
      recalc_cash_session_expected: {
        Args: { _session: string }
        Returns: undefined
      }
      recalc_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recalc_order_totals: { Args: { _order_id: string }; Returns: undefined }
      recalc_quote_totals: { Args: { _quote_id: string }; Returns: undefined }
      recalc_sale_totals: { Args: { _sale_id: string }; Returns: undefined }
      receive_purchase_order_line:
        | {
            Args: {
              _line_id: string
              _note?: string
              _quantity: number
              _shop_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _damaged?: number
              _delivery_note?: string
              _line_id: string
              _note?: string
              _quantity: number
              _shop_id: string
            }
            Returns: undefined
          }
      recompute_purchase_order_totals: {
        Args: { _po_id: string }
        Returns: undefined
      }
      reconcile_my_shop_access: { Args: never; Returns: Json }
      record_abuse: {
        Args: {
          _endpoint: string
          _event_type: Database["public"]["Enums"]["abuse_event_type"]
          _fingerprint: string
          _ip: string
          _ip_hash: string
          _metadata: Json
          _severity: Database["public"]["Enums"]["abuse_severity"]
          _shop_id: string
          _ua: string
        }
        Returns: string
      }
      record_bank_transfer: {
        Args: {
          _amount_cents: number
          _customer_id?: string
          _invoice_id?: string
          _notes?: string
          _paid_at?: string
          _payment_link_id?: string
          _reference: string
          _shop_id: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          _amount_cents: number
          _invoice_id: string
          _method: Database["public"]["Enums"]["payment_method"]
          _notes?: string
          _paid_at?: string
          _reference?: string
        }
        Returns: string
      }
      refund_sale: {
        Args: {
          _idempotency_key?: string
          _lines: Json
          _reason?: string
          _reference?: string
          _refund_method: Database["public"]["Enums"]["payment_method"]
          _sale_id: string
        }
        Returns: Json
      }
      release_import_generation_lock: {
        Args: { _job_id: string; _token: string }
        Returns: undefined
      }
      remove_sale_line: { Args: { _line_id: string }; Returns: undefined }
      remove_shop_gallery: {
        Args: { _path: string; _shop_id: string }
        Returns: undefined
      }
      revoke_customer_portal_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      send_purchase_order: { Args: { _po_id: string }; Returns: undefined }
      set_ai_import_enabled: { Args: { _enabled: boolean }; Returns: boolean }
      set_ai_import_enabled_env: {
        Args: { _enabled: boolean; _env: string }
        Returns: boolean
      }
      set_ai_import_pilot_access: {
        Args: { _enabled: boolean; _shop_id: string }
        Returns: boolean
      }
      set_sale_customer: {
        Args: { _customer_id: string; _sale_id: string }
        Returns: undefined
      }
      set_shop_media: {
        Args: { _kind: string; _path: string; _shop_id: string }
        Returns: undefined
      }
      shop_has_module_access: {
        Args: { _module: string; _shop: string }
        Returns: boolean
      }
      shop_partnership_capable: {
        Args: { _shop_id: string; _side: string }
        Returns: boolean
      }
      shop_replace_business_hours: {
        Args: { _shop_id: string; _slots: Json }
        Returns: undefined
      }
      shop_request_publication: {
        Args: { _notes?: string; _shop_id: string }
        Returns: undefined
      }
      shop_stripe_ready: { Args: { _shop_id: string }; Returns: boolean }
      shop_submit_legal: { Args: { _shop_id: string }; Returns: undefined }
      shop_subscription_state: { Args: { _shop: string }; Returns: Json }
      shop_unpublish: { Args: { _shop_id: string }; Returns: undefined }
      submit_public_content_report: {
        Args: {
          p_category: string
          p_description: string
          p_good_faith?: boolean
          p_legal_basis?: string
          p_reporter_email?: string
          p_reporter_name?: string
          p_reporter_phone?: string
          p_target_id?: string
          p_target_shop_id?: string
          p_target_type?: string
          p_target_url?: string
        }
        Returns: {
          report_number: string
        }[]
      }
      submit_review:
        | {
            Args: {
              _author_name: string
              _comment: string
              _ip?: string
              _rating: number
              _title: string
              _token: string
              _ua?: string
            }
            Returns: string
          }
        | {
            Args: {
              _author_name: string
              _comment: string
              _ip?: string
              _rating: number
              _rating_communication?: number
              _rating_quality?: number
              _rating_speed?: number
              _title: string
              _token: string
              _ua?: string
            }
            Returns: string
          }
      submit_shop_application: { Args: { _data: Json }; Returns: string }
      submit_verification_request: {
        Args: { _notes?: string; _shop_id: string }
        Returns: undefined
      }
      supplier_stats: { Args: { _supplier_id: string }; Returns: Json }
      suspend_import_job: {
        Args: { _job_id: string; _reason?: string }
        Returns: boolean
      }
      terminal_flag_status: { Args: never; Returns: string }
      update_sale_line: {
        Args: {
          _discount_percent?: number
          _line_id: string
          _note?: string
          _quantity?: number
          _unit_price_cents?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      abuse_event_type:
        | "rate_limit_hit"
        | "captcha_failed"
        | "manual_block"
        | "suspicious_pattern"
        | "blocked_ip_attempt"
      abuse_severity: "info" | "warn" | "critical"
      appointment_source: "public" | "manual" | "phone"
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      bug_report_category: "bug" | "idea" | "ux" | "performance" | "other"
      bug_report_severity: "low" | "medium" | "high" | "critical"
      bug_report_status: "new" | "in_progress" | "resolved" | "wont_fix"
      business_type:
        | "physical_shop"
        | "mobile_independent"
        | "hybrid_business"
        | "multi_location_network"
      cash_movement_kind:
        | "opening_float"
        | "sale"
        | "refund"
        | "cash_in"
        | "cash_out"
        | "pickup"
        | "adjustment"
        | "closing"
      cash_session_status: "open" | "closed"
      customer_type: "individual" | "business"
      device_type:
        | "laptop"
        | "desktop"
        | "mac"
        | "phone"
        | "tablet"
        | "console"
        | "printer"
        | "server"
        | "peripheral"
        | "other"
      document_line_type:
        | "service"
        | "product"
        | "labour"
        | "discount"
        | "other"
      document_number_kind: "quote" | "invoice" | "credit_note"
      import_file_kind: "csv" | "xlsx" | "pdf" | "image" | "json" | "other"
      import_job_kind:
        | "products"
        | "stock"
        | "services"
        | "customers"
        | "shop_profile"
        | "mixed"
      import_job_status:
        | "draft"
        | "uploading"
        | "queued"
        | "analyzing"
        | "review"
        | "importing"
        | "completed"
        | "failed"
        | "cancelled"
        | "rolled_back"
      import_row_status:
        | "pending"
        | "ready"
        | "needs_review"
        | "rejected"
        | "imported"
        | "error"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      invoice_status:
        | "draft"
        | "issued"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled_by_credit_note"
        | "refunded"
      note_visibility: "internal" | "customer"
      partner_agreement_status:
        | "proposed"
        | "shop_signed"
        | "independent_signed"
        | "active"
        | "suspended"
        | "terminated"
        | "expired"
        | "draft"
        | "negotiation"
      partner_application_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "viewed"
        | "shortlisted"
        | "negotiation"
        | "expired"
        | "submitted"
      partner_opportunity_status:
        | "draft"
        | "published"
        | "paused"
        | "closed"
        | "filled"
      payment_method:
        | "cash"
        | "card_terminal"
        | "bank_transfer"
        | "cheque"
        | "online"
        | "other"
        | "pickup"
        | "manual_received"
      payment_status:
        | "pending"
        | "confirmed"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      platform_role: "client" | "admin_bpei" | "owner_bpei"
      purchase_order_status:
        | "draft"
        | "sent"
        | "partial"
        | "received"
        | "cancelled"
        | "confirmed"
        | "late"
        | "closed_variance"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "refused"
        | "expired"
        | "cancelled"
        | "converted"
      refund_restock_action: "restock" | "damaged" | "not_returned"
      repair_priority: "low" | "normal" | "high" | "urgent"
      repair_status:
        | "request_received"
        | "device_dropped_off"
        | "awaiting_diagnosis"
        | "diagnosis_in_progress"
        | "quote_to_prepare"
        | "quote_sent"
        | "awaiting_response"
        | "quote_accepted"
        | "quote_rejected"
        | "awaiting_part"
        | "part_ordered"
        | "repair_in_progress"
        | "testing_in_progress"
        | "repair_completed"
        | "ready_for_pickup"
        | "customer_notified"
        | "device_collected"
        | "not_repairable"
        | "cancelled"
        | "warranty_return"
      review_status: "pending" | "published" | "rejected"
      sale_line_type: "product" | "service" | "free" | "deposit_refund"
      sale_source: "counter" | "order" | "repair" | "quote"
      sale_status:
        | "draft"
        | "completed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      shop_role: "employee" | "technician" | "shop_manager" | "network_owner"
      shop_status:
        | "draft"
        | "pending"
        | "under_review"
        | "validated"
        | "rejected"
        | "suspended"
      stock_inventory_status: "draft" | "in_progress" | "closed"
      stock_item_type: "product" | "part" | "consumable"
      stock_movement_kind:
        | "in"
        | "out"
        | "adjust"
        | "quarantine_in"
        | "quarantine_out"
        | "quarantine_release"
      stock_reservation_status: "active" | "consumed" | "released"
      subscription_plan:
        | "starter"
        | "pro"
        | "network"
        | "shop_essential"
        | "shop_pro"
        | "shop_network"
        | "independent_intervention"
        | "independent_partner"
      subscription_status:
        | "trial"
        | "active"
        | "expired"
        | "suspended"
        | "cancelled"
      tax_regime:
        | "standard"
        | "custom"
        | "exempt"
        | "franchise_base"
        | "not_applicable"
      verification_status:
        | "not_submitted"
        | "pending"
        | "verified"
        | "rejected"
        | "suspended"
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
    Enums: {
      abuse_event_type: [
        "rate_limit_hit",
        "captcha_failed",
        "manual_block",
        "suspicious_pattern",
        "blocked_ip_attempt",
      ],
      abuse_severity: ["info", "warn", "critical"],
      appointment_source: ["public", "manual", "phone"],
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      bug_report_category: ["bug", "idea", "ux", "performance", "other"],
      bug_report_severity: ["low", "medium", "high", "critical"],
      bug_report_status: ["new", "in_progress", "resolved", "wont_fix"],
      business_type: [
        "physical_shop",
        "mobile_independent",
        "hybrid_business",
        "multi_location_network",
      ],
      cash_movement_kind: [
        "opening_float",
        "sale",
        "refund",
        "cash_in",
        "cash_out",
        "pickup",
        "adjustment",
        "closing",
      ],
      cash_session_status: ["open", "closed"],
      customer_type: ["individual", "business"],
      device_type: [
        "laptop",
        "desktop",
        "mac",
        "phone",
        "tablet",
        "console",
        "printer",
        "server",
        "peripheral",
        "other",
      ],
      document_line_type: ["service", "product", "labour", "discount", "other"],
      document_number_kind: ["quote", "invoice", "credit_note"],
      import_file_kind: ["csv", "xlsx", "pdf", "image", "json", "other"],
      import_job_kind: [
        "products",
        "stock",
        "services",
        "customers",
        "shop_profile",
        "mixed",
      ],
      import_job_status: [
        "draft",
        "uploading",
        "queued",
        "analyzing",
        "review",
        "importing",
        "completed",
        "failed",
        "cancelled",
        "rolled_back",
      ],
      import_row_status: [
        "pending",
        "ready",
        "needs_review",
        "rejected",
        "imported",
        "error",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      invoice_status: [
        "draft",
        "issued",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled_by_credit_note",
        "refunded",
      ],
      note_visibility: ["internal", "customer"],
      partner_agreement_status: [
        "proposed",
        "shop_signed",
        "independent_signed",
        "active",
        "suspended",
        "terminated",
        "expired",
        "draft",
        "negotiation",
      ],
      partner_application_status: [
        "pending",
        "accepted",
        "rejected",
        "withdrawn",
        "viewed",
        "shortlisted",
        "negotiation",
        "expired",
        "submitted",
      ],
      partner_opportunity_status: [
        "draft",
        "published",
        "paused",
        "closed",
        "filled",
      ],
      payment_method: [
        "cash",
        "card_terminal",
        "bank_transfer",
        "cheque",
        "online",
        "other",
        "pickup",
        "manual_received",
      ],
      payment_status: [
        "pending",
        "confirmed",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      platform_role: ["client", "admin_bpei", "owner_bpei"],
      purchase_order_status: [
        "draft",
        "sent",
        "partial",
        "received",
        "cancelled",
        "confirmed",
        "late",
        "closed_variance",
      ],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "refused",
        "expired",
        "cancelled",
        "converted",
      ],
      refund_restock_action: ["restock", "damaged", "not_returned"],
      repair_priority: ["low", "normal", "high", "urgent"],
      repair_status: [
        "request_received",
        "device_dropped_off",
        "awaiting_diagnosis",
        "diagnosis_in_progress",
        "quote_to_prepare",
        "quote_sent",
        "awaiting_response",
        "quote_accepted",
        "quote_rejected",
        "awaiting_part",
        "part_ordered",
        "repair_in_progress",
        "testing_in_progress",
        "repair_completed",
        "ready_for_pickup",
        "customer_notified",
        "device_collected",
        "not_repairable",
        "cancelled",
        "warranty_return",
      ],
      review_status: ["pending", "published", "rejected"],
      sale_line_type: ["product", "service", "free", "deposit_refund"],
      sale_source: ["counter", "order", "repair", "quote"],
      sale_status: [
        "draft",
        "completed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      shop_role: ["employee", "technician", "shop_manager", "network_owner"],
      shop_status: [
        "draft",
        "pending",
        "under_review",
        "validated",
        "rejected",
        "suspended",
      ],
      stock_inventory_status: ["draft", "in_progress", "closed"],
      stock_item_type: ["product", "part", "consumable"],
      stock_movement_kind: [
        "in",
        "out",
        "adjust",
        "quarantine_in",
        "quarantine_out",
        "quarantine_release",
      ],
      stock_reservation_status: ["active", "consumed", "released"],
      subscription_plan: [
        "starter",
        "pro",
        "network",
        "shop_essential",
        "shop_pro",
        "shop_network",
        "independent_intervention",
        "independent_partner",
      ],
      subscription_status: [
        "trial",
        "active",
        "expired",
        "suspended",
        "cancelled",
      ],
      tax_regime: [
        "standard",
        "custom",
        "exempt",
        "franchise_base",
        "not_applicable",
      ],
      verification_status: [
        "not_submitted",
        "pending",
        "verified",
        "rejected",
        "suspended",
      ],
    },
  },
} as const