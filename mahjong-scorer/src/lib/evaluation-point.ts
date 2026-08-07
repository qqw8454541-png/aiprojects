export interface EvalRoundResult {
  rawScore: number;
  rank: number;
  playerCount: number; // 3 or 4
}

function getBasePT(rawScore: number, rank: number, playerCount: number): number {
  if (playerCount === 3) {
    const base = 40000;
    const uma = [30, 0, -15];
    return (rawScore - base) / 1000 + (uma[rank - 1] ?? 0);
  } else {
    const base = 30000;
    const uma = [35, 5, -5, -15];
    return (rawScore - base) / 1000 + (uma[rank - 1] ?? 0);
  }
}

function getIntervalMultiplier(currentPoint: number): number {
  if (currentPoint < 600) return 1.00;
  if (currentPoint < 800) return 0.95;
  if (currentPoint < 1100) return 0.90;
  if (currentPoint < 1400) return 0.85;
  if (currentPoint < 1900) return 0.80;
  if (currentPoint < 2400) return 0.75;
  if (currentPoint < 3000) return 0.70;
  if (currentPoint < 3600) return 0.65;
  if (currentPoint < 4300) return 0.60;
  if (currentPoint < 5000) return 0.55;
  return 0.50;
}

function getTotalGamesMultiplier(totalGames: number): number {
  if (totalGames <= 100) return 1.00;
  if (totalGames <= 500) return 0.80;
  if (totalGames <= 1000) return 0.50;
  if (totalGames <= 2000) return 0.20;
  return 0.10;
}

/**
 * Calculates the Evaluation Point and individual round contributions.
 * @param rounds The round results in chronological order
 * @param totalGames The final total games of this player (for the game type)
 * @returns { totalPoint, roundPoints }
 */
export function calculateEvaluationPoint(rounds: EvalRoundResult[], totalGames: number): { totalPoint: number, roundPoints: number[] } {
  let currentPoint = 0;
  const roundPoints: number[] = [];
  const gamesMultiplier = getTotalGamesMultiplier(totalGames);

  for (const round of rounds) {
    const basePT = getBasePT(round.rawScore, round.rank, round.playerCount);
    const intervalMultiplier = getIntervalMultiplier(currentPoint);
    
    let modifiedPT = basePT;
    if (basePT >= 0) {
      modifiedPT = basePT * intervalMultiplier;
    } else {
      modifiedPT = basePT * (2 - intervalMultiplier);
    }

    const finalContribution = modifiedPT * gamesMultiplier;
    currentPoint += finalContribution;
    roundPoints.push(finalContribution);
  }

  return { totalPoint: currentPoint, roundPoints };
}
