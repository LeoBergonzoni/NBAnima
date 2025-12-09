export type CardCategory = 'Player' | 'Celebration' | 'Courtside' | 'Iconic';
export type CardConference = 'Eastern Conference' | 'Western Conference' | 'Special';

export interface ShopCard {
  id: string;
  name: string;
  description: string;
  rarity: string;
  price: number;
  image_url: string;
  accent_color: string | null;
  category: CardCategory;
  conference: CardConference;
}
