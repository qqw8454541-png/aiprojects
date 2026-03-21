export interface RuleConfig {
  name: string;
  mode?: '4-player' | '3-player';
  startPoints: number;
  returnPoints: number;
  uma: number[];
}

export const PRESETS: Record<string, RuleConfig> = {
  mLeague: {
    name: 'M-League',
    mode: '4-player',
    startPoints: 25000,
    returnPoints: 30000,
    uma: [50, 10, -10, -50],
  },
  majsoul: {
    name: 'Mahjong Soul',
    mode: '4-player',
    startPoints: 25000,
    returnPoints: 30000,
    uma: [15, 5, -5, -15],
  },
  wrc: {
    name: 'WRC',
    mode: '4-player',
    startPoints: 30000,
    returnPoints: 30000,
    uma: [15, 5, -5, -15],
  },
  sanmaMajsoul: {
    name: 'Sanma Majsoul',
    mode: '3-player',
    startPoints: 35000,
    returnPoints: 40000,
    uma: [15, 0, -15],
  },
  sanmaStandard: {
    name: 'Sanma Standard',
    mode: '3-player',
    startPoints: 35000,
    returnPoints: 40000,
    uma: [20, 0, -20],
  },
};

export function createCustomRule(
  startPoints: number,
  returnPoints: number,
  uma: number[],
  mode: '4-player' | '3-player' = '4-player'
): RuleConfig {
  return {
    name: 'Custom',
    mode,
    startPoints,
    returnPoints,
    uma,
  };
}
