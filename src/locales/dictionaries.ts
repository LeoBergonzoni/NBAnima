import type { Locale } from '@/lib/constants';

export interface Dictionary {
  common: {
    play: string;
    collection: string;
    shop: string;
    admin: string;
    highlights: string;
    loading: string;
    save: string;
    edit: string;
    cancel: string;
    confirm: string;
    language: string;
    logout: string;
  };
  home: {
    heroTitle: string;
    heroTitleEn: string;
    heroSubtitle: string;
    heroSubtitleEn: string;
    bullets: string[];
    onboarding: Array<{
      title: string;
      titleEn: string;
      description: string;
      descriptionEn: string;
      image: string;
      imageAlt: string;
    }>;
    ctaRegister: string;
    ctaLogin: string;
  };
  dashboard: {
    welcome: string;
    animaPoints: string;
    playTab: string;
    collectionTab: string;
    shopTab: string;
    statusCompleted: string;
    statusPending: string;
    lockWindowActive: string;
    lastUpdated: string;
  };
  play: {
    title: string;
    subtitle: string;
    teams: {
      title: string;
      description: string;
    };
    players: {
      title: string;
      description: string;
      categories: {
        top_scorer: string;
        top_assist: string;
        top_rebound: string;
        top_dunk: string;
        top_threes: string;
      };
    };
    highlights: {
      title: string;
      description: string;
    };
    submit: string;
    update: string;
    changesHintAvailable: string;
    changesHintExhausted: string;
  };
  collection: {
    empty: string;
    title: string;
  };
  shop: {
    title: string;
    buy: string;
    insufficientPoints: string;
    confirmTitle: string;
    confirmBody: string;
  };
  admin: {
    title: string;
    usersTab: string;
    picksTab: string;
    highlightsTab: string;
    searchPlaceholder: string;
    balance: string;
    cards: string;
    picksFor: string;
    dateLabel: string;
    applyHighlights: string;
    rank: string;
  };
  auth: {
    login: {
      title: string;
      subtitle: string;
      submit: string;
      switchPrompt: string;
      switchCta: string;
    };
    signup: {
      title: string;
      subtitle: string;
      submit: string;
      switchPrompt: string;
      switchCta: string;
    };
    fields: {
      email: string;
      password: string;
      confirmPassword: string;
    };
    errors: {
      mismatch: string;
      generic: string;
    };
  };
}

const it: Dictionary = {
  common: {
    play: 'Gioca',
    collection: 'Collezione',
    shop: 'Acquista Cards',
    admin: 'Admin',
    highlights: 'Highlights',
    loading: 'Caricamento…',
    save: 'Salva',
    edit: 'Modifica',
    cancel: 'Annulla',
    confirm: 'Conferma',
    language: 'Lingua',
    logout: 'Esci',
  },
  home: {
    heroTitle: 'NBAnima — La web app che rende ancora più ANIMAta l’NBA!',
    heroTitleEn: 'NBAnima — The web app that makes the NBA even more ANIMA-ted!',
    heroSubtitle:
      'Sfida i tuoi amici, accumula Anima Points e colleziona carte epiche dedicate ai tuoi idoli NBA.',
    heroSubtitleEn:
      'Challenge friends, earn Anima Points, and collect epic cards inspired by NBA legends.',
    bullets: [
      'Prevedi i risultati di ogni notte NBA: squadre, giocatori e Top 10 Highlights.',
      'Blocca le tue scelte prima della palla a due e ottieni bonus moltiplicatori.',
      'Guadagna Anima Points e sblocca cards esclusive nel nostro shop dinamico.',
    ],
    onboarding: [
      {
        title: 'Predict every NBA matchup',
        titleEn: 'Indovina i risultati delle partite NBA',
        description:
          'Study the slate, pick your winner, and stay in the hunt for nightly glory.',
        descriptionEn:
          'Studia il calendario, scegli la vincente e vivi la corsa alla gloria con NBAnima.',
        image: '/loghi-squadre/LALAkers.png',
        imageAlt: 'Los Angeles Lakers logo',
      },
      {
        title: 'Draft your Top performers',
        titleEn: 'Scegli i tuoi giocatori Top',
        description:
          'Lock in the stars who will dominate points, assists, and rebounds for multiplier bonuses.',
        descriptionEn:
          'Punta sulle stelle che domineranno punti, assist e rimbalzi per moltiplicare i punti.',
        image: '/loghi-squadre/GSWarriors.png',
        imageAlt: 'Golden State Warriors logo',
      },
      {
        title: 'Earn Anima Points and collect legendary cards!',
        titleEn: 'Guadagna Anima Points e colleziona card leggendarie!',
        description:
          'Redeem exclusive digital collectibles to power up your roster and flex your fandom.',
        descriptionEn:
          'Riscatta ricompense esclusive per potenziare il roster e mostrare la tua passione.',
        image: '/cards/KobeWinninFistCard.png',
        imageAlt: 'Kobe Bryant Anima card',
      },
      {
        title: 'Climb the leaderboard and prove your NBA spirit!',
        titleEn: 'Scala la classifica e dimostra la tua anima NBA!',
        description:
          'Celebrate the wins, challenge friends, and become the legend of NBA nights.',
        descriptionEn:
          'Condividi le vittorie, supera gli amici e diventa l’icona delle notti NBA.',
        image: '/1AnimaPoint.png',
        imageAlt: 'Anima Point token',
      },
    ],
    ctaRegister: 'Registrati',
    ctaLogin: 'Accedi',
  },
  dashboard: {
    welcome: 'Bentornato su NBAnima!',
    animaPoints: 'Saldo Anima Points',
    playTab: 'Gioca',
    collectionTab: 'Collezione',
    shopTab: 'Acquista Cards',
    statusCompleted: 'Completato',
    statusPending: 'Da completare',
    lockWindowActive: 'Window di gioco attiva, non puoi modificare le scelte.',
    lastUpdated: 'Ultimo aggiornamento',
  },
  play: {
    title: 'Preparati alla prossima notte NBA',
    subtitle:
      'Completa le tre sfide per ottenere il check verde e massimizzare i tuoi Anima Points.',
    teams: {
      title: 'Teams',
      description: 'Scegli la squadra vincente per ogni partita della prossima notte.',
    },
    players: {
      title: 'Players',
      description:
        'Seleziona i protagonisti per punti, assist, rimbalzi, schiacciate e triple.',
      categories: {
        top_scorer: 'Top Scorer',
        top_assist: 'Top Assist',
        top_rebound: 'Top Rebound',
        top_dunk: 'Top Dunk',
        top_threes: 'Top Triple',
      },
    },
    highlights: {
      title: 'Highlights',
      description: 'Scegli i 5 giocatori che finiranno nella Top 10 della notte.',
    },
    submit: 'Salva picks',
    update: 'Aggiorna picks',
    changesHintAvailable: 'Hai ancora 1 modifica disponibile oggi.',
    changesHintExhausted: 'Hai esaurito la modifica disponibile per oggi.',
  },
  collection: {
    empty: 'Non hai ancora alcuna card. Completa le sfide per guadagnare punti e acquistare la tua prima carta.',
    title: 'La tua Collezione',
  },
  shop: {
    title: 'Shop Cards',
    buy: 'Acquista ora',
    insufficientPoints: 'Punti insufficienti',
    confirmTitle: 'Confermi l’acquisto?',
    confirmBody: 'Conferma per spendere i tuoi Anima Points e aggiungere la card alla collezione.',
  },
  admin: {
    title: 'Console amministratore',
    usersTab: 'Utenti',
    picksTab: 'Picks',
    highlightsTab: 'Highlights',
    searchPlaceholder: 'Cerca utente…',
    balance: 'Saldo',
    cards: 'Cards',
    picksFor: 'Picks per',
    dateLabel: 'Data',
    applyHighlights: 'Applica Top 10 del giorno',
    rank: 'Posizione',
  },
  auth: {
    login: {
      title: 'Bentornato su NBAnima',
      subtitle: 'Accedi con la tua email per continuare a vivere le notti NBA.',
      submit: 'Accedi',
      switchPrompt: 'Non hai ancora un account?',
      switchCta: 'Registrati subito',
    },
    signup: {
      title: 'Crea il tuo account NBAnima',
      subtitle: 'Registrati in pochi secondi e conquista la leaderboard.',
      submit: 'Registrati',
      switchPrompt: 'Hai già un account?',
      switchCta: 'Accedi',
    },
    fields: {
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Conferma Password',
    },
    errors: {
      mismatch: 'Le password non coincidono.',
      generic: 'Si è verificato un errore. Riprova.',
    },
  },
};

const en: Dictionary = {
  common: {
    play: 'Play',
    collection: 'Collection',
    shop: 'Shop Cards',
    admin: 'Admin',
    highlights: 'Highlights',
    loading: 'Loading…',
    save: 'Save',
    edit: 'Edit',
    cancel: 'Cancel',
    confirm: 'Confirm',
    language: 'Language',
    logout: 'Log out',
  },
  home: {
    heroTitle: 'NBAnima — La web app che rende ancora più ANIMAta l’NBA!',
    heroTitleEn: 'NBAnima — The web app that makes the NBA even more ANIMA-ted!',
    heroSubtitle:
      'Challenge friends, earn Anima Points, and collect epic cards inspired by NBA legends.',
    heroSubtitleEn:
      'Challenge friends, earn Anima Points, and collect epic cards inspired by NBA legends.',
    bullets: [
      'Predict every NBA night: winners, stat leaders, and the Top 10 highlights.',
      'Lock picks before tip-off and chase multiplier bonuses for streaks.',
      'Earn Anima Points to unlock fresh drops in the premium card shop.',
    ],
    onboarding: [
      {
        title: 'Indovina i risultati delle partite NBA',
        titleEn: 'Predict every NBA matchup',
        description:
          'Studia il calendario, scegli la vincente e segui la tua corsa alla gloria con NBAnima.',
        descriptionEn:
          'Study the slate, pick the winners, and chase glory every single night.',
        image: '/loghi-squadre/LALAkers.png',
        imageAlt: 'Los Angeles Lakers logo',
      },
      {
        title: 'Scegli i tuoi giocatori Top',
        titleEn: 'Draft your Top performers',
        description:
          'Punta sulle stelle che domineranno punti, assist e rimbalzi per moltiplicare i punti.',
        descriptionEn:
          'Lock in the stars who will lead the box score in points, assists, and rebounds.',
        image: '/loghi-squadre/GSWarriors.png',
        imageAlt: 'Golden State Warriors logo',
      },
      {
        title: 'Guadagna Anima Points e colleziona Card leggendarie!',
        titleEn: 'Earn Anima Points and collect legendary cards!',
        description:
          'Riscatta le tue ricompense con carte digitali esclusive e potenzia il tuo roster.',
        descriptionEn:
          'Redeem exclusive digital cards to power up your roster and show off your collection.',
        image: '/cards/KobeWinninFistCard.png',
        imageAlt: 'Kobe Bryant Anima card',
      },
      {
        title: 'Scala la classifica e dimostra la tua anima NBA!',
        titleEn: 'Climb the leaderboard and prove your NBA spirit!',
        description:
          'Condividi le tue vittorie, supera gli amici e diventa l’icona delle notti NBA.',
        descriptionEn:
          'Share wins with friends, climb to the top, and become the legend of NBA nights.',
        image: '/1AnimaPoint.png',
        imageAlt: 'Anima Point token',
      },
    ],
    ctaRegister: 'Sign up',
    ctaLogin: 'Log in',
  },
  dashboard: {
    welcome: 'Welcome back to NBAnima!',
    animaPoints: 'Anima Points balance',
    playTab: 'Play',
    collectionTab: 'Collection',
    shopTab: 'Shop Cards',
    statusCompleted: 'Completed',
    statusPending: 'To-do',
    lockWindowActive: 'Game window locked. Picks cannot be edited now.',
    lastUpdated: 'Last updated',
  },
  play: {
    title: 'Gear up for the next NBA night',
    subtitle:
      'Complete the three challenges to secure the green check and maximize your Anima Points.',
    teams: {
      title: 'Teams',
      description: 'Pick the winner for every game in the upcoming slate.',
    },
    players: {
      title: 'Players',
      description:
        'Select the standout performers for points, assists, rebounds, dunks, and threes.',
      categories: {
        top_scorer: 'Top Scorer',
        top_assist: 'Top Assists',
        top_rebound: 'Top Rebounds',
        top_dunk: 'Top Dunks',
        top_threes: 'Top Threes',
      },
    },
    highlights: {
      title: 'Highlights',
      description: 'Lock in the 5 players you expect to shine in the nightly Top 10.',
    },
    submit: 'Save picks',
    update: 'Update picks',
    changesHintAvailable: 'You can still tweak your picks once today.',
    changesHintExhausted: 'Change limit reached for today.',
  },
  collection: {
    empty: 'Your collection is empty. Play challenges to earn points and redeem your first card.',
    title: 'Your Collection',
  },
  shop: {
    title: 'Card Shop',
    buy: 'Purchase',
    insufficientPoints: 'Not enough points',
    confirmTitle: 'Confirm purchase?',
    confirmBody:
      'Confirm to spend your Anima Points and immediately add the card to your collection.',
  },
  admin: {
    title: 'Admin console',
    usersTab: 'Users',
    picksTab: 'Picks',
    highlightsTab: 'Highlights',
    searchPlaceholder: 'Search user…',
    balance: 'Balance',
    cards: 'Cards',
    picksFor: 'Picks for',
    dateLabel: 'Date',
    applyHighlights: 'Save daily Top 10',
    rank: 'Rank',
  },
  auth: {
    login: {
      title: 'Welcome back to NBAnima',
      subtitle: 'Sign in with your email and keep the NBA nights alive.',
      submit: 'Log in',
      switchPrompt: 'No account yet?',
      switchCta: 'Create one now',
    },
    signup: {
      title: 'Create your NBAnima account',
      subtitle: 'Register in seconds and start climbing the leaderboard.',
      submit: 'Sign up',
      switchPrompt: 'Already part of the community?',
      switchCta: 'Log in',
    },
    fields: {
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
    },
    errors: {
      mismatch: 'Passwords do not match.',
      generic: 'Something went wrong. Please try again.',
    },
  },
};

export const dictionaries: Record<Locale, Dictionary> = {
  it,
  en,
};

export const getDictionary = async (locale: Locale): Promise<Dictionary> =>
  dictionaries[locale] ?? dictionaries.it;
