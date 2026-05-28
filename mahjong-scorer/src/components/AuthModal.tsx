'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const COUNTRIES = [
  { code: '+81', flag: '🇯🇵', name: 'Japan', nameZh: '日本' },
  { code: '+86', flag: '🇨🇳', name: 'China', nameZh: '中国' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan', nameZh: '台湾' },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong', nameZh: '香港' },
  { code: '+1', flag: '🇺🇸', name: 'US / Canada', nameZh: '美国/加拿大' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea', nameZh: '韩国' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore', nameZh: '新加坡' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia', nameZh: '马来西亚' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom', nameZh: '英国' },
  { code: '+61', flag: '🇦🇺', name: 'Australia', nameZh: '澳大利亚' },
];

export default function AuthModal() {
  const { t, locale } = useI18n();
  const { showAuthModal, authModalContext, closeAuthModal, login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'main' | 'email' | 'phone'>('main');
  const [inputValue, setInputValue] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [countryCode, setCountryCode] = useState('+81');
  const [showCountrySelect, setShowCountrySelect] = useState(false);

  const getFormattedPhone = () => {
    return `${countryCode}${inputValue.replace(/^0+/, '').replace(/\D/g, '')}`;
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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
    setErrorMsg('');
    try {
      const res = await login(provider, credential);
      if (!res.success) {
        setErrorMsg(`Login failed: ${res.error}`);
      }
    } finally {
      setLoading(false);
      resetForm();
    }
  };

  const handleSendCode = async () => {
    if (!inputValue.trim()) return;
    setSendingCode(true);
    setErrorMsg('');
    
    try {
      if (mode === 'email') {
        const { error } = await supabase.auth.signInWithOtp({ email: inputValue });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: getFormattedPhone() });
        if (error) throw error;
      }
      setCodeSent(true);
      setCountdown(60);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to send code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyAndLogin = async () => {
    if (verifyCode.length !== 6) return;
    setLoading(true);
    setErrorMsg('');
    
    try {
      const params = mode === 'email'
        ? { email: inputValue, token: verifyCode, type: 'email' as const }
        : { phone: getFormattedPhone(), token: verifyCode, type: 'sms' as const };
      
      console.log('[AuthModal] Calling verifyOtp with:', params);
      const { data, error } = await supabase.auth.verifyOtp(params);
      console.log('[AuthModal] verifyOtp result:', { data, error });
      
      if (error) throw error;
      
      if (!data.session) {
        setErrorMsg('Verification succeeded but no session was returned. Please try again.');
        return;
      }

      // 显式更新 auth store，不依赖 onAuthStateChange 监听
      console.log('[AuthModal] Login success! User:', data.session.user.id);
      useAuthStore.setState({
        user: data.session.user,
        isLoggedIn: true,
        showAuthModal: false,
      });
      resetForm();
    } catch (e: any) {
      console.error('[AuthModal] verifyOtp error:', e);
      setErrorMsg(e.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode('main');
    setInputValue('');
    setVerifyCode('');
    setCodeSent(false);
    setErrorMsg('');
    setShowCountrySelect(false);
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
                  disabled={true}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black text-white font-bold text-sm transition-all hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black disabled:active:scale-100"
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
                  disabled={true}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm border border-zinc-200 dark:border-zinc-700 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-zinc-800 disabled:active:scale-100"
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
                  disabled={true}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-100 dark:disabled:hover:bg-zinc-800 disabled:active:scale-100"
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

            {/* Country Selector View */}
            {showCountrySelect && mode === 'phone' && (
              <div className="space-y-1 max-h-[300px] overflow-y-auto -mx-2 px-2 scrollbar-hide">
                <button
                  onClick={() => setShowCountrySelect(false)}
                  className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors pb-3 pt-1 w-full text-left z-10"
                >
                  ← {t('common.back')}
                </button>
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => { setCountryCode(c.code); setShowCountrySelect(false); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{c.flag}</span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {locale === 'zh' ? c.nameZh : c.name}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-500 font-mono">{c.code}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Email / Phone verification form */}
            {(mode === 'email' || mode === 'phone') && !showCountrySelect && (
              <div className="space-y-3">
                <button
                  onClick={resetForm}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  ← {t('common.back')}
                </button>

                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
                    {errorMsg}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-emerald-500 overflow-hidden transition-all">
                    {mode === 'phone' && (
                      <button
                        type="button"
                        onClick={() => setShowCountrySelect(true)}
                        disabled={codeSent}
                        className="flex items-center gap-1.5 px-3 border-r border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60 disabled:hover:bg-transparent shrink-0"
                      >
                        <span className="text-lg leading-none">{COUNTRIES.find(c => c.code === countryCode)?.flag}</span>
                        <span className="text-sm font-medium font-mono text-zinc-600 dark:text-zinc-400">{countryCode}</span>
                        <span className="text-xs text-zinc-400 ml-1">▼</span>
                      </button>
                    )}
                    <input
                      autoFocus
                      type={mode === 'email' ? 'email' : 'tel'}
                      disabled={codeSent}
                      placeholder={mode === 'email'
                        ? (t('auth.emailPlaceholder' as Parameters<typeof t>[0]) || 'your@email.com')
                        : 'XXXX-XXXX'
                      }
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full bg-transparent px-3 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={handleSendCode}
                    disabled={!inputValue.trim() || sendingCode || countdown > 0}
                    className="px-4 py-3 rounded-xl bg-emerald-500 text-white font-bold transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 whitespace-nowrap sm:min-w-[120px]"
                  >
                    {sendingCode ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : codeSent ? (
                      t('common.retry' as Parameters<typeof t>[0]) || 'Resend'
                    ) : (
                      t('auth.sendCode' as Parameters<typeof t>[0]) || 'Send'
                    )}
                  </button>
                </div>

                {codeSent && (
                  <>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
                      ✓ {t('auth.codeSent' as Parameters<typeof t>[0]) || 'Code sent!'}
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
                      className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('auth.verifying' as Parameters<typeof t>[0]) || 'Verifying...'}
                        </span>
                      ) : (
                        t('auth.verifyAndLogin' as Parameters<typeof t>[0]) || 'Verify and Login'
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
