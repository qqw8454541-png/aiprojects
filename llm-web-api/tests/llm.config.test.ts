import { LLM_CONFIG, type ScoringContext } from '../src/llm.config';

describe('LLM_CONFIG', () => {
  it('should have correct MODEL_ID', () => {
    expect(LLM_CONFIG.MODEL_ID).toBe('gemini-3.5-flash');
  });

  describe('buildApiUrl', () => {
    it('should build the correct API URL', () => {
      const url = LLM_CONFIG.buildApiUrl('test-model', 'test-api-key');
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent?key=test-api-key');
    });
  });

  describe('buildPrompt', () => {
    const mockPlayersData = '{"p1": {"pt": 10, "history": [10]}}';
    const mockLangName = 'English';

    it('should build prompt without scoring calibration if context is missing', () => {
      const prompt = LLM_CONFIG.buildPrompt(mockPlayersData, mockLangName);
      expect(prompt).toContain('Here are the players\' stats (JSON):');
      expect(prompt).toContain(mockPlayersData);
      expect(prompt).toContain('Output ALL comments in: English.');
      expect(prompt).not.toContain('[SCORING CALIBRATION');
    });

    it('should build prompt with scoring calibration when context is provided', () => {
      const ctx: ScoringContext = {
        ruleName: 'TestRule',
        uma: [15, 5, -5, -15],
        roundCount: 4
      };
      const prompt = LLM_CONFIG.buildPrompt(mockPlayersData, mockLangName, ctx);
      
      // maxUma = max(15, 5, 5, 15) = 15
      // THRESHOLDS: quiet(0.4)=6, normal(0.8)=12, big(1.2)=18, huge(1.8)=27
      expect(prompt).toContain('[SCORING CALIBRATION — TestRule rules, uma = [15, 5, -5, -15], 4 round(s)]');
      expect(prompt).toContain('- |pt| ≤ 6: Invisible.');
      expect(prompt).toContain('- |pt| 7–12: Normal result.');
      expect(prompt).toContain('- |pt| 13–18: Strong.');
      expect(prompt).toContain('- |pt| 19–27: Huge.');
      expect(prompt).toContain('- |pt| > 27: EXPLOSIVE.');
    });

    it('should handle negative maxUma calculation correctly', () => {
      const ctx: ScoringContext = {
        ruleName: 'NegativeRule',
        uma: [10, -20],
        roundCount: 2
      };
      const prompt = LLM_CONFIG.buildPrompt(mockPlayersData, mockLangName, ctx);
      
      // maxUma = Math.max(10, 20) = 20
      // THRESHOLDS: quiet(0.4)=8, normal(0.8)=16, big(1.2)=24, huge(1.8)=36
      expect(prompt).toContain('[SCORING CALIBRATION — NegativeRule rules, uma = [10, -20], 2 round(s)]');
      expect(prompt).toContain('- |pt| ≤ 8: Invisible.');
      expect(prompt).toContain('- |pt| 9–16: Normal result.');
      expect(prompt).toContain('- |pt| 17–24: Strong.');
      expect(prompt).toContain('- |pt| 25–36: Huge.');
      expect(prompt).toContain('- |pt| > 36: EXPLOSIVE.');
    });
  });
});
