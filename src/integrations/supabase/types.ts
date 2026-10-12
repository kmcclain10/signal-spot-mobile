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
      connections: {
        Row: {
          config: Json
          created_at: string
          environment: string
          id: string
          is_default_broker: boolean
          is_default_data: boolean
          label: string
          last_tested_at: string | null
          provider: string
          secret_cipher: string | null
          secret_hint: string | null
          secret_iv: string | null
          status: string
          status_detail: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          environment?: string
          id?: string
          is_default_broker?: boolean
          is_default_data?: boolean
          label: string
          last_tested_at?: string | null
          provider: string
          secret_cipher?: string | null
          secret_hint?: string | null
          secret_iv?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          environment?: string
          id?: string
          is_default_broker?: boolean
          is_default_data?: boolean
          label?: string
          last_tested_at?: string | null
          provider?: string
          secret_cipher?: string | null
          secret_hint?: string | null
          secret_iv?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engine_runs: {
        Row: {
          by_year: Json | null
          equity: Json | null
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          most_selected: Json | null
          rule: Json | null
          started_at: string
          status: string
          summary: Json | null
          user_id: string
        }
        Insert: {
          by_year?: Json | null
          equity?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          most_selected?: Json | null
          rule?: Json | null
          started_at?: string
          status?: string
          summary?: Json | null
          user_id: string
        }
        Update: {
          by_year?: Json | null
          equity?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          most_selected?: Json | null
          rule?: Json | null
          started_at?: string
          status?: string
          summary?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          broker_order_id: string | null
          connection_id: string | null
          created_at: string
          entry: number | null
          environment: string
          id: string
          qty: number
          raw: Json | null
          side: string
          signal_id: string | null
          status: string
          stop: number | null
          symbol: string
          target: number | null
          user_id: string
        }
        Insert: {
          broker_order_id?: string | null
          connection_id?: string | null
          created_at?: string
          entry?: number | null
          environment: string
          id?: string
          qty: number
          raw?: Json | null
          side: string
          signal_id?: string | null
          status?: string
          stop?: number | null
          symbol: string
          target?: number | null
          user_id: string
        }
        Update: {
          broker_order_id?: string | null
          connection_id?: string | null
          created_at?: string
          entry?: number | null
          environment?: string
          id?: string
          qty?: number
          raw?: Json | null
          side?: string
          signal_id?: string | null
          status?: string
          stop?: number | null
          symbol?: string
          target?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      picks: {
        Row: {
          bt_avg_r: number | null
          bt_profit_factor: number | null
          bt_trades: number | null
          bt_win_rate: number | null
          id: string
          run_id: string | null
          strategy_id: string
          trade_date: string
          user_id: string
        }
        Insert: {
          bt_avg_r?: number | null
          bt_profit_factor?: number | null
          bt_trades?: number | null
          bt_win_rate?: number | null
          id?: string
          run_id?: string | null
          strategy_id: string
          trade_date: string
          user_id: string
        }
        Update: {
          bt_avg_r?: number | null
          bt_profit_factor?: number | null
          bt_trades?: number | null
          bt_win_rate?: number | null
          id?: string
          run_id?: string | null
          strategy_id?: string
          trade_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "engine_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          lookback_days: number
          max_daily_loss_usd: number
          max_open_positions: number
          min_profit_factor: number
          min_trades: number
          min_win_rate: number
          risk_per_trade_usd: number
          trading_mode: string
          updated_at: string
          user_id: string
          watchlist: string[]
        }
        Insert: {
          lookback_days?: number
          max_daily_loss_usd?: number
          max_open_positions?: number
          min_profit_factor?: number
          min_trades?: number
          min_win_rate?: number
          risk_per_trade_usd?: number
          trading_mode?: string
          updated_at?: string
          user_id: string
          watchlist?: string[]
        }
        Update: {
          lookback_days?: number
          max_daily_loss_usd?: number
          max_open_positions?: number
          min_profit_factor?: number
          min_trades?: number
          min_win_rate?: number
          risk_per_trade_usd?: number
          trading_mode?: string
          updated_at?: string
          user_id?: string
          watchlist?: string[]
        }
        Relationships: []
      }
      signals: {
        Row: {
          created_at: string
          entry: number
          id: string
          side: string
          signal_time: string
          status: string
          stop: number
          strategy_id: string
          symbol: string
          target: number | null
          trade_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry: number
          id?: string
          side: string
          signal_time: string
          status?: string
          stop: number
          strategy_id: string
          symbol: string
          target?: number | null
          trade_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry?: number
          id?: string
          side?: string
          signal_time?: string
          status?: string
          stop?: number
          strategy_id?: string
          symbol?: string
          target?: number | null
          trade_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          family: string
          id: string
          params: Json
          side: string
          stop_atr: number
          target_r: number | null
        }
        Insert: {
          family: string
          id: string
          params?: Json
          side: string
          stop_atr: number
          target_r?: number | null
        }
        Update: {
          family?: string
          id?: string
          params?: Json
          side?: string
          stop_atr?: number
          target_r?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
