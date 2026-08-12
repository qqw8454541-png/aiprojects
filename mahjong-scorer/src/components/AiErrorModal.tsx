'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { AlertTriangle, WifiOff, Hourglass, ServerCrash, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface AiErrorModalProps {
  isOpen: boolean;
  errorType: string | null;
  details?: string;
  onClose: () => void;
}

export default function AiErrorModal({ isOpen, errorType, details, onClose }: AiErrorModalProps) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !errorType) return null;

  const handleCopy = () => {
    if (!details) return;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // UI elements depending on error type
  let title = 'Error';
  let description = 'An unexpected error occurred.';
  let icon = <AlertTriangle className="w-12 h-12 text-amber-500" />;
  let colorClass = 'bg-amber-500/10 border-amber-500/20';

  if (errorType === 'RATE_LIMIT_EXCEEDED') {
    title = t('eval.quotaExceeded' as Parameters<typeof t>[0]);
    description = 'API request limit reached. Please wait a moment before trying again or upgrade your plan.';
    icon = <Hourglass className="w-12 h-12 text-amber-500 animate-pulse" />;
    colorClass = 'bg-amber-500/10 border-amber-500/20 text-amber-500';
  } else if (errorType === 'NETWORK_ERROR') {
    title = t('eval.connectionError' as Parameters<typeof t>[0]);
    description = 'Could not connect to the service. Please check your internet connection, credentials, or VPN configuration.';
    icon = <WifiOff className="w-12 h-12 text-blue-500" />;
    colorClass = 'bg-blue-500/10 border-blue-500/20 text-blue-500';
  } else if (errorType === 'SERVICE_ERROR') {
    title = t('eval.apiError' as Parameters<typeof t>[0]);
    description = 'The AI service experienced an issue or returned unexpected data. Please try again.';
    icon = <ServerCrash className="w-12 h-12 text-rose-500" />;
    colorClass = 'bg-rose-500/10 border-rose-500/20 text-rose-500';
  } else if (errorType === 'UNKNOWN_ERROR') {
    title = 'Unknown Error';
    description = 'An unhandled exception occurred in the system. Raw details are available below for troubleshooting.';
    icon = <AlertTriangle className="w-12 h-12 text-zinc-500" />;
    colorClass = 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500';
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] glass-overlay flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
        >
          {/* Decorative gradients */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/5 blur-2xl rounded-full pointer-events-none" />

          {/* Body */}
          <div className="p-6 flex flex-col items-center text-center">
            {/* Styled Icon Container */}
            <div className={`p-4 rounded-2xl border mb-4 ${colorClass}`}>
              {icon}
            </div>

            {/* Title & Description */}
            <h3 className="text-lg font-black text-zinc-950 dark:text-zinc-50 tracking-wide mb-2">
              {title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6 px-2">
              {description}
            </p>

            {/* Collapsible details for troubleshooting (Especially for UNKNOWN_ERROR or if details exist) */}
            {details && (
              <div className="w-full mb-6 text-left">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between py-2.5 px-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    ⚙️ Trouble Shooting Details
                  </span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-3 bg-zinc-950 text-emerald-400 font-mono text-[10px] rounded-xl relative border border-zinc-800 max-h-[160px] overflow-y-auto break-all leading-normal select-text">
                        <button
                          onClick={handleCopy}
                          className="absolute top-2 right-2 p-1 bg-zinc-900 hover:bg-zinc-800 rounded text-zinc-400 transition-colors"
                          title="Copy details"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {details}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action Buttons */}
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98] shadow-md"
            >
              {t('common.confirm' as Parameters<typeof t>[0])}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
