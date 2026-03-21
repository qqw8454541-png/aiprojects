'use client';

import { useI18n } from '@/lib/i18n';

interface NumPadProps {
  onInput: (digit: string) => void;
  onBackspace: () => void;
  onToggleSign: () => void;
  onNext: () => void;
  onConfirm?: () => void;
  showConfirm?: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
}

export default function NumPad({
  onInput,
  onBackspace,
  onToggleSign,
  onNext,
  onConfirm,
  showConfirm = false,
  confirmDisabled = false,
  confirmLabel,
}: NumPadProps) {
  const { t } = useI18n();

  const buttonBase =
    'flex items-center justify-center rounded-xl text-xl font-bold transition-all active:scale-95 select-none shadow-sm';
  const digitBtn = `${buttonBase} bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 dark:active:bg-zinc-600 h-14 border border-zinc-200 dark:border-transparent`;
  const actionBtn = `${buttonBase} h-14`;

  return (
    <div className="grid grid-cols-4 gap-2 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
      {/* Row 1: 7 8 9 ⌫ */}
      {['7', '8', '9'].map((d) => (
        <button key={d} className={digitBtn} onClick={() => onInput(d)}>
          {d}
        </button>
      ))}
      <button
        className={`${actionBtn} bg-amber-500 dark:bg-amber-700 text-amber-50 dark:text-amber-100 hover:bg-amber-600 dark:hover:bg-amber-600`}
        onClick={onBackspace}
      >
        ⌫
      </button>

      {/* Row 2: 4 5 6 ± */}
      {['4', '5', '6'].map((d) => (
        <button key={d} className={digitBtn} onClick={() => onInput(d)}>
          {d}
        </button>
      ))}
      <button
        className={`${actionBtn} bg-indigo-500 dark:bg-indigo-700 text-indigo-50 dark:text-indigo-100 hover:bg-indigo-600 dark:hover:bg-indigo-600`}
        onClick={onToggleSign}
      >
        ±
      </button>

      {/* Row 3: 1 2 3 次 */}
      {['1', '2', '3'].map((d) => (
        <button key={d} className={digitBtn} onClick={() => onInput(d)}>
          {d}
        </button>
      ))}
      <button
        className={`${actionBtn} bg-teal-600 dark:bg-teal-700 text-teal-50 dark:text-teal-100 hover:bg-teal-500 dark:hover:bg-teal-600`}
        onClick={onNext}
      >
        {t('common.next')}
      </button>

      {/* Row 4: 0 (2-wide), confirm or empty */}
      <button
        className={`${digitBtn} col-span-2`}
        onClick={() => onInput('0')}
      >
        0
      </button>
      {showConfirm && onConfirm ? (
        <button
          className={`${actionBtn} col-span-2 ${
            confirmDisabled
              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-transparent dark:border-transparent'
              : 'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 border border-emerald-600 dark:border-transparent shadow-emerald-900/20 shadow-md'
          }`}
          onClick={() => !confirmDisabled && onConfirm()}
          disabled={confirmDisabled}
        >
          {confirmLabel || t('score.calculate')}
        </button>
      ) : (
        <div className="col-span-2" />
      )}
    </div>
  );
}
