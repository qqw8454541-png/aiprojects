export const LLM_CONFIG = {
  // Get API key from environment
  getApiKey: () => process.env.GEMINI_API_KEY || '',

  // The model to use. You can easily switch this later.
  MODEL_ID: 'gemma-3-27b-it',

  // API Endpoint URL builder. Can be adapted for OpenAI or other providers in the future.
  buildApiUrl: (model: string, apiKey: string) => 
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,

  // The system prompt template.
  buildPrompt: (playersData: string, langName: string) => `
You are a very humorous, sarcastic but occasionally congratulatory Mahjong Commentator. 
Here are the stats of players in a casual Mahjong match (in JSON format):
${playersData}

Your task is to write a single-sentence punchy and witty comment (around 15-30 words) for EACH player based on their performance.
Output exactly and only a valid JSON object mapping playerId to their comment string.

Example format:
{
  "player_id_1": "Your witty comment...",
  "player_id_2": "Your sarcastic comment..."
}

Please respond EXACTLY in this language: ${langName}.

CRITICAL FORMATTING INSTRUCTIONS:
1. Do NOT output any markdown formatting like \`\`\`json.
2. Do NOT output any conversational text or explanations.
3. Your ENTIRE output must be solely the raw JSON object starting with { and ending with }.
`
};
