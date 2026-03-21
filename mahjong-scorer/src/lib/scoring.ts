import type { RuleConfig } from './rules';

export type Wind = 'east' | 'south' | 'west' | 'north';

export const WIND_ORDER: Wind[] = ['east', 'south', 'west', 'north'];

export interface PlayerScore {
  playerId: string;
  playerName: string;
  wind: Wind;
  rawScore: number; // actual score in points (e.g. 35500)
}

export interface PlayerResult extends PlayerScore {
  rank: number;
  pt: number;
}

/**
 * Converts abbreviated input to full score.
 * Input is in hundreds: 355 → 35500, -12 → -1200
 * The input represents the value without the trailing "00".
 */
export function abbreviatedToFull(input: number): number {
  return input * 100;
}

/**
 * Converts full score to abbreviated display.
 * 35500 → 355, -1200 → -12
 */
export function fullToAbbreviated(score: number): number {
  return score / 100;
}

/**
 * Auto-calculate the last player's score given N-1 players' scores and rule config.
 * Formula: Score_Last = (startPoints × N) - (Sum of provided scores)
 */
export function calculateLastScore(
  scores: number[],
  startPoints: number
): number {
  const multiplier = scores.length === 2 ? 3 : 4;
  const total = startPoints * multiplier;
  return total - scores.reduce((a, b) => a + b, 0);
}

/**
 * Validate that all scores sum to startPoints * N.
 */
export function validateScores(
  scores: number[],
  startPoints: number
): boolean {
  if (scores.length !== 3 && scores.length !== 4) return false;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum === startPoints * scores.length;
}

/**
 * Determine rankings. Tie-breaker: East > South > West > North.
 * Returns the scores sorted by rank (1st to 4th).
 */
export function determineRankings(players: PlayerScore[]): PlayerScore[] {
  return [...players].sort((a, b) => {
    if (b.rawScore !== a.rawScore) {
      return b.rawScore - a.rawScore; // higher score = better rank
    }
    // Tie-breaker: wind priority East > South > West > North
    return WIND_ORDER.indexOf(a.wind) - WIND_ORDER.indexOf(b.wind);
  });
}

/**
 * Calculate PT for all players.
 *
 * For 2nd, 3rd, 4th:
 *   PT = (rawScore - returnPoints) / 1000 + uma[rank]
 *
 * For 1st:
 *   PT = (rawScore - returnPoints) / 1000 + uma[0] + oka
 *   where oka = (returnPoints - startPoints) × 4
 *
 * After calculation, apply rounding correction to ensure sum = 0.
 */
export function calculatePT(
  players: PlayerScore[],
  rules: RuleConfig
): PlayerResult[] {
  const ranked = determineRankings(players);
  const multiplier = players.length === 3 ? 3 : 4;
  const oka = (rules.returnPoints - rules.startPoints) * multiplier / 1000; // oka in PT units

  const results: PlayerResult[] = ranked.map((player, index) => {
    const rank = index + 1;
    const basePT = (player.rawScore - rules.returnPoints) / 1000;
    const uma = rules.uma[index] || 0;

    let pt: number;
    if (rank === 1) {
      pt = basePT + uma + oka;
    } else {
      pt = basePT + uma;
    }

    // Round to 1 decimal
    pt = Math.round(pt * 10) / 10;

    return {
      ...player,
      rank,
      pt,
    };
  });

  // Ensure sum of PT is exactly 0 by adjusting 1st place
  const sumOthers = results.slice(1).reduce((s, r) => s + r.pt, 0);
  results[0].pt = Math.round(-sumOthers * 10) / 10;

  return results;
}
