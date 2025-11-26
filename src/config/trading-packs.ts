export type PackId = 'pearl' | 'silver' | 'gold';

export type PackDefinition = {
  id: PackId;
  name: string;
  price: number;
  image: string;
  accent: string;
  odds: {
    common: number;
    rare: number;
    legendary: number;
  };
  description: {
    it: string;
    en: string;
  };
};

export const PACK_DEFINITIONS: PackDefinition[] = [
  {
    id: 'pearl',
    name: 'Pearl Pack',
    price: 5000,
    image: '/PackagePearl.png',
    accent: '#b3e5fc',
    odds: {
      common: 0.9,
      rare: 0.07,
      legendary: 0.03,
    },
    description: {
      it: '4 carte con probabilità 90% Common, 7% Rare, 3% Legendary.',
      en: '4 cards with 90% Common, 7% Rare, 3% Legendary odds.',
    },
  },
  {
    id: 'silver',
    name: 'Silver Pack',
    price: 10000,
    image: '/PackageSilver.png',
    accent: '#e5e7eb',
    odds: {
      common: 0.8,
      rare: 0.15,
      legendary: 0.05,
    },
    description: {
      it: '4 carte con probabilità 80% Common, 15% Rare, 5% Legendary.',
      en: '4 cards with 80% Common, 15% Rare, 5% Legendary odds.',
    },
  },
  {
    id: 'gold',
    name: 'Gold Pack',
    price: 20000,
    image: '/PackageGold.png',
    accent: '#f59e0b',
    odds: {
      common: 0.7,
      rare: 0.22,
      legendary: 0.08,
    },
    description: {
      it: '4 carte con probabilità 70% Common, 22% Rare, 8% Legendary.',
      en: '4 cards with 70% Common, 22% Rare, 8% Legendary odds.',
    },
  },
] as const;

export const PACK_DEFINITION_MAP: Record<PackId, PackDefinition> = PACK_DEFINITIONS.reduce(
  (acc, pack) => {
    acc[pack.id] = pack;
    return acc;
  },
  {} as Record<PackId, PackDefinition>,
);
