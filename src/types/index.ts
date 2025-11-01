export type ResultWinner = {
  id: string;
  game_id: string;
  slate_date: string;
  winner_team_id: string | null;
  winner_name: string;
  winner_abbr: string;
  winner_city: string | null;
};

export type TeamPick = {
  user_id: string;
  game_id: string;
  slate_date: string;
  selected_team_id: string;
  selected_team_name?: string | null;
  selected_team_abbr?: string | null;
};

export type MyPickWithOutcome = TeamPick & {
  outcome: 'WIN' | 'LOSS' | 'PENDING';
  winner_team_id?: string | null;
};
