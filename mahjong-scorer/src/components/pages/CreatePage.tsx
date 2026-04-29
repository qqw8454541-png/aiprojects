'use client';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { RuleConfig } from '@/lib/rules';
import RulePresets from '@/components/RulePresets';

export default function CreatePage() {
  const { t } = useI18n();
  const { setPage, createRoom } = useGameStore();

  function handleRuleSelect(rules: RuleConfig) {
    createRoom(rules);
  }

  return (
    <div className="min-h-dvh px-4 py-6 pt-24 page-enter">

      <RulePresets onSelect={handleRuleSelect} />
    </div>
  );
}
