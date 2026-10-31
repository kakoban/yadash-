import React, { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { LogIn, Lock, Loader2, AlertCircle } from 'lucide-react';

export function Auth({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        onLogin();
      }
    });
    return () => unsubscribe();
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('پنجره ورود بسته شد. لطفاً دوباره تلاش کنید.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError(
          `دامنه فعلی (${window.location.hostname}) هنوز در لیست دامنه‌های مجاز Firebase ثبت نشده است. لطفاً آن را در بخش Authentication > Settings > Authorized domains در کنسول Firebase اضافه کنید.`
        );
      } else {
        setError(err?.message || 'خطایی هنگام ورود به حساب رخ داد.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-[var(--ink)] p-6" dir="rtl">
      <div className="w-full max-w-md stitched-spine bg-[var(--paper-2)] border border-[var(--line)] p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative corner accents */}
        <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-[var(--ink-soft)] opacity-30"></div>
        <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-[var(--ink-soft)] opacity-30"></div>
        <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-[var(--ink-soft)] opacity-30"></div>
        <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-[var(--ink-soft)] opacity-30"></div>

        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--paper)] border-2 border-[var(--line-strong)] flex items-center justify-center text-[var(--sage-dark)] shadow-sm">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-2">روزنوشت</h1>
          <p className="text-[var(--ink-soft)] text-sm text-center leading-relaxed">
            فضای شخصی و امن ابری برای یادداشت‌ها و افکار روزانه شما
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-[var(--ink)] hover:bg-[var(--ink-dark)] text-[var(--paper)] rounded-xl py-3.5 px-4 font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-md"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <span>ورود یا ثبت‌نام با حساب گوگل</span>
                <LogIn size={18} />
              </>
            )}
          </button>

          <p className="text-xs text-center text-[var(--ink-soft)] leading-relaxed mt-2">
            با ورود به حساب گوگل، تمام یادداشت‌های شما به‌صورت خصوصی و تفکیک‌شده برای اکانت شما همگام‌سازی می‌شوند.
          </p>
        </div>
      </div>
    </div>
  );
}
