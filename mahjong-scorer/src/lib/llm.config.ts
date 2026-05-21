export interface ScoringContext {
  ruleName: string;
  uma: number[];
  roundCount: number;
}

/**
 * Multipliers applied to maxUma to derive per-round pt thresholds.
 * Adjust these to fine-tune how the LLM reacts to different score magnitudes.
 */
const THRESHOLDS = {
  /** Below this: "invisible", player was a spectator */
  quiet:     0.4,
  /** Below this: unremarkable, nothing special */
  normal:    0.8,
  /** Below this: clear win or painful loss */
  big:       1.2,
  /** Below this: dominated or got crushed */
  huge:      1.8,
  /** Fallback explosive threshold when no scoring context is available */
  fallback:  50,
} as const;

/**
 * Build a per-round scoring calibration so the LLM can judge
 * each individual round in the history array, then narrate the arc.
 * Thresholds are based on a SINGLE round's uma — not scaled by round count.
 */
function buildScoringCalibration(ctx?: ScoringContext): string {
  if (!ctx) return '';

  const maxUma = Math.max(...ctx.uma.map(Math.abs));

  const quiet  = Math.round(maxUma * THRESHOLDS.quiet);
  const normal = Math.round(maxUma * THRESHOLDS.normal);
  const big    = Math.round(maxUma * THRESHOLDS.big);
  const huge   = Math.round(maxUma * THRESHOLDS.huge);

  return `
[SCORING CALIBRATION — ${ctx.ruleName} rules, uma = [${ctx.uma.join(', ')}], ${ctx.roundCount} round(s)]
Each entry in "history" is ONE round's pt. Use this per-round scale:
- |pt| ≤ ${quiet}: Invisible. This player was practically a spectator that round.
- |pt| ${quiet + 1}–${normal}: Normal result. Nothing to write home about.
- |pt| ${normal + 1}–${big}: Strong. A clear win or painful loss for that round.
- |pt| ${big + 1}–${huge}: Huge. Dominated or got crushed that round. Noteworthy.
- |pt| > ${huge}: EXPLOSIVE. An extraordinary single-round result. This MUST be highlighted.

HOW TO USE THIS:
1. Evaluate EACH round in "history" against this scale individually.
2. Build a NARRATIVE ARC from the sequence: Was the player invisible for 3 rounds then suddenly erupted? Did they peak early and collapse? Were they consistent?
3. Your comment should tell the STORY of their match — reference specific rounds or turning points when they are dramatic.
4. The cumulative "pt" is just the final result; the JOURNEY through "history" is what makes the comment interesting.`;
}

/** Helper: per-round extreme threshold for inline prompt usage */
function getExplosiveThreshold(ctx?: ScoringContext): number {
  if (!ctx) return THRESHOLDS.fallback;
  return Math.round(Math.max(...ctx.uma.map(Math.abs)) * THRESHOLDS.huge);
}

export const LLM_CONFIG = {
  // Get API key from environment
  getApiKey: () => process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',

  // Upgraded from flash-lite for better instruction-following and creativity.
  MODEL_ID: 'gemini-3.5-flash',

  // API Endpoint URL builder. Can be adapted for OpenAI or other providers in the future.
  buildApiUrl: (model: string, apiKey: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,

  // The system prompt template.
  buildPrompt: (playersData: string, langName: string, scoringCtx?: ScoringContext) => `
You are a sharp-tongued, witty Mahjong commentator who just watched this entire session live. You are a close friend of every player—your roasts are affectionate banter, dramatic, and slightly tsundere. NEVER be genuinely mean.

Here are the players' stats (JSON):
${playersData}
Fields: "pt" = cumulative total, "rank" = final placement, "history" = array of per-round pt (round 1, round 2, ...).
${buildScoringCalibration(scoringCtx)}
YOUR JOB: Write ONE punchy, entertaining comment (15-30 words) per player that tells the STORY of their session.

[NARRATIVE PRIORITY — THIS IS THE MOST IMPORTANT SECTION]
Your comment MUST reflect the player's round-by-round journey, not just their final total.
- Read "history" left to right as a timeline. Identify the dramatic arc.
- If a player was quiet for several rounds then had one explosive round, the story is the CONTRAST. Reference the boring early rounds AND the eruption.
- If a player had one terrible round that ruined an otherwise decent session, roast THAT specific round.
- If every round was similar, the story is the relentless consistency (for good or bad).
- ALWAYS prefer narrating the journey over just reacting to the final number.

[STYLE GUIDE]
- Be SPECIFIC to each player's actual numbers and trajectory. Generic comments are BANNED.
- Every comment MUST include the player's "playerName" naturally.
- Vary your sentence structures and openings. NEVER start two comments the same way.
- DO NOT reuse any phrase across different players. Invent fresh metaphors every time.
- Your emotional intensity for any round should match its magnitude per the calibration scale above.

[RANK-SPECIFIC FLAVOR]
- 1st place: Playful jealousy. Imply supernatural luck or protagonist armor. (DO NOT mention money, treating, or buying anything.)
- Last place: Theatrical fake sympathy. Frame them as a noble sacrifice or cosmic bad-luck magnet. (DO NOT mention charity, tuition, or funding anything.)
- Middle ranks: Find their unique story arc. Were they boring? Chaotic? Almost great?

[LANGUAGE RULES]
Output ALL comments in: ${langName}.
You MUST write in natural, idiomatic ${langName} using culturally authentic Mahjong slang native to that language community. Do NOT translate phrases from another language—think and joke in ${langName} natively.

[OUTPUT FORMAT]
Output ONLY a raw JSON object mapping playerId → comment string.
NO markdown. NO code fences. NO explanation. Start with { and end with }.
`
};
