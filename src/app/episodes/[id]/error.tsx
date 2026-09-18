'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Episode page failed:', error.digest || 'no error digest');
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-200 dark:border-red-900">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">發生了未預期的錯誤！</h2>
        <p className="text-zinc-700 dark:text-zinc-300 mb-6">
          頁面暫時無法顯示，請稍後再試。若問題持續發生，請將下方錯誤編號提供給管理者。
        </p>
        {error.digest && (
          <p className="bg-zinc-100 dark:bg-black p-4 rounded-lg mb-6 text-sm text-zinc-600 dark:text-zinc-400 break-all">
            錯誤編號：{error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="w-full bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-brand-ink py-3 rounded-xl font-bold hover:bg-brand-ochre transition-colors"
        >
          嘗試重新載入
        </button>
      </div>
    </div>
  );
}
