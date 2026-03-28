export interface RuleConfig {
  name: string;
  mode?: '4-player' | '3-player';
  startPoints: number;
  returnPoints: number;
  uma: number[];
  tiebreakRule?: 'seat_priority' | 'split';
}

export const PRESETS: Record<string, RuleConfig> = {
  mLeague: {
    name: 'M-League',
    mode: '4-player',
    startPoints: 25000,
    returnPoints: 30000,
    uma: [50, 10, -10, -50],
    tiebreakRule: 'split',
  },
  majsoul: {
    name: 'Mahjong Soul',
    mode: '4-player',
    startPoints: 25000,
    returnPoints: 30000,
    uma: [15, 5, -5, -15],
    tiebreakRule: 'seat_priority',
  },
  wrc: {
    name: 'WRC',
    mode: '4-player',
    startPoints: 30000,
    returnPoints: 30000,
    uma: [15, 5, -5, -15],
    tiebreakRule: 'seat_priority',
  },
  sanmaMajsoul: {
    name: 'Sanma Majsoul',
    mode: '3-player',
    startPoints: 35000,
    returnPoints: 40000,
    uma: [15, 0, -15],
    tiebreakRule: 'seat_priority',
  },
  sanmaStandard: {
    name: 'Sanma Standard',
    mode: '3-player',
    startPoints: 35000,
    returnPoints: 40000,
    uma: [20, 0, -20],
    tiebreakRule: 'seat_priority',
  },
};

export function createCustomRule(
  startPoints: number,
  returnPoints: number,
  uma: number[],
  mode: '4-player' | '3-player' = '4-player',
  tiebreakRule: 'seat_priority' | 'split' = 'seat_priority'
): RuleConfig {
  return {
    name: 'Custom',
    mode,
    startPoints,
    returnPoints,
    uma,
    tiebreakRule,
  };
}
