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
      audit_log: {
        Row: {
          action: string
          actor_user: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          row_id: string | null
          table_name: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          row_id?: string | null
          table_name: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          row_id?: string | null
          table_name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      booking_rooms: {
        Row: {
          booking_id: string
          check_in: string
          check_out: string
          created_at: string
          id: string
          nightly: Json | null
          nightly_rate_pkr: number
          property_id: string
          room_id: string
          room_type_id: string
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          check_in: string
          check_out: string
          created_at?: string
          id?: string
          nightly?: Json | null
          nightly_rate_pkr?: number
          property_id: string
          room_id: string
          room_type_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          check_in?: string
          check_out?: string
          created_at?: string
          id?: string
          nightly?: Json | null
          nightly_rate_pkr?: number
          property_id?: string
          room_id?: string
          room_type_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_rooms_board"
            referencedColumns: ["current_booking_id"]
          },
          {
            foreignKeyName: "booking_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_rooms_board"
            referencedColumns: ["next_booking_id"]
          },
          {
            foreignKeyName: "booking_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_rooms_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_room_property_fkey"
            columns: ["property_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["property_id", "id"]
          },
          {
            foreignKeyName: "booking_rooms_room_property_fkey"
            columns: ["property_id", "room_id"]
            isOneToOne: false
            referencedRelation: "v_rooms_board"
            referencedColumns: ["property_id", "id"]
          },
          {
            foreignKeyName: "booking_rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_type_property_fkey"
            columns: ["property_id", "room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number
          booking_no: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          check_in: string
          check_out: string
          checked_in_at: string | null
          checked_out_at: string | null
          checkout_override_by: string | null
          checkout_override_reason: string | null
          children: number
          created_at: string
          created_by: string | null
          custom_fields: Json
          guest_id: string
          id: string
          no_show_at: string | null
          notes: string | null
          ota_ref: string | null
          property_id: string
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adults?: number
          booking_no: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          check_in: string
          check_out: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          checkout_override_by?: string | null
          checkout_override_reason?: string | null
          children?: number
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          guest_id: string
          id?: string
          no_show_at?: string | null
          notes?: string | null
          ota_ref?: string | null
          property_id: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adults?: number
          booking_no?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          check_in?: string
          check_out?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          checkout_override_by?: string | null
          checkout_override_reason?: string | null
          children?: number
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          guest_id?: string
          id?: string
          no_show_at?: string | null
          notes?: string | null
          ota_ref?: string | null
          property_id?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "v_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_guest_fkey"
            columns: ["tenant_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_guest_fkey"
            columns: ["tenant_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "v_guests"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          confirmed: Json | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          declared: Json
          discrepancy: Json | null
          expected: Json | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_float: number
          property_id: string
          shift_date: string
          status: Database["public"]["Enums"]["cash_shift_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          confirmed?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          declared?: Json
          discrepancy?: Json | null
          expected?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_float?: number
          property_id: string
          shift_date?: string
          status?: Database["public"]["Enums"]["cash_shift_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          confirmed?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          declared?: Json
          discrepancy?: Json | null
          expected?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_float?: number
          property_id?: string
          shift_date?: string
          status?: Database["public"]["Enums"]["cash_shift_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          entity: Database["public"]["Enums"]["custom_field_entity"]
          id: string
          key: string
          label: string
          options: Json | null
          required: boolean
          tenant_id: string
          type: Database["public"]["Enums"]["custom_field_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: Database["public"]["Enums"]["custom_field_entity"]
          id?: string
          key: string
          label: string
          options?: Json | null
          required?: boolean
          tenant_id: string
          type?: Database["public"]["Enums"]["custom_field_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: Database["public"]["Enums"]["custom_field_entity"]
          id?: string
          key?: string
          label?: string
          options?: Json | null
          required?: boolean
          tenant_id?: string
          type?: Database["public"]["Enums"]["custom_field_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body: string
          id: string
          key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_items: {
        Row: {
          amount_pkr: number
          booking_room_id: string | null
          business_date: string
          cash_shift_id: string | null
          category: string
          description: string
          folio_id: string
          id: string
          kind: Database["public"]["Enums"]["folio_item_kind"]
          method: Database["public"]["Enums"]["payment_method"] | null
          posted_at: string
          posted_by: string | null
          property_id: string
          receipt_no: string | null
          reference: string | null
          reverses_item_id: string | null
          service_date: string | null
          source: string
          tax_pkr: number
          tenant_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_pkr: number
          booking_room_id?: string | null
          business_date?: string
          cash_shift_id?: string | null
          category?: string
          description: string
          folio_id: string
          id?: string
          kind: Database["public"]["Enums"]["folio_item_kind"]
          method?: Database["public"]["Enums"]["payment_method"] | null
          posted_at?: string
          posted_by?: string | null
          property_id: string
          receipt_no?: string | null
          reference?: string | null
          reverses_item_id?: string | null
          service_date?: string | null
          source?: string
          tax_pkr?: number
          tenant_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_pkr?: number
          booking_room_id?: string | null
          business_date?: string
          cash_shift_id?: string | null
          category?: string
          description?: string
          folio_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["folio_item_kind"]
          method?: Database["public"]["Enums"]["payment_method"] | null
          posted_at?: string
          posted_by?: string | null
          property_id?: string
          receipt_no?: string | null
          reference?: string | null
          reverses_item_id?: string | null
          service_date?: string | null
          source?: string
          tax_pkr?: number
          tenant_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folio_items_booking_room_id_fkey"
            columns: ["booking_room_id"]
            isOneToOne: false
            referencedRelation: "booking_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_items_booking_room_id_fkey"
            columns: ["booking_room_id"]
            isOneToOne: false
            referencedRelation: "v_bookings"
            referencedColumns: ["booking_room_id"]
          },
          {
            foreignKeyName: "folio_items_cash_shift_id_fkey"
            columns: ["cash_shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_items_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_items_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "v_bookings"
            referencedColumns: ["folio_id"]
          },
          {
            foreignKeyName: "folio_items_reverses_item_id_fkey"
            columns: ["reverses_item_id"]
            isOneToOne: false
            referencedRelation: "folio_items"
            referencedColumns: ["id"]
          },
        ]
      }
      folios: {
        Row: {
          balance: number
          booking_id: string
          closed_at: string | null
          created_at: string
          folio_no: string | null
          id: string
          property_id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: Database["public"]["Enums"]["folio_status"]
          tenant_id: string
          total_charges: number
          total_payments: number
          total_tax: number
          updated_at: string
        }
        Insert: {
          balance?: number
          booking_id: string
          closed_at?: string | null
          created_at?: string
          folio_no?: string | null
          id?: string
          property_id: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: Database["public"]["Enums"]["folio_status"]
          tenant_id: string
          total_charges?: number
          total_payments?: number
          total_tax?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          booking_id?: string
          closed_at?: string | null
          created_at?: string
          folio_no?: string | null
          id?: string
          property_id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: Database["public"]["Enums"]["folio_status"]
          tenant_id?: string
          total_charges?: number
          total_payments?: number
          total_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folios_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_rooms_board"
            referencedColumns: ["current_booking_id"]
          },
          {
            foreignKeyName: "folios_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_rooms_board"
            referencedColumns: ["next_booking_id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          cnic: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          id_expiry: string | null
          id_number: string | null
          id_type: string | null
          name: string
          nationality: string | null
          notes: string | null
          passport: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnic?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          id_expiry?: string | null
          id_number?: string | null
          id_type?: string | null
          name: string
          nationality?: string | null
          notes?: string | null
          passport?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnic?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          id_expiry?: string | null
          id_number?: string | null
          id_type?: string | null
          name?: string
          nationality?: string | null
          notes?: string | null
          passport?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          due_date: string
          id: string
          note: string | null
          property_id: string
          room_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          due_date: string
          id?: string
          note?: string | null
          property_id: string
          room_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string
          id?: string
          note?: string | null
          property_id?: string
          room_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_rooms_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_property_fkey"
            columns: ["property_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["property_id", "id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_property_fkey"
            columns: ["property_id", "room_id"]
            isOneToOne: false
            referencedRelation: "v_rooms_board"
            referencedColumns: ["property_id", "id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_pkr: number
          description: string
          id: string
          invoice_id: string
        }
        Insert: {
          amount_pkr: number
          description: string
          id?: string
          invoice_id: string
        }
        Update: {
          amount_pkr?: number
          description?: string
          id?: string
          invoice_id?: string
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
          amount_pkr: number
          created_at: string
          due_date: string | null
          id: string
          invoice_no: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_pkr?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_no: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_pkr?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_no?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          id: string
          key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          id?: string
          key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["template_channel"]
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_pkr: number
          created_at: string
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          received_at: string
          recorded_by: string | null
          reference: string | null
          tenant_id: string
        }
        Insert: {
          amount_pkr: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          recorded_by?: string | null
          reference?: string | null
          tenant_id: string
        }
        Update: {
          amount_pkr?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          recorded_by?: string | null
          reference?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          name: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          name: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_admin: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_admin?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_admin?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_actor_admin_fkey"
            columns: ["actor_admin"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_document_templates: {
        Row: {
          body: string
          key: string
        }
        Insert: {
          body: string
          key: string
        }
        Update: {
          body?: string
          key?: string
        }
        Relationships: []
      }
      platform_features: {
        Row: {
          description: string | null
          is_addon: boolean
          is_core: boolean
          key: string
          name: string
        }
        Insert: {
          description?: string | null
          is_addon?: boolean
          is_core?: boolean
          key: string
          name: string
        }
        Update: {
          description?: string | null
          is_addon?: boolean
          is_core?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      platform_message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          key: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          key: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["template_channel"]
          key?: string
        }
        Relationships: []
      }
      platform_plan_features: {
        Row: {
          feature_key: string
          plan_id: string
        }
        Insert: {
          feature_key: string
          plan_id: string
        }
        Update: {
          feature_key?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "platform_features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "platform_plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "platform_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plans: {
        Row: {
          created_at: string
          id: string
          interval: string
          is_active: boolean
          key: string
          max_properties: number
          name: string
          price_pkr: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval?: string
          is_active?: boolean
          key: string
          max_properties?: number
          name: string
          price_pkr?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interval?: string
          is_active?: boolean
          key?: string
          max_properties?: number
          name?: string
          price_pkr?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_signup_requests: {
        Row: {
          city: string
          contact_name: string
          created_at: string
          email: string
          hotel_name: string
          id: string
          notes: string | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          rooms: number | null
          status: Database["public"]["Enums"]["signup_status"]
          tenant_id: string | null
        }
        Insert: {
          city: string
          contact_name: string
          created_at?: string
          email: string
          hotel_name: string
          id?: string
          notes?: string | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["signup_status"]
          tenant_id?: string | null
        }
        Update: {
          city?: string
          contact_name?: string
          created_at?: string
          email?: string
          hotel_name?: string
          id?: string
          notes?: string | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["signup_status"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_signup_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_signup_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          check_in_time: string
          check_out_time: string
          city: string | null
          created_at: string
          currency: string
          early_departure_policy: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          ntn: string | null
          phone: string | null
          require_id_at_check_in: boolean
          strn: string | null
          tax_applies_to: string
          tax_mode: string
          tax_name: string | null
          tax_rate_pct: number
          tenant_id: string
          timezone: string
          updated_at: string
          wubook_lcode: string | null
        }
        Insert: {
          address?: string | null
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          created_at?: string
          currency?: string
          early_departure_policy?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          ntn?: string | null
          phone?: string | null
          require_id_at_check_in?: boolean
          strn?: string | null
          tax_applies_to?: string
          tax_mode?: string
          tax_name?: string | null
          tax_rate_pct?: number
          tenant_id: string
          timezone?: string
          updated_at?: string
          wubook_lcode?: string | null
        }
        Update: {
          address?: string | null
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          created_at?: string
          currency?: string
          early_departure_policy?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          ntn?: string | null
          phone?: string | null
          require_id_at_check_in?: boolean
          strn?: string | null
          tax_applies_to?: string
          tax_mode?: string
          tax_name?: string | null
          tax_rate_pct?: number
          tenant_id?: string
          timezone?: string
          updated_at?: string
          wubook_lcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_counters: {
        Row: {
          kind: string
          last_no: number
          property_id: string
        }
        Insert: {
          kind: string
          last_no?: number
          property_id: string
        }
        Update: {
          kind?: string
          last_no?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_counters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plans: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          property_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          property_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          property_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plans_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      rates: {
        Row: {
          date: string
          id: string
          price_pkr: number
          property_id: string
          rate_plan_id: string
          room_type_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          date: string
          id?: string
          price_pkr: number
          property_id: string
          rate_plan_id: string
          room_type_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          date?: string
          id?: string
          price_pkr?: number
          property_id?: string
          rate_plan_id?: string
          room_type_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rates_plan_property_fkey"
            columns: ["property_id", "rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["property_id", "id"]
          },
          {
            foreignKeyName: "rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_type_property_fkey"
            columns: ["property_id", "room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
      room_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["housekeeping_status"] | null
          id: number
          note: string | null
          property_id: string
          room_id: string
          tenant_id: string
          to_status: Database["public"]["Enums"]["housekeeping_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["housekeeping_status"]
            | null
          id?: never
          note?: string | null
          property_id: string
          room_id: string
          tenant_id: string
          to_status: Database["public"]["Enums"]["housekeeping_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["housekeeping_status"]
            | null
          id?: never
          note?: string | null
          property_id?: string
          room_id?: string
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["housekeeping_status"]
        }
        Relationships: [
          {
            foreignKeyName: "room_status_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_status_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_rooms_board"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          base_occupancy: number
          base_rate_pkr: number
          bed_config: string | null
          created_at: string
          id: string
          max_occupancy: number
          name: string
          property_id: string
          size_sqm: number | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_occupancy?: number
          base_rate_pkr?: number
          bed_config?: string | null
          created_at?: string
          id?: string
          max_occupancy?: number
          name: string
          property_id: string
          size_sqm?: number | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_occupancy?: number
          base_rate_pkr?: number
          bed_config?: string | null
          created_at?: string
          id?: string
          max_occupancy?: number
          name?: string
          property_id?: string
          size_sqm?: number | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_types_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          floor: number | null
          housekeeping_status: Database["public"]["Enums"]["housekeeping_status"]
          id: string
          is_active: boolean
          label: string
          property_id: string
          room_type_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor?: number | null
          housekeeping_status?: Database["public"]["Enums"]["housekeeping_status"]
          id?: string
          is_active?: boolean
          label: string
          property_id: string
          room_type_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor?: number | null
          housekeeping_status?: Database["public"]["Enums"]["housekeeping_status"]
          id?: string
          is_active?: boolean
          label?: string
          property_id?: string
          room_type_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "rooms_type_property_fkey"
            columns: ["property_id", "room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor: string | null
          at: string
          from_status: Database["public"]["Enums"]["subscription_status"] | null
          id: number
          reason: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          actor?: string | null
          at?: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: never
          reason?: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          actor?: string | null
          at?: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: never
          reason?: string | null
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_days: number
          notes: string | null
          plan_id: string
          read_only_days: number
          status: Database["public"]["Enums"]["subscription_status"]
          suspended_at: string | null
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_days?: number
          notes?: string | null
          plan_id: string
          read_only_days?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_days?: number
          notes?: string | null
          plan_id?: string
          read_only_days?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "platform_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          address: string | null
          legal_name: string | null
          logo_url: string | null
          ntn: string | null
          primary_color: string | null
          strn: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          legal_name?: string | null
          logo_url?: string | null
          ntn?: string | null
          primary_color?: string | null
          strn?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          legal_name?: string | null
          logo_url?: string | null
          ntn?: string | null
          primary_color?: string | null
          strn?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          ends_at: string | null
          feature_key: string
          granted_by: string | null
          id: string
          reason: string | null
          starts_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled: boolean
          ends_at?: string | null
          feature_key: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          starts_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          feature_key?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          starts_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "platform_features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          schema_version: number
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          schema_version?: number
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          schema_version?: number
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_bookings: {
        Row: {
          adults: number | null
          balance: number | null
          booking_no: string | null
          booking_room_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          check_in: string | null
          check_out: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkout_override_reason: string | null
          children: number | null
          created_at: string | null
          folio_id: string | null
          folio_no: string | null
          folio_status: Database["public"]["Enums"]["folio_status"] | null
          guest_has_id: boolean | null
          guest_id: string | null
          guest_name: string | null
          guest_nationality: string | null
          guest_phone: string | null
          id: string | null
          nightly_rate_pkr: number | null
          nights: number | null
          no_show_at: string | null
          notes: string | null
          property_id: string | null
          room_hk_status:
            | Database["public"]["Enums"]["housekeeping_status"]
            | null
          room_id: string | null
          room_label: string | null
          room_type_id: string | null
          room_type_name: string | null
          source: Database["public"]["Enums"]["booking_source"] | null
          status: Database["public"]["Enums"]["booking_status"] | null
          tenant_id: string | null
          total_charges: number | null
          total_payments: number | null
          total_tax: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_rooms_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "v_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_guest_fkey"
            columns: ["tenant_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_guest_fkey"
            columns: ["tenant_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "v_guests"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_guests: {
        Row: {
          address: string | null
          created_at: string | null
          custom_fields: Json | null
          due: number | null
          email: string | null
          has_id: boolean | null
          id: string | null
          id_expiry: string | null
          id_number: string | null
          id_type: string | null
          in_house: boolean | null
          last_check_in: string | null
          name: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          stays: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rooms_board: {
        Row: {
          current_balance: number | null
          current_booking_id: string | null
          current_booking_no: string | null
          current_check_in: string | null
          current_check_out: string | null
          current_guest_name: string | null
          floor: number | null
          housekeeping_status:
            | Database["public"]["Enums"]["housekeeping_status"]
            | null
          id: string | null
          is_active: boolean | null
          label: string | null
          next_booking_id: string | null
          next_check_in: string | null
          next_check_out: string | null
          next_guest_name: string | null
          property_id: string | null
          room_type_id: string | null
          room_type_name: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_tenant_property_fkey"
            columns: ["tenant_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "rooms_type_property_fkey"
            columns: ["property_id", "room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
    }
    Functions: {
      _assert_booking_writer: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      _assert_cashier: { Args: { p_tenant_id: string }; Returns: undefined }
      _assign_room: {
        Args: {
          p_booking_id: string
          p_check_in: string
          p_check_out: string
          p_rate: number
          p_room_id: string
        }
        Returns: undefined
      }
      _post_room_nights: {
        Args: {
          p_booking_id: string
          p_from: string
          p_rate: number
          p_to: string
        }
        Returns: number
      }
      _shift_expected: { Args: { p_shift_id: string }; Returns: Json }
      _validate_method_amounts: {
        Args: { p: Json; p_label: string }
        Returns: Json
      }
      _void_room_nights: {
        Args: { p_booking_id: string; p_from: string; p_reason: string }
        Returns: number
      }
      booking_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["booking_status"]
          p_role: Database["public"]["Enums"]["tenant_role"]
          p_to: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      close_cash_shift: {
        Args: { p_declared: Json; p_notes?: string; p_shift_id: string }
        Returns: Json
      }
      close_folio: { Args: { p_folio_id: string }; Returns: undefined }
      confirm_cash_shift: {
        Args: { p_confirmed: Json; p_notes?: string; p_shift_id: string }
        Returns: Json
      }
      create_booking: {
        Args: {
          p_adults: number
          p_check_in: string
          p_check_in_now?: boolean
          p_check_out: string
          p_children?: number
          p_deposit?: number
          p_deposit_method?: Database["public"]["Enums"]["payment_method"]
          p_guest_id?: string
          p_guest_id_number?: string
          p_guest_id_type?: string
          p_guest_name?: string
          p_guest_nationality?: string
          p_guest_phone?: string
          p_nightly_rate: number
          p_notes?: string
          p_property_id: string
          p_room_id: string
          p_source: Database["public"]["Enums"]["booking_source"]
        }
        Returns: string
      }
      current_role_in_tenant: {
        Args: never
        Returns: Database["public"]["Enums"]["tenant_role"]
      }
      current_tenant_id: { Args: never; Returns: string }
      daily_report: {
        Args: { p_date?: string; p_property_id: string }
        Returns: Json
      }
      is_platform_admin: { Args: never; Returns: boolean }
      my_memberships: {
        Args: never
        Returns: {
          name: string
          role: Database["public"]["Enums"]["tenant_role"]
          slug: string
          tenant_id: string
        }[]
      }
      my_tenant_access: {
        Args: never
        Returns: {
          access_level: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
        }[]
      }
      next_booking_no: { Args: { p_property_id: string }; Returns: string }
      next_doc_no: {
        Args: { p_kind: string; p_property_id: string }
        Returns: string
      }
      normalize_phone: { Args: { p_input: string }; Returns: string }
      open_cash_shift: {
        Args: {
          p_notes?: string
          p_opening_float?: number
          p_property_id: string
        }
        Returns: string
      }
      property_today: { Args: { p_property_id: string }; Returns: string }
      provision_tenant: {
        Args: {
          p_city?: string
          p_name: string
          p_owner_user?: string
          p_plan_key?: string
          p_property_name: string
          p_slug: string
        }
        Returns: string
      }
      reopen_folio: {
        Args: { p_folio_id: string; p_reason: string }
        Returns: undefined
      }
      run_billing_transitions: { Args: never; Returns: number }
      set_active_tenant: { Args: { p_slug: string }; Returns: string }
      set_booking_status: {
        Args: {
          p_booking_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
      tenant_access_level: { Args: never; Returns: string }
      tenant_has_feature: { Args: { p_key: string }; Returns: boolean }
      tenant_members: {
        Args: never
        Returns: {
          created_at: string
          email: string
          membership_id: string
          role: Database["public"]["Enums"]["tenant_role"]
          user_id: string
        }[]
      }
      update_booking: {
        Args: {
          p_adults: number
          p_booking_id: string
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_nightly_rate: number
          p_notes?: string
          p_room_id: string
          p_source: Database["public"]["Enums"]["booking_source"]
        }
        Returns: undefined
      }
      void_folio_item: {
        Args: { p_item_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_source: "walk_in" | "phone" | "whatsapp" | "ota" | "direct"
      booking_status:
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      cash_shift_status: "open" | "handed_over" | "confirmed"
      custom_field_entity: "guest" | "booking"
      custom_field_type: "text" | "number" | "date" | "select" | "boolean"
      folio_item_kind: "charge" | "payment" | "discount" | "refund"
      folio_status: "open" | "closed"
      housekeeping_status: "clean" | "dirty" | "inspected" | "out_of_order"
      invoice_status: "draft" | "sent" | "paid" | "void"
      payment_method:
        | "bank_transfer"
        | "raast"
        | "jazzcash"
        | "easypaisa"
        | "cash"
      signup_status: "pending" | "approved" | "rejected"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "read_only"
        | "suspended"
        | "cancelled"
      task_status: "pending" | "in_progress" | "done"
      template_channel: "whatsapp" | "email"
      tenant_role:
        | "owner"
        | "manager"
        | "front_desk"
        | "housekeeping"
        | "accounts"
        | "read_only"
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
      booking_source: ["walk_in", "phone", "whatsapp", "ota", "direct"],
      booking_status: [
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      cash_shift_status: ["open", "handed_over", "confirmed"],
      custom_field_entity: ["guest", "booking"],
      custom_field_type: ["text", "number", "date", "select", "boolean"],
      folio_item_kind: ["charge", "payment", "discount", "refund"],
      folio_status: ["open", "closed"],
      housekeeping_status: ["clean", "dirty", "inspected", "out_of_order"],
      invoice_status: ["draft", "sent", "paid", "void"],
      payment_method: [
        "bank_transfer",
        "raast",
        "jazzcash",
        "easypaisa",
        "cash",
      ],
      signup_status: ["pending", "approved", "rejected"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "read_only",
        "suspended",
        "cancelled",
      ],
      task_status: ["pending", "in_progress", "done"],
      template_channel: ["whatsapp", "email"],
      tenant_role: [
        "owner",
        "manager",
        "front_desk",
        "housekeeping",
        "accounts",
        "read_only",
      ],
    },
  },
} as const
