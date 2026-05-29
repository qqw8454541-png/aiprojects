'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, isPro } = useAuthStore();
  const setPage = useGameStore((s) => s.setPage);
  
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 初始化数据
  useEffect(() => {
    if (user) {
      const currentName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      setName(currentName);
    } else {
      // 若未登录，直接返回
      setPage('landing');
    }
  }, [user, setPage]);

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    // 基础校验
    if (!name.trim()) {
      setErrorMsg(t('profile.nameRequired' as any) || 'Name cannot be empty.');
      return;
    }
    
    // 强制网络链接检查（简单的前端判断）
    if (!navigator.onLine) {
      setErrorMsg(t('profile.offlineError' as any) || 'Network connection is required to update profile.');
      return;
    }

    setIsSaving(true);
    try {
      // 直接调用 supabase auth api 更新元数据
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() }
      });

      if (error) throw error;
      
      setSuccessMsg(t('profile.saveSuccess' as any) || 'Profile updated successfully!');
      
      // 更新 auth store 以反映最新的 user
      if (data.user) {
        useAuthStore.setState({ user: data.user });
      }

      // 可选：几秒后清除成功信息
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Update profile error:', err);
      setErrorMsg(err.message || t('profile.saveError' as any) || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh pt-24 px-5 page-enter pb-10">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* 头像与概览区 */}
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-4xl shadow-lg mb-4">
            {(name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 text-center">
            {name || 'User'}
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center mt-1">
            {user?.email || user?.phone || 'No contact info'}
          </div>
          
          {isPro && (
            <div className="absolute top-4 right-4 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
              ⭐ PRO
            </div>
          )}
        </div>

        {/* 表单区域 */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
              {t('profile.displayName' as any) || 'Display Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.namePlaceholder' as any) || 'Enter your name'}
              className="w-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors shadow-sm text-base"
            />
          </div>
          
          {/* Email 展示（只读） */}
          <div className="space-y-1.5 opacity-70">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
              {t('profile.email' as any) || 'Email / Phone'}
            </label>
            <input
              type="text"
              value={user?.email || user?.phone || ''}
              readOnly
              disabled
              className="w-full bg-zinc-100 dark:bg-zinc-800/50 border-2 border-transparent rounded-2xl px-4 py-3.5 text-zinc-500 dark:text-zinc-400 outline-none cursor-not-allowed text-base"
            />
            <p className="text-xs text-zinc-500 ml-1">
              {t('profile.emailReadonlyDesc' as any) || 'Contact support to change your login method.'}
            </p>
          </div>
        </div>

        {/* 状态提示区 */}
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm border border-red-100 dark:border-red-900/50 flex items-start gap-2">
            <span className="text-base mt-0.5">⚠️</span>
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-sm border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-2">
            <span className="text-base mt-0.5">✅</span>
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* 底部操作区 */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-2 transition-all
              ${isSaving 
                ? 'bg-emerald-400 dark:bg-emerald-600 cursor-not-allowed opacity-80' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] shadow-emerald-900/20 cursor-pointer'
              }
            `}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('profile.saving' as any) || 'Saving...'}
              </>
            ) : (
              <>
                <span>💾</span> {t('profile.saveBtn' as any) || 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
