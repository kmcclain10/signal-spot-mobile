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
      account_disclosure_acceptance: {
        Row: {
          accepted_at: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      bot_errors: {
        Row: {
          created_at: string
          id: string
          message: string
          payload: Json | null
          user_id: string
          where: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          payload?: Json | null
          user_id: string
          where: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          payload?: Json | null
          user_id?: string
          where?: string
        }
        Relationships: []
      }
      bot_runs: {
        Row: {
          duration_ms: number
          error: string | null
          finished_at: string
          id: string
          ok: boolean
          started_at: string
          user_id: string
        }
        Insert: {
          duration_ms: number
          error?: string | null
          finished_at?: string
          id?: string
          ok: boolean
          started_at: string
          user_id: string
        }
        Update: {
          duration_ms?: number
          error?: string | null
          finished_at?: string
          id?: string
          ok?: boolean
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      iwm_bank_events: {
        Row: {
          amount_banked: number
          banked_total: number
          created_at: string
          id: string
          new_cycle: number
          restart_balance: number
          user_id: string
        }
        Insert: {
          amount_banked: number
          banked_total: number
          created_at?: string
          id?: string
          new_cycle: number
          restart_balance: number
          user_id: string
        }
        Update: {
          amount_banked?: number
          banked_total?: number
          created_at?: string
          id?: string
          new_cycle?: number
          restart_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      iwm_daily_reports: {
        Row: {
          banked_today: number
          banked_total: number
          day: string
          ending_bankroll: number
          id: string
          losses: number
          pnl: number
          trades: number
          user_id: string
          win_rate: number
          wins: number
        }
        Insert: {
          banked_today: number
          banked_total: number
          day: string
          ending_bankroll: number
          id?: string
          losses: number
          pnl: number
          trades: number
          user_id: string
          win_rate: number
          wins: number
        }
        Update: {
          banked_today?: number
          banked_total?: number
          day?: string
          ending_bankroll?: number
          id?: string
          losses?: number
          pnl?: number
          trades?: number
          user_id?: string
          win_rate?: number
          wins?: number
        }
        Relationships: []
      }
      iwm_protection_events: {
        Row: {
          created_at: string
          floor_locked_pct: number
          id: string
          peak_gain_pct: number
          premium: number
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          floor_locked_pct: number
          id?: string
          peak_gain_pct: number
          premium: number
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          floor_locked_pct?: number
          id?: string
          peak_gain_pct?: number
          premium?: number
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iwm_protection_events_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "iwm_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      iwm_signals: {
        Row: {
          action: string | null
          bar_time: string
          created_at: string
          detail: string | null
          ema20: number | null
          ema8: number | null
          id: string
          kind: string
          osc: number | null
          price: number
          side: string
          user_id: string
          window: number
        }
        Insert: {
          action?: string | null
          bar_time: string
          created_at?: string
          detail?: string | null
          ema20?: number | null
          ema8?: number | null
          id?: string
          kind: string
          osc?: number | null
          price: number
          side: string
          user_id: string
          window: number
        }
        Update: {
          action?: string | null
          bar_time?: string
          created_at?: string
          detail?: string | null
          ema20?: number | null
          ema8?: number | null
          id?: string
          kind?: string
          osc?: number | null
          price?: number
          side?: string
          user_id?: string
          window?: number
        }
        Relationships: []
      }
      iwm_strategy_settings: {
        Row: {
          bank_trigger: number
          data_feed: string
          discord_enabled: boolean
          enabled: boolean
          force_exit_time: string
          kill_switch: boolean
          max_daily_loss: number
          max_trades_per_day: number
          options_feed: string
          starting_bankroll: number
          stop_loss_pct: number
          timeframe_min: number
          user_id: string
        }
        Insert: {
          bank_trigger?: number
          data_feed?: string
          discord_enabled?: boolean
          enabled?: boolean
          force_exit_time?: string
          kill_switch?: boolean
          max_daily_loss?: number
          max_trades_per_day?: number
          options_feed?: string
          starting_bankroll?: number
          stop_loss_pct?: number
          timeframe_min?: number
          user_id: string
        }
        Update: {
          bank_trigger?: number
          data_feed?: string
          discord_enabled?: boolean
          enabled?: boolean
          force_exit_time?: string
          kill_switch?: boolean
          max_daily_loss?: number
          max_trades_per_day?: number
          options_feed?: string
          starting_bankroll?: number
          stop_loss_pct?: number
          timeframe_min?: number
          user_id?: string
        }
        Relationships: []
      }
      iwm_strategy_state: {
        Row: {
          alerted_keys: Json
          balance: number | null
          banked_today: number
          banked_total: number
          cycles: number
          last_bar_time: string | null
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          lock_token: string | null
          lock_until: string | null
          losses_today: number
          needs_review: string | null
          open_trade: Json | null
          pending_order: Json | null
          pnl_today: number
          reported_day: string | null
          session_close: string | null
          trades_today: number
          trading_day: string | null
          user_id: string
          wins_today: number
        }
        Insert: {
          alerted_keys?: Json
          balance?: number | null
          banked_today?: number
          banked_total?: number
          cycles?: number
          last_bar_time?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lock_token?: string | null
          lock_until?: string | null
          losses_today?: number
          needs_review?: string | null
          open_trade?: Json | null
          pending_order?: Json | null
          pnl_today?: number
          reported_day?: string | null
          session_close?: string | null
          trades_today?: number
          trading_day?: string | null
          user_id: string
          wins_today?: number
        }
        Update: {
          alerted_keys?: Json
          balance?: number | null
          banked_today?: number
          banked_total?: number
          cycles?: number
          last_bar_time?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lock_token?: string | null
          lock_until?: string | null
          losses_today?: number
          needs_review?: string | null
          open_trade?: Json | null
          pending_order?: Json | null
          pnl_today?: number
          reported_day?: string | null
          session_close?: string | null
          trades_today?: number
          trading_day?: string | null
          user_id?: string
          wins_today?: number
        }
        Relationships: []
      }
      iwm_trades: {
        Row: {
          alpaca_entry_order_id: string | null
          alpaca_exit_order_id: string | null
          bankroll_after: number | null
          contracts: number
          cycle: number | null
          entry_premium: number
          entry_time: string
          entry_underlying: number | null
          exit_premium: number | null
          exit_reason: string | null
          exit_time: string | null
          exit_underlying: number | null
          expiry: string
          final_floor_pct: number | null
          gain_pct: number | null
          id: string
          option_symbol: string
          peak_gain_pct: number | null
          peak_premium: number | null
          pnl: number | null
          side: string
          status: string
          strike: number
          user_id: string
          window: number
        }
        Insert: {
          alpaca_entry_order_id?: string | null
          alpaca_exit_order_id?: string | null
          bankroll_after?: number | null
          contracts: number
          cycle?: number | null
          entry_premium: number
          entry_time: string
          entry_underlying?: number | null
          exit_premium?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          exit_underlying?: number | null
          expiry: string
          final_floor_pct?: number | null
          gain_pct?: number | null
          id?: string
          option_symbol: string
          peak_gain_pct?: number | null
          peak_premium?: number | null
          pnl?: number | null
          side: string
          status?: string
          strike: number
          user_id: string
          window: number
        }
        Update: {
          alpaca_entry_order_id?: string | null
          alpaca_exit_order_id?: string | null
          bankroll_after?: number | null
          contracts?: number
          cycle?: number | null
          entry_premium?: number
          entry_time?: string
          entry_underlying?: number | null
          exit_premium?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          exit_underlying?: number | null
          expiry?: string
          final_floor_pct?: number | null
          gain_pct?: number | null
          id?: string
          option_symbol?: string
          peak_gain_pct?: number | null
          peak_premium?: number | null
          pnl?: number | null
          side?: string
          status?: string
          strike?: number
          user_id?: string
          window?: number
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
      pulse_bot_configs: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          kill_switch: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kill_switch?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kill_switch?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pulse_bot_events: {
        Row: {
          bot_id: string
          created_at: string
          detail: Json
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_bot_events_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "pulse_bot_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_bot_leases: {
        Row: {
          lease_until: string | null
          token: string | null
          user_id: string
        }
        Insert: {
          lease_until?: string | null
          token?: string | null
          user_id: string
        }
        Update: {
          lease_until?: string | null
          token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pulse_bot_states: {
        Row: {
          bot_id: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_bot_states_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "pulse_bot_configs"
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
      has_recent_password_auth: { Args: never; Returns: boolean }
      iwm_acquire_lock: {
        Args: { p_token: string; p_user_id: string }
        Returns: {
          alerted_keys: Json
          balance: number | null
          banked_today: number
          banked_total: number
          cycles: number
          last_bar_time: string | null
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          lock_token: string | null
          lock_until: string | null
          losses_today: number
          needs_review: string | null
          open_trade: Json | null
          pending_order: Json | null
          pnl_today: number
          reported_day: string | null
          session_close: string | null
          trades_today: number
          trading_day: string | null
          user_id: string
          wins_today: number
        }[]
        SetofOptions: {
          from: "*"
          to: "iwm_strategy_state"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      iwm_save_state: {
        Args: {
          p_events?: Json
          p_state: Json
          p_token: string
          p_user_id: string
        }
        Returns: undefined
      }
      pulse_acquire_lease: {
        Args: { p_token: string; p_user_id: string }
        Returns: boolean
      }
      pulse_checkpoint: {
        Args: {
          p_bot_id: string
          p_state: Json
          p_token: string
          p_user_id: string
        }
        Returns: undefined
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
