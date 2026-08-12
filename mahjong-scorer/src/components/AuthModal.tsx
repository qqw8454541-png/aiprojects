'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const COUNTRIES = [
  { code: '+81', flag: '🇯🇵', tKey: 'auth.country.jp' },
  { code: '+86', flag: '🇨🇳', tKey: 'auth.country.cn' },
  { code: '+886', flag: '🇹🇼', tKey: 'auth.country.tw' },
  { code: '+852', flag: '🇭🇰', tKey: 'auth.country.hk' },
  { code: '+1', flag: '🇺🇸', tKey: 'auth.country.us' },
  { code: '+82', flag: '🇰🇷', tKey: 'auth.country.kr' },
  { code: '+65', flag: '🇸🇬', tKey: 'auth.country.sg' },
  { code: '+60', flag: '🇲🇾', tKey: 'auth.country.my' },
  { code: '+44', flag: '🇬🇧', tKey: 'auth.country.uk' },
  { code: '+61', flag: '🇦🇺', tKey: 'auth.country.au' },
] as const;

export default function AuthModal() {
  const { t, locale } = useI18n();
  const { showAuthModal, authModalContext, closeAuthModal, login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [inputValue, setInputValue] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [countryCode, setCountryCode] = useState('+81');
  const [showCountrySelect, setShowCountrySelect] = useState(false);
  const [showTermsConsent, setShowTermsConsent] = useState(false);

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

  const handleSendCodeRequest = () => {
    if (!inputValue.trim()) return;
    setErrorMsg('');
    setShowTermsConsent(true);
  };

  const handleSendCode = async () => {
    setShowTermsConsent(false);
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
    setMode('email');
    setInputValue('');
    setVerifyCode('');
    setCodeSent(false);
    setErrorMsg('');
    setShowCountrySelect(false);
    setShowTermsConsent(false);
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
              {t('auth.title' as Parameters<typeof t>[0])}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
              {getContextMessage()}
            </p>
          </div>

          {/* Body */}
          <div className="px-5 pb-5 space-y-3">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl mb-4 max-w-sm w-full mx-auto shadow-inner">
              <button
                onClick={() => { setMode('email'); setErrorMsg(''); setShowCountrySelect(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                  mode === 'email'
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                📧 {t('auth.tabEmail' as any)}
              </button>
              <button
                onClick={() => { setMode('phone'); setErrorMsg(''); setShowCountrySelect(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                  mode === 'phone'
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                📱 {t('auth.tabPhone' as any)}
              </button>
            </div>

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
                        {t(c.tKey as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-500 font-mono">{c.code}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Email / Phone verification form */}
            {!showCountrySelect && (
              <div className="space-y-3">


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
                        ? (t('auth.emailPlaceholder' as Parameters<typeof t>[0]))
                        : 'XXXX-XXXX'
                      }
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full bg-transparent px-3 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={handleSendCodeRequest}
                    disabled={!inputValue.trim() || sendingCode || countdown > 0}
                    className="px-4 py-3 rounded-xl bg-emerald-500 text-white font-bold transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 whitespace-nowrap sm:min-w-[120px]"
                  >
                    {sendingCode ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : codeSent ? (
                      t('common.retry' as Parameters<typeof t>[0])
                    ) : (
                      t('auth.sendCode' as Parameters<typeof t>[0])
                    )}
                  </button>
                </div>

                {codeSent && (
                  <>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
                      ✓ {t('auth.codeSent' as Parameters<typeof t>[0])}
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
                          {t('auth.verifying' as Parameters<typeof t>[0])}
                        </span>
                      ) : (
                        t('auth.verifyAndLogin' as Parameters<typeof t>[0])
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1.5">
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 text-center leading-relaxed">
                {t('auth.terms' as Parameters<typeof t>[0])}
              </p>
              <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <a href="https://mahjong-scorer.eastree.co.jp/terms.html" target="_blank" rel="noreferrer" className="hover:text-emerald-500 transition-colors underline underline-offset-2">
                  {t('auth.termsTitle' as any)}
                </a>
                <a href="https://mahjong-scorer.eastree.co.jp/privacy.html" target="_blank" rel="noreferrer" className="hover:text-emerald-500 transition-colors underline underline-offset-2">
                  {t('auth.privacyTitle' as any)}
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Terms Consent Popup */}
        <AnimatePresence>
          {showTermsConsent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] glass-overlay flex items-center justify-center p-4"
              onClick={() => setShowTermsConsent(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-[320px] overflow-hidden shadow-2xl p-6 text-center"
              >
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  📄
                </div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-2">
                  {t('auth.termsConsentTitle' as any)}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  {t('auth.termsConsentBody' as any)}
                </p>
                
                <div className="space-y-2.5">
                  <button
                    onClick={handleSendCode}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold transition-all"
                  >
                    {t('auth.termsConsentAgree' as any)}
                  </button>
                  <button
                    onClick={() => setShowTermsConsent(false)}
                    className="w-full py-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    {t('auth.termsConsentCancel' as any)}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
