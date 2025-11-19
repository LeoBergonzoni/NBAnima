import type { Locale } from '@/lib/constants';

type HowToPlayContent = {
  title: string;
  subtitle: string;
  play: {
    label: string;
    description: string;
    imageAlt: string;
    imageSrc: string;
    teams: {
      title: string;
      description: string;
      reward: string;
      imageAlt: string;
      imageSrc: string;
    };
    players: {
      title: string;
      description: string;
      bullets: string[];
      reward: string;
      imageAlt: string;
      imageSrc: string;
    };
    highlights: {
      title: string;
      description: string;
      note: string;
      scoreTitle: string;
      scores: string[];
    };
    multipliers: {
      title: string;
      description: string;
    };
  };
  cards: {
    label: string;
    description: string;
    note: string;
    imageAlt: string;
    imageSrc: string;
  };
  cta: {
    title: string;
    subtitle: string;
    button: string;
  };
};

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
    heroSubtitle: string;
    bullets: string[];
    onboarding: Array<{
      title: string;
      description: string;
    }>;
    ctaRegister: string;
    ctaLogin: string;
    howToPlay: HowToPlayContent;
  };
  dashboard: {
    welcome: string;
    animaPoints: string;
    playTab: string;
    myPicksTab: string;
    winnersTab: string;
    collectionTab: string;
    shopTab: string;
    weeklyXpBalance: string;
    weeklyRanking: string;
    weeklyRangeCaption: string;
    weeklyXpExplainer: string;
    howCalculatedBoth: string;
    statusCompleted: string;
    statusPending: string;
    lockWindowActive: string;
    lastUpdated: string;
    winners: {
      title: string;
      dateLabel: string;
      pointsOfDay: string;
      myPick: string;
      empty: string;
      breakdown: {
        title: string;
        subtitle: string;
        teamsLabel: string;
        playersLabel: string;
        multiplierLabel: string;
        multiplierBase: string;
        multiplierUnlocked: string;
        pointsLabel: string;
        pointsUnit: string;
        basePointsLabel: string;
        totalPointsLabel: string;
        formulaLabel: string;
        totalWins: string;
        multiplierShort: string;
        noWins: string;
      };
    };
    toasts: {
      cardPurchased: string;
      picksSaved: string;
      picksUpdated: string;
    };
  };
  play: {
    title: string;
    subtitle: string;
    links: {
      nbaStats: string;
      nbaLineups: string;
    };
    teams: {
      title: string;
      description: string;
      reward: string;
    };
    players: {
      title: string;
      description: string;
      endPicks: string;
      reward: string;
      categories: {
        top_scorer: string;
        top_assist: string;
        top_rebound: string;
      };
    };
    highlights: {
      title: string;
      description: string;
      endPicks: string;
      selectionLabel: string;
    };
    submit: string;
    update: string;
    changesHint: string;
    lockCountdown: {
      label: string;
      pending: string;
      closed: string;
    };
  };
  tileGame: {
    sectionTitle: string;
    sectionDescription: string;
    sectionCta: string;
    pageTitle: string;
    pageSubtitle: string;
    rewardHint: string;
    rewardPointsLabel: string;
    coastToggleLabel: string;
    coastOptions: {
      west: string;
      east: string;
    };
    stats: {
      moves: string;
      matches: string;
      completed: string;
    };
    rewardStatus: {
      eligible: string;
      pending: string;
      success: string;
      failure: string;
      retry: string;
    };
    resetCta: string;
    instructions: string;
    galleryTitle: string;
    gallerySubtitle: string;
    galleryEmpty: string;
  };
  collection: {
    empty: string;
    title: string;
    download: string;
  };
  shop: {
    title: string;
    buy: string;
    insufficientPoints: string;
    confirmTitle: string;
    confirmMessage: string;
    owned: string;
    errorGeneric: string;
  };
  admin: {
    title: string;
    usersTab: string;
    picksTab: string;
    highlightsTab: string;
    backToDashboard: string;
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
      confirmationNotice: string;
    };
    fields: {
      fullName: string;
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
    heroSubtitle:
      'Sfida i tuoi amici, accumula Anima Points e colleziona carte epiche dedicate ai tuoi idoli NBA.',
    bullets: [
      'Prevedi i risultati di ogni notte NBA: squadre, giocatori e Top 10 Highlights.',
      'Blocca le tue scelte prima della palla a due e ottieni bonus moltiplicatori.',
      'Guadagna Anima Points e sblocca cards esclusive nel nostro shop dinamico.',
    ],
    onboarding: [
      {
        title: 'Indovina i risultati delle partite NBA',
        description:
          'Studia il calendario, scegli la vincente e vivi la corsa alla gloria con NBAnima.',
      },
      {
        title: 'Scegli i tuoi giocatori Top',
        description:
          'Punta sulle stelle che domineranno punti, assist e rimbalzi per moltiplicare i tuoi Anima Points.',
      },
      {
        title: 'Guadagna Anima Points e colleziona Card leggendarie',
        description:
          'Completa le sfide, accumula punti e riscatta carte digitali uniche dedicate ai tuoi idoli.',
      },
      {
        title: 'Scala la classifica e dimostra la tua anima NBA',
        description:
          'Condividi le vittorie con gli amici e diventa la leggenda indiscussa delle notti NBA.',
      },
    ],
    ctaRegister: 'Registrati',
    ctaLogin: 'Accedi',
    howToPlay: {
      title: 'Come si gioca',
      subtitle: 'Scopri le regole principali e inizia a giocare con NBAnima.',
      play: {
        label: 'Play',
        description:
          'Ogni giorno devi provare a indovinare squadre vincenti e giocatori migliori per accumulare Anima Points e acquistare esclusive Cards.',
        imageAlt: 'Esempio Anima Point',
        imageSrc: '/anima-point.png',
        teams: {
          title: 'Categoria “Teams”',
          description:
            'In base alla giornata devi indovinare chi vincerà gli scontri diretti che si giocheranno la notte successiva.',
          reward: 'Ogni squadra vincente indovinata vale 30 Anima Points.',
          imageAlt: 'Esempio loghi squadre',
          imageSrc: '/loghi-squadre/LAL.png',
        },
        players: {
          title: 'Categoria “Players”',
          description: 'In base ai vari match dovrai indovinare i giocatori più performanti:',
          bullets: [
            'Top Scorer (chi farà più punti nel match)',
            'Top Assist (chi farà più assist nel match)',
            'Top Rebound (chi prenderà più rimbalzi nel match)',
          ],
          reward: 'Ogni previsione corretta vale 50 Anima Points.',
          imageAlt: 'Esempio giocatore NBA',
          imageSrc: '/GiannisT.png',
        },
        highlights: {
          title: 'Categoria “Highlights”',
          description:
            'Indovina da 1 a 5 giocatori che entreranno nelle NBA Top 5 o Top 10 plays of the night.',
          note: 'Più alto è il piazzamento, più punti ottieni.',
          scoreTitle: 'Punteggio',
          scores: [
            '1° posto: 100 pt',
            '2° posto: 90 pt',
            '3° posto: 80 pt',
            '4° posto: 70 pt',
            '5° posto: 60 pt',
            '6° posto: 50 pt',
            '7° posto: 40 pt',
            '8° posto: 30 pt',
            '9° posto: 20 pt',
            '10° posto: 10 pt',
          ],
        },
        multipliers: {
          title: 'Moltiplicatori di Anima Points',
          description:
            'Se indovini 5 risultati il totale ottenuto si moltiplica x2; con 10 risultati il totale si moltiplica x3.',
        },
      },
      cards: {
        label: 'Cards',
        description: 'Con gli Anima Points puoi acquistare le Anima Cards!',
        note: 'Completa la tua collezione e mostra a tutti la tua Anima NBA.',
        imageAlt: 'Esempio Anima Card',
        imageSrc: '/cards/KobeWinninFistCard.png',
      },
      cta: {
        title: 'Inizia a giocare!',
        subtitle: 'Registrati, prepara le tue previsioni e scala la classifica NBAnima.',
        button: 'Registrati ora',
      },
    },
  },
  dashboard: {
    welcome: 'Bentornato su NBAnima!',
    animaPoints: 'Saldo Anima Points',
    playTab: 'Gioca',
    myPicksTab: 'Le mie scelte',
    winnersTab: 'Vincenti',
    collectionTab: 'Collezione',
    shopTab: 'Acquista Cards',
    weeklyXpBalance: 'Saldo Weekly XP',
    weeklyRanking: 'Classifica settimanale',
    weeklyRangeCaption: 'Settimana del {date} (Lun–Dom, ET)',
    weeklyXpExplainer:
      'I Weekly XP rispecchiano solo i punti da settlement, coprono la settimana Lun–Dom (ET) e si azzerano ogni lunedì.',
    howCalculatedBoth: 'Come sono stati calcolati i tuoi Anima Points e i Weekly XP',
    statusCompleted: 'Completato',
    statusPending: 'Da completare',
    lockWindowActive: 'Picks chiuse per oggi',
    lastUpdated: 'Ultimo aggiornamento',
    winners: {
      title: 'Vincenti',
      dateLabel: 'Giornata',
      pointsOfDay: 'Anima Points ottenuti in questa giornata',
      myPick: 'My Pick',
      empty: 'Nessun risultato disponibile per questa data.',
      breakdown: {
        title: 'Come sono stati calcolati i tuoi Anima Points e i Weekly XP',
        subtitle: 'Riepilogo delle scommesse vinte e del moltiplicatore attivo.',
        teamsLabel: 'Teams azzeccati',
        playersLabel: 'Players azzeccati',
        multiplierLabel: 'Moltiplicatore',
        multiplierBase: 'Moltiplicatore base attivo',
        multiplierUnlocked: 'Attivo con {threshold}+ successi',
        pointsLabel: 'Punti:',
        pointsUnit: 'Anima Points',
        basePointsLabel: 'Punti base:',
        totalPointsLabel: 'Totale',
        formulaLabel: 'Calcolo',
        totalWins: 'Successi totali',
        multiplierShort: 'Moltiplicatore',
        noWins: 'Nessuna scommessa vincente registrata per questa giornata.',
      },
    },
    toasts: {
      cardPurchased: 'Card acquistata!',
      picksSaved: 'Picks salvate con successo.',
      picksUpdated: 'Picks aggiornate con successo.',
    },
  },
  play: {
    title: 'Preparati alla prossima notte NBA',
    subtitle:
      'Completa le sfide per ottenere il check verde e massimizzare i tuoi Anima Points.',
    links: {
      nbaStats: 'NBA Stats',
      nbaLineups: 'NBA Starting lineups',
    },
    teams: {
      title: 'Teams',
      description: 'Scegli la squadra vincente per ogni partita della prossima notte. 30 Anima Points ogni scelta azzeccata.',
      reward: '30 Anima Points ogni scelta azzeccata.',
    },
    players: {
      title: 'Players',
      description:
        'Seleziona i protagonisti per punti, assist e rimbalzi. 50 Anima Points ogni scelta azzeccata.',
      endPicks: 'Termina scelte',
      reward: '50 Anima Points ogni scelta azzeccata.',
      categories: {
        top_scorer: 'Top Scorer',
        top_assist: 'Top Assist',
        top_rebound: 'Top Rebound',
      },
    },
    highlights: {
      title: 'Highlights',
      description: 'Scegli fino a 5 giocatori che finiranno nella Top 10 della notte.',
      endPicks: 'Termina scelte',
      selectionLabel: 'Giocatore',
    },
    submit: 'Salva picks',
    update: 'Aggiorna picks',
    changesHint:
      'Modifiche effettuate oggi: {count}. Puoi aggiornare le tue picks tutte le volte che vuoi fino all’inizio delle partite.',
    lockCountdown: {
      label: 'Tempo rimanente per modificare le picks:',
      pending: 'In attesa dell’orario ufficiale delle partite...',
      closed: 'Le picks si chiudono 5 minuti prima della prima partita.',
    },
  },
  tileGame: {
    sectionTitle: 'Tile Flip Game',
    sectionDescription:
      'Completa lo schema in 15 mosse o meno per ottenere 10 Anima Points extra.',
    sectionCta: 'Apri il gioco',
    pageTitle: 'Tile Flip Game',
    pageSubtitle: 'Allena la memoria con le tessere NBAnima.',
    rewardHint: 'Abbina tutte le 8 coppie in 15 mosse o meno per guadagnare +10 Anima Points.',
    rewardPointsLabel: '+10 Anima Points',
    coastToggleLabel: 'Scegli i giocatori',
    coastOptions: {
      west: 'West Coast Players',
      east: 'East Coast Players',
    },
    stats: {
      moves: 'Mosse',
      matches: 'Coppie trovate',
      completed: 'Completato!',
    },
    rewardStatus: {
      eligible: 'Ricompensa disponibile se completi entro 15 mosse.',
      pending: 'Assegnazione in corso…',
      success: '10 Anima Points accreditati!',
      failure: 'Impossibile assegnare i punti.',
      retry: 'Riprova completando lo schema in 15 mosse o meno.',
    },
    resetCta: 'Reset',
    instructions: 'Gira due tessere alla volta per trovare tutte le coppie NBAnima.',
    galleryTitle: 'Giocatori trovati',
    gallerySubtitle: 'Ogni coppia completata rivela nome e squadra.',
    galleryEmpty: 'Trova una coppia per scoprire i tuoi roster preferiti.',
  },
  collection: {
    empty: 'Non hai ancora alcuna card. Completa le sfide per guadagnare punti e acquistare la tua prima carta.',
    title: 'La tua Collezione',
    download: 'Scarica',
  },
  shop: {
    title: 'Shop Cards',
    buy: 'Acquista ora',
    insufficientPoints: 'Punti insufficienti',
    confirmTitle: 'Confermi l’acquisto?',
    confirmMessage: 'Sei sicuro di voler acquistare questa Card per {price} Anima Points?',
    owned: 'Acquistata',
    errorGeneric: 'Qualcosa è andato storto. Riprova.',
  },
  admin: {
    title: 'Console amministratore',
    usersTab: 'Utenti',
    picksTab: 'Picks',
    highlightsTab: 'Highlights',
    backToDashboard: 'Torna alla dashboard',
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
      confirmationNotice:
        'Controlla la tua email per il link di conferma, aprilo e poi accedi con i dati appena inseriti.',
    },
    fields: {
      fullName: 'Nome o soprannome',
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
    heroTitle: 'NBAnima — The web app that makes the NBA even more ANIMA-ted!',
    heroSubtitle:
      'Challenge friends, earn Anima Points, and collect epic cards inspired by NBA legends.',
    bullets: [
      'Predict every NBA night: winners, stat leaders, and the Top 10 highlights.',
      'Lock picks before tip-off and chase multiplier bonuses for streaks.',
      'Earn Anima Points to unlock fresh drops in the premium card shop.',
    ],
    onboarding: [
      {
        title: 'Predict every NBA matchup',
        description:
          'Study the slate, pick the winners, and chase nightly glory with NBAnima.',
      },
      {
        title: 'Draft your Top performers',
        description:
          'Lock in the stars who will lead the box score in points, assists, and rebounds.',
      },
      {
        title: 'Earn Anima Points and collect legendary cards',
        description:
          'Redeem exclusive digital cards to power up your roster and show off your fandom.',
      },
      {
        title: 'Climb the leaderboard and prove your NBA spirit',
        description:
          'Share your victories, challenge friends, and become the legend of NBA nights.',
      },
    ],
    ctaRegister: 'Sign up',
    ctaLogin: 'Log in',
    howToPlay: {
      title: 'How to play',
      subtitle: 'Learn the core rules and start competing with NBAnima.',
      play: {
        label: 'Play',
        description:
          'Every day, predict the winning teams and standout players to earn Anima Points and unlock exclusive Cards.',
        imageAlt: 'Example of Anima Point',
        imageSrc: '/anima-point.png',
        teams: {
          title: '“Teams” category',
          description:
            'Look at the nightly schedule and pick which team will win each head-to-head matchup.',
          reward: 'Each correctly predicted winner is worth 30 Anima Points.',
          imageAlt: 'Example of team logos',
          imageSrc: '/loghi-squadre/LAL.png',
        },
        players: {
          title: '“Players” category',
          description: 'For every matchup, choose the top performers:',
          bullets: [
            'Top Scorer (most points in the matchup)',
            'Top Assist (most assists in the matchup)',
            'Top Rebound (most rebounds in the matchup)',
          ],
          reward: 'Each correct pick is worth 50 Anima Points.',
          imageAlt: 'Example NBA player',
          imageSrc: '/GiannisT.png',
        },
        highlights: {
          title: '“Highlights” category',
          description:
            'Select 1 to 5 players you expect to feature in the NBA Top 5 or Top 10 plays of the night.',
          note: 'The higher the placement, the more points you earn.',
          scoreTitle: 'Score',
          scores: [
            '1st place: 100 pts',
            '2nd place: 90 pts',
            '3rd place: 80 pts',
            '4th place: 70 pts',
            '5th place: 60 pts',
            '6th place: 50 pts',
            '7th place: 40 pts',
            '8th place: 30 pts',
            '9th place: 20 pts',
            '10th place: 10 pts',
          ],
        },
        multipliers: {
          title: 'Anima Points multipliers',
          description:
            'Hit 5 correct results to double (x2) your total, or 10 correct results to triple (x3) it.',
        },
      },
      cards: {
        label: 'Cards',
        description: 'Spend your Anima Points to purchase Anima Cards!',
        note: 'Complete your collection and showcase your NBA soul.',
        imageAlt: 'Example Anima Card',
        imageSrc: '/cards/KobeWinninFistCard.png',
      },
      cta: {
        title: 'Start playing!',
        subtitle: 'Sign up, lock in your picks, and climb the NBAnima leaderboard.',
        button: 'Sign up now',
      },
    },
  },
  dashboard: {
    welcome: 'Welcome back to NBAnima!',
    animaPoints: 'Anima Points balance',
    playTab: 'Play',
    myPicksTab: 'My Picks',
    winnersTab: 'Winners',
    collectionTab: 'Collection',
    shopTab: 'Shop Cards',
    weeklyXpBalance: 'Weekly XP balance',
    weeklyRanking: 'Weekly Ranking',
    weeklyRangeCaption: 'Week of {date} (Mon–Sun, ET)',
    weeklyXpExplainer:
      'Weekly XP mirror settlement-only points, cover the Mon–Sun (ET) week, and reset every Monday.',
    howCalculatedBoth: 'How your Anima Points and Weekly XP were calculated',
    statusCompleted: 'Completed',
    statusPending: 'To-do',
    lockWindowActive: 'Pick closed for today',
    lastUpdated: 'Last updated',
    winners: {
      title: 'Winners',
      dateLabel: 'Date',
      pointsOfDay: 'Anima Points earned this date',
      myPick: 'My Pick',
      empty: 'No results available for this date.',
      breakdown: {
        title: 'How your Anima Points and Weekly XP were calculated',
        subtitle: 'Breakdown of winning picks and the active multiplier.',
        teamsLabel: 'Team hits',
        playersLabel: 'Player hits',
        multiplierLabel: 'Multiplier',
        multiplierBase: 'Base multiplier active',
        multiplierUnlocked: 'Unlocked at {threshold}+ hits',
        pointsLabel: 'Points:',
        pointsUnit: 'Anima Points',
        basePointsLabel: 'Base points:',
        totalPointsLabel: 'Total',
        formulaLabel: 'Formula',
        totalWins: 'Total hits',
        multiplierShort: 'Multiplier',
        noWins: 'No winning picks recorded for this date yet.',
      },
    },
    toasts: {
      cardPurchased: 'Card purchased!',
      picksSaved: 'Picks saved successfully.',
      picksUpdated: 'Picks updated successfully.',
    },
  },
  play: {
    title: 'Gear up for the next NBA night',
    subtitle:
      'Complete the challenges to secure the green check and maximize your Anima Points.',
    links: {
      nbaStats: 'NBA Stats',
      nbaLineups: 'NBA Starting lineups',
    },
    teams: {
      title: 'Teams',
      description: 'Pick the winner for every game in the upcoming slate. 30 Anima Points for each correct choice.',
      reward: '30 Anima Points for each correct choice.',
    },
    players: {
      title: 'Players',
      description:
        'Select the standout performers for points, assists, and rebounds. 50 Anima Points for each correct choice.',
      endPicks: 'End picks',
      reward: '50 Anima Points for each correct choice.',
      categories: {
        top_scorer: 'Top Scorer',
        top_assist: 'Top Assists',
        top_rebound: 'Top Rebounds',
      },
    },
    highlights: {
      title: 'Highlights',
      description: 'Lock in up to 5 players you expect to shine in the nightly Top 10.',
      endPicks: 'End picks',
      selectionLabel: 'Player',
    },
    submit: 'Save picks',
    update: 'Update picks',
    changesHint:
      'Changes made today: {count}. You can keep updating your picks freely until tip-off.',
    lockCountdown: {
      label: 'Time left to edit your picks:',
      pending: 'Waiting for today’s schedule...',
      closed: 'Picks lock 5 minutes before the first game.',
    },
  },
  tileGame: {
    sectionTitle: 'Tile Flip Game',
    sectionDescription:
      'Beat the board in 15 moves or less to collect 10 bonus Anima Points.',
    sectionCta: 'Open the game',
    pageTitle: 'Tile Flip Game',
    pageSubtitle: 'Test your memory with NBAnima tiles.',
    rewardHint: 'Match all 8 pairs in 15 moves or fewer to earn +10 Anima Points.',
    rewardPointsLabel: '+10 Anima Points',
    coastToggleLabel: 'Choose your lineup',
    coastOptions: {
      west: 'West Coast Players',
      east: 'East Coast Players',
    },
    stats: {
      moves: 'Moves',
      matches: 'Pairs found',
      completed: 'Completed!',
    },
    rewardStatus: {
      eligible: 'Reward available when you finish within 15 moves.',
      pending: 'Rewarding…',
      success: '10 Anima Points credited!',
      failure: 'Unable to award the points.',
      retry: 'Beat the board in 15 moves or fewer to try again.',
    },
    resetCta: 'Reset',
    instructions: 'Flip two tiles at a time and find every NBAnima pair.',
    galleryTitle: 'Matched players',
    gallerySubtitle: 'Each completed pair reveals the player name and team.',
    galleryEmpty: 'Match any pair to start filling your scouting report.',
  },
  collection: {
    empty: 'Your collection is empty. Play challenges to earn points and redeem your first card.',
    title: 'Your Collection',
    download: 'Download',
  },
  shop: {
    title: 'Shop Cards',
    buy: 'Buy now',
    insufficientPoints: 'Not enough points',
    confirmTitle: 'Confirm purchase?',
    confirmMessage:
      'Are you sure you want to purchase this Card for {price} Anima Points?',
    owned: 'Purchased',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  admin: {
    title: 'Admin console',
    usersTab: 'Users',
    picksTab: 'Picks',
    highlightsTab: 'Winners Highlights',
    backToDashboard: 'Back to dashboard',
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
      confirmationNotice:
        'Check your inbox for the confirmation link, click it, then sign in with the credentials you just created.',
    },
    fields: {
      fullName: 'Name or nickname',
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
