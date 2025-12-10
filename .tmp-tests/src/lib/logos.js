"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEAM_LOGOS = void 0;
exports.getTeamLogoByAbbr = getTeamLogoByAbbr;
exports.TEAM_LOGOS = {
    ATL: '/loghi-squadre/ATL.png',
    BOS: '/loghi-squadre/BOS.png',
    BKN: '/loghi-squadre/BKN.png',
    CHA: '/loghi-squadre/CHA.png',
    CHI: '/loghi-squadre/CHI.png',
    CLE: '/loghi-squadre/CLE.png',
    DAL: '/loghi-squadre/DAL.png',
    DEN: '/loghi-squadre/DEN.png',
    DET: '/loghi-squadre/DET.png',
    GSW: '/loghi-squadre/GSW.png',
    HOU: '/loghi-squadre/HOU.png',
    IND: '/loghi-squadre/IND.png',
    LAC: '/loghi-squadre/LAC.png',
    LAL: '/loghi-squadre/LAL.png',
    MEM: '/loghi-squadre/MEM.png',
    MIA: '/loghi-squadre/MIA.png',
    MIL: '/loghi-squadre/MIL.png',
    MIN: '/loghi-squadre/MIN.png',
    NOP: '/loghi-squadre/NOP.png',
    NYK: '/loghi-squadre/NYK.png',
    OKC: '/loghi-squadre/OKC.png',
    ORL: '/loghi-squadre/ORL.png',
    PHI: '/loghi-squadre/PHI.png',
    PHX: '/loghi-squadre/PHX.png',
    POR: '/loghi-squadre/POR.png',
    SAC: '/loghi-squadre/SAC.png',
    SAS: '/loghi-squadre/SAS.png',
    TOR: '/loghi-squadre/TOR.png',
    UTA: '/loghi-squadre/UTA.png',
    WAS: '/loghi-squadre/WAS.png',
};
function getTeamLogoByAbbr(abbr) {
    if (!abbr) {
        return '/loghi-squadre/default.png';
    }
    const normalized = abbr.toUpperCase();
    return exports.TEAM_LOGOS[normalized] ?? `/loghi-squadre/${normalized}.png`;
}
