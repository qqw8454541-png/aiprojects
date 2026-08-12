'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/lib/toast-store';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none px-4 gap-2 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg pointer-events-auto max-w-sm w-full ${
                isError 
                  ? 'bg-red-50 text-red-900 dark:bg-red-950/80 dark:text-red-200 border border-red-200 dark:border-red-900/50' 
                  : isSuccess
                  ? 'bg-green-50 text-green-900 dark:bg-green-950/80 dark:text-green-200 border border-green-200 dark:border-green-900/50'
                  : 'bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
              } backdrop-blur-md`}
            >
              <div className="shrink-0">
                {isError ? (
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                ) : (
                  <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 text-sm font-medium">
                {toast.message}
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 -mr-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 opacity-50" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
