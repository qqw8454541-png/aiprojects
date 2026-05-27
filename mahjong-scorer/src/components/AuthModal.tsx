'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthModal() {
  const { t, locale } = useI18n();
  const { showAuthModal, authModalContext, closeAuthModal, login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'main' | 'email' | 'phone'>('main');
  const [inputValue, setInputValue] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const contextKeyMap: Record<string, string> = {
    ai: 'auth.contextAi',
    cloud_sync: 'auth.contextCloudSync',
    limit_reached: 'auth.contextLimitReached',
    general: 'auth.contextGeneral',
  };

  const getContextMessage = () => {
    const key = contextKeyMap[authModalContext] || contextKeyMap.general;
    return t(key as Parameters<typeof t>[0]);
  };

  const handleProviderLogin = async (provider: 'google' | 'apple', credential?: string) => {
    setLoading(true);
    try {
      await login(provider, credential);
    } finally {
      setLoading(false);
      resetForm();
    }
  };

  const handleSendCode = async () => {
    if (!inputValue.trim()) return;
    setSendingCode(true);
    
    try {
      if (mode === 'email') {
        const { error } = await supabase.auth.signInWithOtp({ email: inputValue });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: inputValue });
        if (error) throw error;
      }
      setCodeSent(true);
    } catch (e: any) {
      alert(e.message || 'Failed to send code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyAndLogin = async () => {
    if (verifyCode.length !== 6) return;
    setLoading(true);
    
    try {
      const params = mode === 'email'
        ? { email: inputValue, token: verifyCode, type: 'email' as const }
        : { phone: inputValue, token: verifyCode, type: 'sms' as const };
      
      const { error } = await supabase.auth.verifyOtp(params);
      if (error) throw error;
      closeAuthModal();
      resetForm();
    } catch (e: any) {
      alert(e.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode('main');
    setInputValue('');
    setVerifyCode('');
    setCodeSent(false);
  };

  if (!showAuthModal) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] glass-overlay flex items-center justify-center p-4"
        onClick={() => { closeAuthModal(); resetForm(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl"
        >
          {/* Header */}
          <div className="p-5 pb-3 text-center">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
              {t('auth.title' as Parameters<typeof t>[0]) || 'Sign In'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
              {getContextMessage()}
            </p>
          </div>

          {/* Body */}
          <div className="px-5 pb-5 space-y-3">
            {mode === 'main' && (
              <>
                {/* Apple Sign In */}
                <button
                  onClick={() => handleProviderLogin('apple')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black text-white font-bold text-sm transition-all hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <span className="text-lg">🍎</span>
                      {t('auth.apple' as Parameters<typeof t>[0]) || 'Sign in with Apple'}
                    </>
                  )}
                </button>

                {/* Google Sign In */}
                <button
                  onClick={() => handleProviderLogin('google')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm border border-zinc-200 dark:border-zinc-700 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <span className="text-lg">🔵</span>
                      {t('auth.google' as Parameters<typeof t>[0]) || 'Sign in with Google'}
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">OR</span>
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                </div>

                {/* Email */}
                <button
                  onClick={() => setMode('email')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97]"
                >
                  <span>📧</span>
                  {t('auth.email' as Parameters<typeof t>[0]) || 'Email Login'}
                </button>

                {/* Phone */}
                <button
                  onClick={() => setMode('phone')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97]"
                >
                  <span>📱</span>
                  {t('auth.phone' as Parameters<typeof t>[0]) || 'Phone Login'}
                </button>
              </>
            )}

            {/* Email / Phone verification form */}
            {(mode === 'email' || mode === 'phone') && (
              <div className="space-y-3">
                <button
                  onClick={resetForm}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  ← {t('common.back')}
                </button>

                <input
                  autoFocus
                  type={mode === 'email' ? 'email' : 'tel'}
                  placeholder={mode === 'email'
                    ? (t('auth.emailPlaceholder' as Parameters<typeof t>[0]) || 'your@email.com')
                    : (t('auth.phonePlaceholder' as Parameters<typeof t>[0]) || '+81 XXX-XXXX-XXXX')
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {!codeSent ? (
                  <button
                    onClick={handleSendCode}
                    disabled={!inputValue.trim() || sendingCode}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500"
                  >
                    {sendingCode ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('auth.sending' as Parameters<typeof t>[0]) || 'Sending...'}
                      </span>
                    ) : (
                      t('auth.sendCode' as Parameters<typeof t>[0]) || 'Send Verification Code'
                    )}
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
                      ✓ {t('auth.codeSent' as Parameters<typeof t>[0]) || 'Code sent! (Mock: any 6 digits work)'}
                    </p>
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-center text-xl font-mono tracking-[0.5em] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleVerifyAndLogin}
                      disabled={verifyCode.length !== 6 || loading}
                      className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        t('auth.verify' as Parameters<typeof t>[0]) || 'Verify & Sign In'
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 text-center pt-2 leading-relaxed">
              {t('auth.terms' as Parameters<typeof t>[0]) || 'By signing in, you agree to the Terms of Service and Privacy Policy.'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
