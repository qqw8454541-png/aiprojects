export interface ScoringContext {
  ruleName: string;
  uma: number[];
  roundCount: number;
}

// NOTE: The rest of the LLM configuration (prompts, thresholds, model config) 
// has been moved to the external llm-web-api project to prevent API key extraction from the client APK.
