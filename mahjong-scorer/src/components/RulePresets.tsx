'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { PRESETS, createCustomRule, type RuleConfig } from '@/lib/rules';

interface RulePresetsProps {
  onSelect: (rules: RuleConfig) => void;
  defaultRules?: RuleConfig | null;
  submitLabel?: string;
  disabledMode?: boolean;
}

export default function RulePresets({ onSelect, defaultRules, submitLabel, disabledMode }: RulePresetsProps) {
  const { t } = useI18n();
  const [activePreset, setActivePreset] = useState<string | null>(() => {
    if (defaultRules) {
      const match = Object.entries(PRESETS).find(
        ([, preset]) =>
          preset.mode === (defaultRules.mode || '4-player') &&
          preset.startPoints === defaultRules.startPoints &&
          preset.returnPoints === defaultRules.returnPoints &&
          preset.uma.join(',') === defaultRules.uma.join(',')
      );
      if (match) return match[0];
      return null;
    }
    return 'mLeague';
  });

  const [mode, setMode] = useState<'4-player' | '3-player'>(defaultRules?.mode || '4-player');

  const [isCustom, setIsCustom] = useState(() => {
    if (defaultRules) {
      const match = Object.values(PRESETS).some(
        (preset) =>
          preset.mode === (defaultRules.mode || '4-player') &&
          preset.startPoints === defaultRules.startPoints &&
          preset.returnPoints === defaultRules.returnPoints &&
          preset.uma.join(',') === defaultRules.uma.join(',')
      );
      return !match;
    }
    return false;
  });
  const [customStart, setCustomStart] = useState(defaultRules?.startPoints ?? 25000);
  const [customReturn, setCustomReturn] = useState(defaultRules?.returnPoints ?? 30000);
  const [customUma, setCustomUma] = useState<number[]>(
    defaultRules?.uma ?? [15, 5, -5, -15]
  );
  const [customTiebreakRule, setCustomTiebreakRule] = useState<'seat_priority' | 'split'>(
    defaultRules?.tiebreakRule ?? 'seat_priority'
  );

  const presetKeys = (Object.keys(PRESETS) as Array<keyof typeof PRESETS>).filter(k => PRESETS[k].mode === mode);

  const presetLabels: Record<string, string> = {
    mLeague: t('create.mLeague' as Parameters<typeof t>[0]) || 'M-League',
    majsoul: t('create.majsoul' as Parameters<typeof t>[0]) || 'Mahjong Soul',
    wrc: t('create.wrc' as Parameters<typeof t>[0]) || 'WRC',
    sanmaMajsoul: t('create.sanmaMajsoul' as Parameters<typeof t>[0]) || 'Sanma Majsoul',
    sanmaStandard: t('create.sanmaStandard' as Parameters<typeof t>[0]) || 'Sanma Standard',
  };

  function handlePresetClick(key: string) {
    setActivePreset(key);
    setIsCustom(false);
  }

  function handleCustomClick() {
    setActivePreset(null);
    setIsCustom(true);
  }

  function handleModeChange(newMode: '4-player' | '3-player') {
    if (disabledMode) return;
    setMode(newMode);
    setActivePreset(newMode === '3-player' ? 'sanmaMajsoul' : 'mLeague');
    setIsCustom(false);
    setCustomUma(newMode === '3-player' ? [15, 0, -15] : [15, 5, -5, -15]);
  }

  function handleConfirm() {
    if (isCustom) {
      onSelect(createCustomRule(customStart, customReturn, customUma.slice(0, mode === '3-player' ? 3 : 4), mode, customTiebreakRule));
    } else if (activePreset) {
      onSelect(PRESETS[activePreset]);
    }
  }

  const selectedRule = activePreset ? PRESETS[activePreset] : null;

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
        <button
          disabled={disabledMode}
          onClick={() => handleModeChange('4-player')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            mode === '4-player' 
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' 
              : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
          } ${disabledMode && mode !== '4-player' ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          {t('create.modeYonma' as Parameters<typeof t>[0])}
        </button>
        <button
          disabled={disabledMode}
          onClick={() => handleModeChange('3-player')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            mode === '3-player' 
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' 
              : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
          } ${disabledMode && mode !== '3-player' ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          {t('create.modeSanma' as Parameters<typeof t>[0])}
        </button>
      </div>

      {/* Preset cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {t('create.presets')}
        </h3>
        <div className={`grid gap-2 ${mode === '3-player' ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {presetKeys.map((key) => (
            <button
              key={key}
              onClick={() => handlePresetClick(key)}
              className={`
                rounded-xl border p-3 text-center transition-all shadow-sm
                ${
                  activePreset === key
                    ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-400/50 dark:ring-amber-500/50'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-500'
                }
              `}
            >
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {presetLabels[key]}
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                {PRESETS[key].startPoints / 1000}k / {PRESETS[key].returnPoints / 1000}k
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom button */}
      <button
        onClick={handleCustomClick}
        className={`
          w-full rounded-xl border p-3 text-sm font-medium transition-all shadow-sm
          ${
            isCustom
              ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-500'
          }
        `}
      >
        {t('create.custom')}
      </button>

      {/* Rule details */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4 space-y-3">
        {isCustom ? (
          <>
            {/* Custom inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  {t('create.startPoints')}
                </label>
                <input
                  type="number"
                  value={customStart}
                  onChange={(e) => setCustomStart(Number(e.target.value))}
                  className="w-full rounded-lg bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-600 text-zinc-900 dark:text-white px-3 py-2 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  {t('create.returnPoints')}
                </label>
                <input
                  type="number"
                  value={customReturn}
                  onChange={(e) => setCustomReturn(Number(e.target.value))}
                  className="w-full rounded-lg bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-600 text-zinc-900 dark:text-white px-3 py-2 text-sm shadow-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                {t('create.uma')}
              </label>
              <div className={`grid gap-2 ${mode === '3-player' ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {Array.from({ length: mode === '3-player' ? 3 : 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-zinc-500 text-center mb-1">
                      {t(`create.uma${(i + 1) as 1 | 2 | 3 | 4}`)}
                    </div>
                    <input
                      type="number"
                      value={customUma[i] || 0}
                      onChange={(e) => {
                        const newUma = [...customUma];
                        newUma[i] = Number(e.target.value);
                        setCustomUma(newUma);
                      }}
                      className="w-full rounded-lg bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-600 text-zinc-900 dark:text-white px-2 py-1.5 text-sm text-center shadow-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Tiebreak rule toggle */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                {t('create.tiebreakRule' as Parameters<typeof t>[0])}
              </label>
              <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCustomTiebreakRule('seat_priority')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    customTiebreakRule === 'seat_priority'
                      ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {t('create.tiebreakSeatPriority' as Parameters<typeof t>[0])}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomTiebreakRule('split')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    customTiebreakRule === 'split'
                      ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {t('create.tiebreakSplit' as Parameters<typeof t>[0])}
                </button>
              </div>
            </div>
          </>
        ) : selectedRule ? (
          <>
            {/* Display selected preset details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-500">{t('create.startPoints')}</span>
                <div className="text-zinc-900 dark:text-white font-mono font-medium">
                  {selectedRule.startPoints.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">{t('create.returnPoints')}</span>
                <div className="text-zinc-900 dark:text-white font-mono font-medium">
                  {selectedRule.returnPoints.toLocaleString()}
                </div>
              </div>
            </div>
            <div>
              <span className="text-xs text-zinc-500">{t('create.uma')}</span>
              <div className={`grid gap-2 mt-1 ${mode === '3-player' ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {selectedRule.uma.map((u, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[10px] text-zinc-500">
                      {t(`create.uma${(i + 1) as 1 | 2 | 3 | 4}`)}
                    </div>
                    <div
                      className={`font-mono text-sm font-bold ${
                        u >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {u > 0 ? `+${u}` : u}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-zinc-500">{t('create.tiebreakRule' as Parameters<typeof t>[0])}</span>
              <div className="text-sm font-medium text-zinc-900 dark:text-white mt-0.5">
                {selectedRule.tiebreakRule === 'split'
                  ? t('create.tiebreakSplit' as Parameters<typeof t>[0])
                  : t('create.tiebreakSeatPriority' as Parameters<typeof t>[0])}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={!activePreset && !isCustom}
        className={`
          w-full rounded-xl py-3.5 text-base font-bold transition-all shadow-sm
          ${
            activePreset || isCustom
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 text-white hover:brightness-110 active:scale-[0.98]'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          }
        `}
      >
        {submitLabel || t('create.createButton')}
      </button>
    </div>
  );
}
