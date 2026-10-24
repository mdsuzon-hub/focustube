import type { Settings } from './types';

/** The concrete behaviours switched on by the master toggle + mode + individual settings. */
export interface Features {
  shorts: boolean;
  redirectShorts: boolean;
  hideHomeRecs: boolean;
  hideRelated: boolean;
  hideShelves: boolean;
  hideEndScreen: boolean;
  hideComments: boolean;
  filterSearch: boolean;
  hud: boolean;
  homePanel: boolean;
}

export const NO_FEATURES: Features = {
  shorts: false,
  redirectShorts: false,
  hideHomeRecs: false,
  hideRelated: false,
  hideShelves: false,
  hideEndScreen: false,
  hideComments: false,
  filterSearch: false,
  hud: false,
  homePanel: false,
};

export function effectiveFeatures(s: Settings): Features {
  if (!s.enabled) return NO_FEATURES;
  const strict = s.mode === 'study' || s.mode === 'research';
  return {
    shorts: s.shorts.block,
    redirectShorts: s.shorts.block && s.shorts.redirectDirect,
    hideHomeRecs: strict,
    hideRelated: strict,
    hideShelves: true, // balanced reduces shelves; the stricter modes remove them too
    hideEndScreen: strict && s.focus.hideEndScreen,
    hideComments: s.mode === 'study' && s.focus.hideComments,
    filterSearch: s.mode === 'research' || s.search.applyInAllModes,
    hud: s.focus.showHud,
    homePanel: s.mode === 'study' && s.focus.showHomePanel,
  };
}
