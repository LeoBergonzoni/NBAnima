"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TileFlipGameNBAnima = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const image_1 = __importDefault(require("next/image"));
const react_1 = require("react");
const locale_provider_1 = require("../components/providers/locale-provider");
const MAX_MOVES_FOR_REWARD = 15;
const PLAYER_SETS = {
    west: [
        {
            id: 'alperen-sengun',
            name: 'Alperen Sengun',
            team: 'Houston Rockets',
            image: '/nbanima-tiles/WestCoast/AlperenSengunAnime.png',
            coast: 'west',
        },
        {
            id: 'chet-holmgren',
            name: 'Chet Holmgren',
            team: 'Oklahoma City Thunder',
            image: '/nbanima-tiles/WestCoast/ChetHolmgrenAnime.png',
            coast: 'west',
        },
        {
            id: 'cooper-flagg',
            name: 'Cooper Flagg',
            team: 'Dallas Mavericks',
            image: '/nbanima-tiles/WestCoast/CooperFlaggAnime.png',
            coast: 'west',
        },
        {
            id: 'demar-derozan',
            name: 'Demar Derozan',
            team: 'Sacramento Kings',
            image: '/nbanima-tiles/WestCoast/DemarDerozanAnime.png',
            coast: 'west',
        },
        {
            id: 'kevin-durant',
            name: 'Kevin Durant',
            team: 'Houston Rockets',
            image: '/nbanima-tiles/WestCoast/KevinDurantAnime.png',
            coast: 'west',
        },
        {
            id: 'lebron-james',
            name: 'LeBron James',
            team: 'Los Angeles Lakers',
            image: '/nbanima-tiles/WestCoast/LebronJamesAnime.png',
            coast: 'west',
        },
        {
            id: 'nikola-jokic',
            name: 'Nikola Jokic',
            team: 'Denver Nuggets',
            image: '/nbanima-tiles/WestCoast/NikolaJokicAnime.png',
            coast: 'west',
        },
        {
            id: 'stephen-curry',
            name: 'Stephen Curry',
            team: 'Golden State Warriors',
            image: '/nbanima-tiles/WestCoast/StephenCurryAnime.png',
            coast: 'west',
        },
    ],
    east: [
        {
            id: 'cade-cunningham',
            name: 'Cade Cunningham',
            team: 'Detroit Pistons',
            image: '/nbanima-tiles/EastCoast/CadeCunninghamAnime.png',
            coast: 'east',
        },
        {
            id: 'donovan-mitchell',
            name: 'Donovan Mitchell',
            team: 'Cleveland Cavaliers',
            image: '/nbanima-tiles/EastCoast/DonovanMitchellAnime.png',
            coast: 'east',
        },
        {
            id: 'giannis-antetokounmpo',
            name: 'Giannis Antetokounmpo',
            team: 'Milwaukee Bucks',
            image: '/nbanima-tiles/EastCoast/GiannisAntetokounmpoAnime.png',
            coast: 'east',
        },
        {
            id: 'jaylen-brown',
            name: 'Jaylen Brown',
            team: 'Boston Celtics',
            image: '/nbanima-tiles/EastCoast/JaylenBrownAnime.png',
            coast: 'east',
        },
        {
            id: 'karl-anthony-towns',
            name: 'Karl Anthony Towns',
            team: 'New York Knicks',
            image: '/nbanima-tiles/EastCoast/KarlAnthonyTownsAnime.png',
            coast: 'east',
        },
        {
            id: 'lamelo-ball',
            name: 'Lamelo Ball',
            team: 'Charlotte Hornets',
            image: '/nbanima-tiles/EastCoast/LameloBallAnime.png',
            coast: 'east',
        },
        {
            id: 'trae-young',
            name: 'Trae Young',
            team: 'Atlanta Hawks',
            image: '/nbanima-tiles/EastCoast/TraeYoungAnime.png',
            coast: 'east',
        },
        {
            id: 'tyrese-maxey',
            name: 'Tyrese Maxey',
            team: 'Philadelphia 76ers',
            image: '/nbanima-tiles/EastCoast/TyreseMaxeyAnime.png',
            coast: 'east',
        },
    ],
};
const BACK_IMAGES = {
    west: '/nbanima-tiles/WestCoast/back.png',
    east: '/nbanima-tiles/EastCoast/back.png',
};
const PLAYER_LOOKUP = Object.values(PLAYER_SETS)
    .flat()
    .reduce((acc, player) => {
    acc[player.id] = player;
    return acc;
}, {});
const createShuffledDeck = (players) => {
    const baseDeck = players.flatMap((player) => [
        {
            id: `${player.id}-a`,
            playerId: player.id,
            image: player.image,
            matched: false,
            flipped: false,
        },
        {
            id: `${player.id}-b`,
            playerId: player.id,
            image: player.image,
            matched: false,
            flipped: false,
        },
    ]);
    for (let i = baseDeck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [baseDeck[i], baseDeck[j]] = [baseDeck[j], baseDeck[i]];
    }
    return baseDeck;
};
const TileFlipGameNBAnima = () => {
    const { locale, dictionary } = (0, locale_provider_1.useLocale)();
    const t = dictionary.tileGame;
    const [selectedCoast, setSelectedCoast] = (0, react_1.useState)('west');
    const [cards, setCards] = (0, react_1.useState)(() => createShuffledDeck(PLAYER_SETS.west));
    const [flippedIndices, setFlippedIndices] = (0, react_1.useState)([]);
    const [isLocked, setIsLocked] = (0, react_1.useState)(false);
    const [moves, setMoves] = (0, react_1.useState)(0);
    const [matches, setMatches] = (0, react_1.useState)(0);
    const [matchedPlayerIds, setMatchedPlayerIds] = (0, react_1.useState)([]);
    const [rewardState, setRewardState] = (0, react_1.useState)('idle');
    const [rewardMessage, setRewardMessage] = (0, react_1.useState)(null);
    const [rewardSubmitted, setRewardSubmitted] = (0, react_1.useState)(false);
    const cardsRef = (0, react_1.useRef)(cards);
    (0, react_1.useEffect)(() => {
        cardsRef.current = cards;
    }, [cards]);
    const resetGame = (0, react_1.useCallback)((coast) => {
        const nextCoast = coast ?? selectedCoast;
        const deck = createShuffledDeck(PLAYER_SETS[nextCoast]);
        cardsRef.current = deck;
        setCards(deck);
        setFlippedIndices([]);
        setIsLocked(false);
        setMoves(0);
        setMatches(0);
        setMatchedPlayerIds([]);
        setRewardState('idle');
        setRewardMessage(null);
        setRewardSubmitted(false);
    }, [selectedCoast]);
    const handleCardClick = (0, react_1.useCallback)((index) => {
        if (isLocked) {
            return;
        }
        const current = cardsRef.current[index];
        if (!current || current.matched || current.flipped) {
            return;
        }
        setCards((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], flipped: true };
            return updated;
        });
        setFlippedIndices((prev) => {
            if (prev.length >= 2) {
                return prev;
            }
            return [...prev, index];
        });
    }, [isLocked]);
    (0, react_1.useEffect)(() => {
        if (flippedIndices.length !== 2) {
            return undefined;
        }
        setIsLocked(true);
        setMoves((prev) => prev + 1);
        const [firstIdx, secondIdx] = flippedIndices;
        const firstCard = cardsRef.current[firstIdx];
        const secondCard = cardsRef.current[secondIdx];
        if (!firstCard || !secondCard) {
            setFlippedIndices([]);
            setIsLocked(false);
            return undefined;
        }
        if (firstCard.image === secondCard.image) {
            const timeout = window.setTimeout(() => {
                setCards((current) => {
                    const updated = [...current];
                    updated[firstIdx] = { ...updated[firstIdx], matched: true };
                    updated[secondIdx] = { ...updated[secondIdx], matched: true };
                    return updated;
                });
                setFlippedIndices([]);
                setIsLocked(false);
                setMatches((prev) => prev + 1);
                setMatchedPlayerIds((prev) => prev.includes(firstCard.playerId) ? prev : [...prev, firstCard.playerId]);
            }, 350);
            return () => window.clearTimeout(timeout);
        }
        const timeout = window.setTimeout(() => {
            setCards((current) => {
                const updated = [...current];
                updated[firstIdx] = { ...updated[firstIdx], flipped: false };
                updated[secondIdx] = { ...updated[secondIdx], flipped: false };
                return updated;
            });
            setFlippedIndices([]);
            setIsLocked(false);
        }, 600);
        return () => window.clearTimeout(timeout);
    }, [flippedIndices]);
    const requestReward = (0, react_1.useCallback)(async () => {
        setRewardState('pending');
        setRewardMessage(t.rewardStatus.pending);
        try {
            const response = await fetch('/api/tile-flip/reward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moves, locale }),
            });
            if (!response.ok) {
                throw new Error('Failed to assign reward');
            }
            setRewardState('success');
            setRewardMessage(t.rewardStatus.success);
        }
        catch (error) {
            console.error('[TileFlipGame] reward request failed', error);
            setRewardState('error');
            setRewardMessage(t.rewardStatus.failure);
        }
    }, [locale, moves, t.rewardStatus.failure, t.rewardStatus.pending, t.rewardStatus.success]);
    const currentPlayers = PLAYER_SETS[selectedCoast];
    const totalPairs = currentPlayers.length;
    const backImage = BACK_IMAGES[selectedCoast];
    const matchedPlayers = (0, react_1.useMemo)(() => matchedPlayerIds.map((id) => PLAYER_LOOKUP[id]).filter(Boolean), [matchedPlayerIds]);
    const allMatched = matches === totalPairs;
    (0, react_1.useEffect)(() => {
        if (!allMatched) {
            return;
        }
        if (moves <= MAX_MOVES_FOR_REWARD) {
            if (!rewardSubmitted) {
                setRewardSubmitted(true);
                void requestReward();
            }
        }
        else {
            setRewardState('ineligible');
            setRewardMessage(t.rewardStatus.retry);
        }
    }, [allMatched, moves, requestReward, rewardSubmitted, t.rewardStatus.retry]);
    const statusText = rewardMessage ?? t.rewardStatus.eligible;
    const statusTone = rewardState === 'success'
        ? 'text-emerald-400'
        : rewardState === 'pending'
            ? 'text-amber-200'
            : rewardState === 'error' || rewardState === 'ineligible'
                ? 'text-rose-300'
                : 'text-slate-400';
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-gradient-to-b from-navy-950/90 to-navy-900/70 p-6 shadow-card", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center justify-center rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-gold", children: t.rewardPointsLabel }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold text-white", children: t.pageTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: t.pageSubtitle })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: t.coastToggleLabel }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 flex flex-wrap gap-3", children: ['west', 'east'].map((coast) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                if (coast !== selectedCoast) {
                                    setSelectedCoast(coast);
                                    resetGame(coast);
                                }
                            }, className: (0, clsx_1.default)('min-w-[160px] rounded-2xl border px-4 py-2 text-sm font-semibold transition', selectedCoast === coast
                                ? 'border-accent-gold bg-accent-gold/10 text-white shadow-card'
                                : 'border-white/15 bg-navy-900/60 text-slate-200 hover:border-accent-gold/40'), children: t.coastOptions[coast] }, coast))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-4 rounded-2xl border border-white/10 bg-navy-900/60 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-200", children: t.rewardHint }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => resetGame(), className: "inline-flex items-center gap-1 rounded-full border border-white/15 bg-navy-950/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-accent-gold/40 hover:text-white", children: t.resetCta })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-4 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("span", { children: [t.stats.moves, ":", ' ', (0, jsx_runtime_1.jsx)("strong", { className: "text-white", children: moves })] }), (0, jsx_runtime_1.jsxs)("span", { children: [t.stats.matches, ":", ' ', (0, jsx_runtime_1.jsxs)("strong", { className: "text-white", children: [matches, "/", totalPairs] })] }), allMatched ? ((0, jsx_runtime_1.jsx)("span", { className: "text-emerald-400", children: t.stats.completed })) : null] }), (0, jsx_runtime_1.jsx)("p", { className: `text-sm font-semibold ${statusTone}`, children: statusText })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 grid grid-cols-4 gap-2 sm:gap-3 mx-auto max-w-[520px]", children: cards.map((card, index) => {
                    const showFront = card.flipped || card.matched;
                    const borderColor = card.matched ? 'border-emerald-400/70' : 'border-white/15';
                    const playerMeta = PLAYER_LOOKUP[card.playerId];
                    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleCardClick(index), disabled: card.matched || isLocked, className: `relative aspect-square w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70 ${card.matched ? 'cursor-default' : 'cursor-pointer'} ${isLocked && !card.flipped ? 'cursor-wait' : ''}`, children: (0, jsx_runtime_1.jsxs)("div", { className: "absolute inset-0 rounded-2xl shadow-card transition-transform duration-300", style: {
                                transformStyle: 'preserve-3d',
                                transform: showFront ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                boxShadow: card.matched
                                    ? '0 0 0 2px rgba(34,197,94,0.5), 0 15px 30px rgba(0,0,0,0.55)'
                                    : '0 12px 25px rgba(5,11,26,0.85)',
                            }, children: [(0, jsx_runtime_1.jsx)("div", { className: `absolute inset-0 rounded-2xl border ${borderColor}`, style: {
                                        backfaceVisibility: 'hidden',
                                        overflow: 'hidden',
                                        background: 'radial-gradient(circle at top, #0284c7 0%, #1d4ed8 40%, #020617 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }, children: (0, jsx_runtime_1.jsx)("div", { className: "relative h-[80%] w-[80%]", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: backImage, alt: "NBAnima card back", fill: true, sizes: "(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px", className: "rounded-2xl object-cover", priority: false }) }) }), (0, jsx_runtime_1.jsx)("div", { className: `absolute inset-0 rounded-2xl border ${borderColor}`, style: {
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        overflow: 'hidden',
                                        backgroundColor: '#020617',
                                    }, children: (0, jsx_runtime_1.jsx)("div", { className: "relative h-full w-full", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: card.image, alt: playerMeta ? playerMeta.name : 'NBAnima card face', fill: true, sizes: "(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px", className: "object-cover", priority: false }) }) })] }) }, card.id));
                }) }), (0, jsx_runtime_1.jsx)("p", { className: "mt-6 text-center text-xs text-slate-400", children: t.instructions }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 rounded-2xl border border-white/10 bg-navy-900/50 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-white", children: t.galleryTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: t.gallerySubtitle })] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs font-semibold text-accent-gold", children: [matchedPlayers.length, "/", totalPairs] })] }), matchedPlayers.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "mt-4 text-sm text-slate-400", children: t.galleryEmpty })) : ((0, jsx_runtime_1.jsx)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: matchedPlayers.map((player) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: player.image, alt: player.name, fill: true, sizes: "64px", className: "object-cover" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-white", children: player.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: player.team })] })] }, player.id))) }))] })] }));
};
exports.TileFlipGameNBAnima = TileFlipGameNBAnima;
exports.default = exports.TileFlipGameNBAnima;
