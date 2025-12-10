"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedPlayerSelection = void 0;
exports.PlayerSelect = PlayerSelect;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const PlayerSelect_1 = require("../../components/ui/PlayerSelect");
const supabase_browser_1 = require("../../lib/supabase-browser");
let cachedOptions = null;
let cachedLookup = null;
let loadPromise = null;
const buildSupabaseOptions = (rows) => {
    const options = [];
    const lookup = new Map();
    rows.forEach((row) => {
        const firstName = row.first_name?.trim() ?? '';
        const lastName = row.last_name?.trim() ?? '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || row.provider_player_id || row.id;
        const teamAbbr = row.team?.abbr?.toUpperCase() ?? null;
        const label = teamAbbr ? `${fullName} — ${teamAbbr}` : fullName;
        const option = {
            value: row.id,
            label,
            meta: {
                altNames: [
                    fullName,
                    firstName,
                    lastName,
                    row.provider_player_id ?? '',
                    teamAbbr ?? '',
                ].filter(Boolean),
                source: 'supabase',
                providerPlayerId: row.provider_player_id ?? undefined,
                teamAbbr,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                position: row.position ?? null,
                supabaseId: row.id,
            },
        };
        options.push(option);
        lookup.set(option.value, option);
        if (row.provider_player_id && !lookup.has(row.provider_player_id)) {
            lookup.set(row.provider_player_id, option);
        }
    });
    return [options, lookup];
};
const loadPlayerOptions = async () => {
    if (cachedOptions) {
        return cachedOptions;
    }
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const supabase = (0, supabase_browser_1.createBrowserSupabase)();
                const { data, error } = await supabase
                    .from('player')
                    .select('id, provider, provider_player_id, team_id, first_name, last_name, position, active, team:team_id (abbr)')
                    .eq('active', true)
                    .limit(10000);
                if (error) {
                    console.error('[AdminPlayerSelect] Failed to load Supabase players', error);
                }
                const supabaseRows = (data ?? []);
                const [rawOptions, rawLookup] = buildSupabaseOptions(supabaseRows);
                // Deduplica per provider_player_id normalizzato, preferendo local-rosters su altri provider
                const normalizePid = (pid) => (pid ?? '')
                    .toLowerCase()
                    .replace(/\./g, '-')
                    .replace(/[-.]?(g|f|c)$/i, '')
                    .trim();
                const byPid = new Map();
                rawOptions.forEach((opt) => {
                    const pidRaw = opt.meta?.providerPlayerId ?? '';
                    const norm = normalizePid(pidRaw) || pidRaw || opt.value;
                    const existing = byPid.get(norm);
                    const isLocal = pidRaw?.includes('-') || opt.meta?.source === 'supabase'
                        ? (supabaseRows.find((row) => row.id === opt.value)?.provider ?? '') === 'local-rosters'
                        : false;
                    const existingProvider = existing
                        ? supabaseRows.find((row) => row.id === existing.value)?.provider
                        : null;
                    const prefer = !existing ||
                        (existingProvider !== 'local-rosters' && isLocal) ||
                        (!existingProvider && !existing);
                    if (prefer) {
                        byPid.set(norm, opt);
                    }
                });
                const combined = Array.from(byPid.values()).sort((a, b) => a.label.localeCompare(b.label));
                cachedLookup = rawLookup;
                cachedOptions = combined;
                return combined;
            }
            catch (error) {
                loadPromise = null;
                throw error;
            }
        })();
    }
    try {
        cachedOptions = await loadPromise;
    }
    catch (error) {
        console.error('[AdminPlayerSelect] Failed to load player options', error);
        cachedOptions = [];
    }
    finally {
        loadPromise = null;
    }
    if (!cachedLookup) {
        cachedLookup = new Map(cachedOptions.map((option) => [option.value, option]));
    }
    return cachedOptions;
};
const resolveOption = (value, options) => {
    if (!value) {
        return undefined;
    }
    const lookup = cachedLookup;
    if (lookup && lookup.has(value)) {
        return lookup.get(value);
    }
    return options.find((option) => option.value === value);
};
const getCachedPlayerSelection = (id) => {
    if (!id || !cachedLookup?.has(id)) {
        return null;
    }
    const option = cachedLookup.get(id);
    if (!option) {
        return null;
    }
    return {
        id: option.value,
        label: option.label,
        source: option.meta.source,
        providerPlayerId: option.meta.providerPlayerId,
        teamAbbr: option.meta.teamAbbr,
        firstName: option.meta.firstName,
        lastName: option.meta.lastName,
        position: option.meta.position ?? null,
        supabaseId: option.meta.supabaseId,
    };
};
exports.getCachedPlayerSelection = getCachedPlayerSelection;
function PlayerSelect({ value, onChange, placeholder = 'Seleziona giocatore', disabled = false, }) {
    const [options, setOptions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        loadPlayerOptions()
            .then((result) => {
            if (cancelled) {
                return;
            }
            setOptions(result);
        })
            .catch((error) => {
            if (!cancelled) {
                console.error('[AdminPlayerSelect] options load failed', error);
            }
        })
            .finally(() => {
            if (!cancelled) {
                setIsLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const handleChange = (0, react_1.useCallback)((nextValue) => {
        if (!nextValue) {
            onChange(null);
            return;
        }
        const option = resolveOption(nextValue, options);
        if (!option) {
            onChange({
                id: nextValue,
                label: nextValue,
                source: 'supabase',
            });
            return;
        }
        onChange({
            id: option.value,
            label: option.label,
            source: option.meta.source,
            providerPlayerId: option.meta.providerPlayerId,
            teamAbbr: option.meta.teamAbbr,
            firstName: option.meta.firstName,
            lastName: option.meta.lastName,
            position: option.meta.position ?? null,
            supabaseId: option.meta.supabaseId,
        });
    }, [onChange, options]);
    const selectOptions = (0, react_1.useMemo)(() => options.map((option) => {
        const subtitleTokens = [
            option.meta.teamAbbr ?? undefined,
            option.meta.position ?? undefined,
            option.meta.source === 'roster' ? 'Roster' : 'Supabase',
        ].filter(Boolean);
        return {
            id: option.value,
            label: option.label,
            subtitle: subtitleTokens.join(' • '),
            disabled: false,
            keywords: option.meta.altNames,
        };
    }), [options]);
    const resolvedValue = (0, react_1.useMemo)(() => value ?? '', [value]);
    return ((0, jsx_runtime_1.jsx)(PlayerSelect_1.PlayerSelect, { value: resolvedValue || undefined, onChange: handleChange, options: selectOptions, placeholder: isLoading ? 'Caricamento…' : placeholder, disabled: disabled || isLoading, debounceMs: 200 }));
}
