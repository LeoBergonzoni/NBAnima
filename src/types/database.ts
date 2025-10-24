export type Role = 'user' | 'admin';

export type PlayerCategory =
  | 'top_scorer'
  | 'top_assist'
  | 'top_rebound'
  | 'top_dunk'
  | 'top_threes';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: Role;
          anima_points_balance: number;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          role?: Role;
          anima_points_balance?: number;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['users']['Row'], 'id'>>;
        Relationships: [];
      };
      anima_points_ledger: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          balance_after: number;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta: number;
          balance_after: number;
          reason: string;
          created_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['anima_points_ledger']['Row'], 'id'>
        >;
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          provider: string;
          provider_game_id: string;
          season: string;
          status: string;
          game_date: string;
          locked_at: string | null;
          home_team_id: string;
          away_team_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          provider_game_id: string;
          season: string;
          status: string;
          game_date: string;
          locked_at?: string | null;
          home_team_id: string;
          away_team_id: string;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['games']['Row'], 'id'>>;
        Relationships: [];
      };
      player: {
        Row: {
          id: string;
          provider: string;
          provider_player_id: string;
          team_id: string;
          first_name: string;
          last_name: string;
          position: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          provider_player_id: string;
          team_id: string;
          first_name: string;
          last_name: string;
          position?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['player']['Row'], 'id'>>;
        Relationships: [];
      };
      picks_teams: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          selected_team_id: string;
          pick_date: string;
          changes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          selected_team_id: string;
          pick_date: string;
          changes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['picks_teams']['Row'], 'id'>
        >;
        Relationships: [];
      };
      picks_players: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          category: PlayerCategory;
          player_id: string;
          pick_date: string;
          changes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          category: PlayerCategory;
          player_id: string;
          pick_date: string;
          changes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['picks_players']['Row'], 'id'>
        >;
        Relationships: [];
      };
      picks_highlights: {
        Row: {
          id: string;
          user_id: string;
          player_id: string;
          rank: number;
          pick_date: string;
          changes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          player_id: string;
          rank: number;
          pick_date: string;
          changes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['picks_highlights']['Row'], 'id'>
        >;
        Relationships: [];
      };
      results_team: {
        Row: {
          id: string;
          game_id: string;
          winner_team_id: string;
          settled_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          winner_team_id: string;
          settled_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['results_team']['Row'], 'id'>
        >;
        Relationships: [];
      };
      results_players: {
        Row: {
          id: string;
          game_id: string;
          category: PlayerCategory;
          player_id: string;
          settled_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          category: PlayerCategory;
          player_id: string;
          settled_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['results_players']['Row'], 'id'>
        >;
        Relationships: [];
      };
      results_highlights: {
        Row: {
          id: string;
          player_id: string;
          rank: number;
          result_date: string;
          settled_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          rank: number;
          result_date: string;
          settled_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['results_highlights']['Row'], 'id'>
        >;
        Relationships: [];
      };
      user_cards: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          acquired_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          acquired_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['user_cards']['Row'], 'id'>
        >;
        Relationships: [];
      };
      shop_cards: {
        Row: {
          id: string;
          name: string;
          description: string;
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
          price: number;
          image_url: string;
          accent_color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
          price: number;
          image_url: string;
          accent_color?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['shop_cards']['Row'], 'id'>
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role_enum: Role;
      player_category: PlayerCategory;
    };
    CompositeTypes: never;
  };
}
