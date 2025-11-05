export type Role = 'user' | 'admin';

export type PlayerCategory =
  | 'top_scorer'
  | 'top_assist'
  | 'top_rebound'
  | 'top_dunk'
  | 'top_threes';

export type WeeklyXPTotal = {
  user_id: string;
  week_start_sunday: string;
  weekly_xp: number;
};

export type WeeklyRankingRow = {
  user_id: string;
  full_name: string;
  week_start_sunday: string;
  weekly_xp: number;
};

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
          home_team_abbr: string | null;
          away_team_abbr: string | null;
          home_team_name: string | null;
          away_team_name: string | null;
          created_at: string;
          updated_at: string | null;
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
          home_team_abbr?: string | null;
          away_team_abbr?: string | null;
          home_team_name?: string | null;
          away_team_name?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['games']['Row'], 'id'>>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          provider: string;
          provider_team_id: string;
          abbr: string;
          name: string;
          city: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          provider_team_id: string;
          abbr: string;
          name: string;
          city?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['teams']['Row'], 'id'>>;
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
          selected_team_abbr: string | null;
          selected_team_name: string | null;
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
          selected_team_abbr?: string | null;
          selected_team_name?: string | null;
          pick_date: string;
          changes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['picks_teams']['Row'], 'id'>
        >;
        Relationships: [
          {
            foreignKeyName: 'picks_teams_game_id_fkey';
            columns: ['game_id'];
            referencedRelation: 'games';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'picks_teams_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'picks_players_game_id_fkey';
            columns: ['game_id'];
            referencedRelation: 'games';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'picks_players_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'picks_players_player_id_fkey';
            columns: ['player_id'];
            referencedRelation: 'player';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'picks_highlights_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
          {
            foreignKeyName: 'picks_highlights_player_id_fkey';
            columns: ['player_id'];
            referencedRelation: 'player';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
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
    Views: {
      weekly_xp_totals: {
        Row: WeeklyXPTotal;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      weekly_xp_ranking_current: {
        Row: WeeklyRankingRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      v_results_team_with_names: {
        Row: {
          game_id: string;
          winner_team_id: string | null;
          slate_date: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      role_enum: Role;
      player_category: PlayerCategory;
    };
    CompositeTypes: never;
  };
}
