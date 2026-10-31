import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Upload,
  Download,
  Sun,
  Moon,
  FileText,
  Brain,
  Lightbulb,
  Quote,
  ListTodo,
  Link as LinkIcon,
  Code as CodeIcon,
  AlertTriangle,
  Database,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Tag,
  Info,
  Menu,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  User
} from 'lucide-react';

import { Entry, TypeInfo } from './types';
import { createClient } from '@supabase/supabase-js';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  testConnection,
  fetchAllEntries,
  insertEntry,
  updateEntry,
  deleteEntry
} from './lib/firebase';

const TYPES: TypeInfo[] = [
  { key: 'note', label: 'یادداشت', color: '#2563EB', icon: '✎' },
  { key: 'thought', label: 'فکر و تامل', color: '#4F46E5', icon: '◌' },
  { key: 'idea', label: 'ایده جدید', color: '#EA580C', icon: '✦' },
  { key: 'quote', label: 'نقل‌قول', color: '#7C3AED', icon: '❝' },
  { key: 'list', label: 'لیست کارها', color: '#0D9488', icon: '☰' },
  { key: 'link', label: 'لینک مفید', color: '#0284C7', icon: '⛓' },
  { key: 'code', label: 'قطعه کد', color: '#475569', icon: '⌘' },
];

const LOCAL_STORAGE_KEY = 'roozneveshte_entries_v1';
const THEME_KEY = 'roozneveshte_theme_v1';

const calculateWordOverlap = (str1: string, str2: string) => {
  const getWords = (s: string) => s.toLowerCase().split(/[\s\p{P}]+/u).filter(w => w.trim().length > 0);
  const words1 = getWords(str1);
  const words2 = getWords(str2);
  
  if (words1.length === 0 && words2.length === 0) return str1.trim() === str2.trim() ? 1 : 0;
  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  let intersectionSize = 0;
  for (const word of set1) {
    if (set2.has(word)) intersectionSize++;
  }
  
  const unionSize = set1.size + set2.size - intersectionSize;
  return intersectionSize / unionSize;
};

import { Auth } from './components/Auth';

export default function App() {
  // Application state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const [checkingDb, setCheckingDb] = useState<boolean>(true);

  // Filters and views
  const [activeType, setActiveType] = useState<string>('all');
  const [activeDay, setActiveDay] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Calendar states
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());

  // Composer fields
  const [composerType, setComposerType] = useState<Entry['type']>('note');
  const [entryTitle, setEntryTitle] = useState<string>('');
  const [entryBody, setEntryBody] = useState<string>('');
  const [entryTags, setEntryTags] = useState<string>('');

  // Editing and expansion
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editBody, setEditBody] = useState<string>('');
  const [editTags, setEditTags] = useState<string>('');

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // File input ref for importing JSON
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast status
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<any>(null);

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Legacy / Supabase Recovery Modal State
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false);
  const [supaEmail, setSupaEmail] = useState<string>('sfcbgdfgsdfsdfvfgssdfsdgvfdg@gmail.com');
  const [supaPassword, setSupaPassword] = useState<string>('');
  const [supaUrl, setSupaUrl] = useState<string>('https://pybofuhhevqarmphgyhg.supabase.co');
  const [supaAnonKey, setSupaAnonKey] = useState<string>(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ym9mdWhoZXZxYXJtcGhneWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDU5OTQsImV4cCI6MjA5ODAyMTk5NH0.HJQ2w3bH2VqyWTU74sCVeNPyszSfLeIbYsEVZPcWiJ0'
  );
  const [supaLoading, setSupaLoading] = useState<boolean>(false);
  const [supaStatusMsg, setSupaStatusMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  // AI Categorization State
  const [isCategorizing, setIsCategorizing] = useState<boolean>(false);
  
  // 360 Scan (Clipboard Monitor) State
  const [is360ScanEnabled, setIs360ScanEnabled] = useState<boolean>(() => {
    return localStorage.getItem('roozneveshte_360_v1') === 'true';
  });
  const lastScannedTextRef = useRef<string | null>(null);


  // Helper: trigger a pretty auto-hiding toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    const id = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
    setToastTimeoutId(id);
  };

  // Helper to collect any notes saved in older localStorage keys (e.g. before Firebase migration)
  const getLegacyLocalEntries = (currentUid: string): Entry[] => {
    const collected = new Map<string, Entry>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key === LOCAL_STORAGE_KEY ||
          (key.startsWith('roozneveshte_entries_') && key !== `roozneveshte_entries_${currentUid}`)
        ) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item && item.id && item.body) {
                collected.set(String(item.id), {
                  id: String(item.id),
                  type: item.type || 'note',
                  title: item.title || '',
                  body: String(item.body),
                  tags: Array.isArray(item.tags) ? item.tags : [],
                  createdAt: Number(item.createdAt || item.created_at) || Date.now(),
                  pinned: Boolean(item.pinned),
                });
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('Error scanning legacy localStorage keys', e);
    }
    return Array.from(collected.values());
  };

  // Recover legacy entries on demand or automatically on first migration
  const handleRecoverLegacyEntries = async () => {
    if (!user) return;
    const legacy = getLegacyLocalEntries(user.uid);
    if (legacy.length === 0) {
      setSupaStatusMsg({
        type: 'info',
        text: 'در حافظه این مرورگر و این آدرس اینترنتی نوشته قدیمی‌تری پیدا نشد. اگر قبلاً روی آدرس قبلی سایت (مخزن roozshomar) نوشته بودید، همان آدرس قبلی را باز کنید یا از بخش بالای همین پنجره از دیتابیس Supabase بازیابی کنید.'
      });
      triggerToast('نوشته قدیمی‌تری در حافظه این مرورگر پیدا نشد');
      return;
    }

    const existingIds = new Set(entries.map((x) => x.id));
    const toRestore = legacy.filter((item) => !existingIds.has(item.id));

    if (toRestore.length === 0) {
      setSupaStatusMsg({
        type: 'success',
        text: `تعداد ${legacy.length} نوشته در مرورگر یافت شد که همگی در لیست فعلی شما موجود هستند.`
      });
      triggerToast('تمام نوشته‌های قبلی مرورگر هم‌اکنون در لیست شما موجود هستند');
      return;
    }

    const merged = [...entries, ...toRestore].sort((a, b) => b.createdAt - a.createdAt);
    setEntries(merged);
    localStorage.setItem(`roozneveshte_entries_${user.uid}`, JSON.stringify(merged));

    let uploaded = 0;
    for (const item of toRestore) {
      const { error } = await insertEntry(item);
      if (!error) uploaded++;
    }

    setSupaStatusMsg({
      type: 'success',
      text: `${toRestore.length} نوشته قبلی از حافظه مرورگر بازیابی و در حساب Firebase شما ذخیره شد!`
    });
    triggerToast(`${toRestore.length} نوشته قبلی بازیابی و در حساب ابری شما ذخیره شد`);
  };

  // Connect directly to old Supabase project and migrate entries into Firebase
  const handleMigrateFromSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSupaLoading(true);
    setSupaStatusMsg(null);

    try {
      const cleanUrl = supaUrl.trim().replace(/\/+$/, '');
      const cleanKey = supaAnonKey.trim();
      const tempSupabase = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      if (supaEmail.trim() && supaPassword) {
        const { error: authErr } = await tempSupabase.auth.signInWithPassword({
          email: supaEmail.trim(),
          password: supaPassword,
        });
        if (authErr) {
          if (authErr.message?.includes('Failed to fetch') || authErr.message?.includes('Load failed')) {
            setSupaStatusMsg({
              type: 'error',
              text: 'خطای اتصال به Supabase (Failed to fetch): پروژه رایگان شما در سایت Supabase در حالت Paused (خوابیده) است. ابتدا روی دکمه «باز کردن پنل Supabase» در بالا کلیک کنید، دکمه Restore project را بزنید، ۲ دقیقه صبر کنید و دوباره تلاش کنید.'
            });
            setSupaLoading(false);
            return;
          }
          setSupaStatusMsg({
            type: 'error',
            text: `خطای ورود به Supabase: ${authErr.message}`
          });
          setSupaLoading(false);
          return;
        }
      }

      const { data: rows, error: fetchErr } = await tempSupabase
        .from('roozneveshte_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        if (fetchErr.message?.includes('Failed to fetch') || fetchErr.message?.includes('Load failed')) {
          setSupaStatusMsg({
            type: 'error',
            text: 'پروژه Supabase شما (pybofuhhevqarmphgyhg) در حال حاضر در حالت Paused (خوابیده) است. لطفاً وارد داشبورد Supabase شوید و دکمه Restore project را بزنید.'
          });
        } else {
          setSupaStatusMsg({
            type: 'error',
            text: `خطا در دریافت اطلاعات از Supabase: ${fetchErr.message}`
          });
        }
        setSupaLoading(false);
        return;
      }

      if (!rows || rows.length === 0) {
        setSupaStatusMsg({
          type: 'info',
          text: 'اتصال به Supabase برقرار شد اما هیچ نوشته‌ای برای این اکانت در جدول roozneveshte_entries یافت نشد (مطمئن شوید ایمیل و رمز عبور اکانت قبلی را وارد کرده‌اید).'
        });
        setSupaLoading(false);
        return;
      }

      const mappedSupabaseEntries: Entry[] = rows.map((row: any) => ({
        id: String(row.id),
        type: row.type || 'note',
        title: row.title || '',
        body: String(row.body || ''),
        tags: Array.isArray(row.tags) ? row.tags : [],
        createdAt: Number(row.created_at) || Date.now(),
        pinned: Boolean(row.pinned),
      }));

      const existingIds = new Set(entries.map((x) => x.id));
      const newOnes = mappedSupabaseEntries.filter((item) => item.body && !existingIds.has(item.id));

      const merged = [...entries, ...newOnes].sort((a, b) => b.createdAt - a.createdAt);
      setEntries(merged);
      localStorage.setItem(`roozneveshte_entries_${user.uid}`, JSON.stringify(merged));

      let syncedCount = 0;
      for (const item of newOnes) {
        const { error: insErr } = await insertEntry(item);
        if (!insErr) syncedCount++;
      }

      setSupaStatusMsg({
        type: 'success',
        text: `عالی! کل ${mappedSupabaseEntries.length} نوشته از Supabase دریافت شد و ${newOnes.length} نوشته جدید به اکانت Firebase شما منتقل گردید.`
      });
      triggerToast(`${newOnes.length} نوشته از Supabase با موفقیت منتقل شد!`);
    } catch (err: any) {
      setSupaStatusMsg({
        type: 'error',
        text: 'خطای ارتباط با سرور Supabase (پروژه شما در پنل Supabase در حالت Paused قرار دارد؛ ابتدا از داشبورد Supabase آن را Restore کنید).'
      });
    } finally {
      setSupaLoading(false);
    }
  };

  // Check Firebase Firestore connection and fetch entries
  const initDbConnection = async (silent = false, currentUser: FirebaseUser | null = null) => {
    if (!silent) setCheckingDb(true);
    
    if (!currentUser) {
       setDbConnected(false);
       setEntries([]);
       setCheckingDb(false);
       return;
    }

    const isOk = await testConnection();
    setDbConnected(isOk);

    if (isOk) {
      const { data, error } = await fetchAllEntries();
      if (!error && data) {
        // Merge with user-scoped local storage to avoid losing unsaved items
        let localEntries: Entry[] = [];
        try {
          const storageKey = `roozneveshte_entries_${currentUser.uid}`;
          const raw = localStorage.getItem(storageKey);
          if (raw) localEntries = JSON.parse(raw);
        } catch(e) {}

        // Auto-migrate legacy localStorage notes if present on this browser domain
        const migrationFlagKey = `roozneveshte_migrated_v2_${currentUser.uid}`;
        if (!localStorage.getItem(migrationFlagKey)) {
          const legacyEntries = getLegacyLocalEntries(currentUser.uid);
          if (legacyEntries.length > 0) {
            const existingLocalIds = new Set(localEntries.map(x => x.id));
            legacyEntries.forEach(item => {
              if (!existingLocalIds.has(item.id)) {
                localEntries.push(item);
              }
            });
            localStorage.setItem(migrationFlagKey, 'true');
          }
        }
        
        const merged = [...data];
        const dbIds = new Set(data.map(x => x.id));
        
        localEntries.forEach(localItem => {
          if (!dbIds.has(localItem.id)) {
            merged.push(localItem);
            insertEntry(localItem).catch(() => {});
          }
        });
        merged.sort((a, b) => b.createdAt - a.createdAt);
        setEntries(merged);
        if (!silent) triggerToast('پایگاه داده ابری همگام‌سازی شد');
      } else {
        loadFromLocalStorage(currentUser);
      }
    } else {
      loadFromLocalStorage(currentUser);
    }
    setCheckingDb(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      initDbConnection(true, currentUser);
    });

    return () => unsubscribe();
  }, []);

  const loadFromLocalStorage = (currentUser: FirebaseUser | null = null) => {
    if (!currentUser) {
      setEntries([]);
      return;
    }
    try {
      const storageKey = `roozneveshte_entries_${currentUser.uid}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setEntries(JSON.parse(raw));
      } else {
        const legacy = getLegacyLocalEntries(currentUser.uid);
        setEntries(legacy);
      }
    } catch (e) {
      console.error('Error loading from localStorage', e);
      setEntries([]);
    }
  };

  // Sync state changes to user-scoped LocalStorage as safety backup
  useEffect(() => {
    if (!user || checkingDb) return;
    const storageKey = `roozneveshte_entries_${user.uid}`;
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries, user, checkingDb]);

  const processPastedText = async (text: string) => {
    if (!text.trim()) return;

    // Check if highly similar content already exists in any of our entries (>= 80% overlap)
    const SIMILARITY_THRESHOLD = 0.8;
    const isDuplicate = entries.some(entry => {
      const similarity = calculateWordOverlap(entry.body, text);
      return similarity >= SIMILARITY_THRESHOLD;
    });
    
    if (isDuplicate) {
      triggerToast('متن تکراری یا بسیار مشابه پیدا شد و ذخیره نشد');
      return;
    }

    setIsCategorizing(true);
    triggerToast('در حال دسته‌بندی هوشمند و ذخیره...');

    let determinedCategory: Entry['type'] = 'note';
    try {
      const res = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.category) {
          determinedCategory = data.category;
        }
      }
    } catch (err) {
      console.error("AI categorization failed:", err);
      // Fallbacks if API fails
      if (text.startsWith('http')) determinedCategory = 'link';
      else if (text.includes('{') && text.includes('}')) determinedCategory = 'code';
    }

    const newEntry: Entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      type: determinedCategory,
      title: '', // Auto-generated notes have no title by default
      body: text,
      tags: [],
      createdAt: Date.now()
    };

    // Add to state
    setEntries(prev => {
      const updated = [newEntry, ...prev];
      return updated;
    });

    // Add to DB if connected
    if (dbConnected) {
      insertEntry(newEntry).then(({ error }) => {
        if (error) {
          console.error('Error inserting to Supabase:', error);
          triggerToast('ذخیره ابری با خطا مواجه شد. لطفاً راهنمای نصب جدول را بررسی کنید.');
        }
      });
    }
    
    setIsCategorizing(false);
    const typeObj = TYPES.find(t => t.key === determinedCategory);
    triggerToast(`با موفقیت در لیست «${typeObj?.label || 'یادداشت'}» ذخیره شد`);
  };

  // Global paste handler with AI Auto-Categorization
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Don't intercept if user is already typing in an input/textarea
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        await processPastedText(text);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [dbConnected, entries]);

  // 360 Scan (Clipboard Monitor) Effect
  useEffect(() => {
    if (!is360ScanEnabled) return;

    const checkClipboard = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim() !== '' && text !== lastScannedTextRef.current) {
             lastScannedTextRef.current = text;
             await processPastedText(text);
          }
        }
      } catch (err) {
        // usually happens if permission is denied or document lacks focus
        console.warn("360 Scan clipboard read warning:", err);
      }
    };

    // Listen when window gains focus
    window.addEventListener('focus', checkClipboard);
    
    // Also poll every 5 seconds as a fallback
    const intervalId = setInterval(checkClipboard, 5000);

    return () => {
      window.removeEventListener('focus', checkClipboard);
      clearInterval(intervalId);
    };
  }, [is360ScanEnabled, dbConnected, entries]);

  // Load initial settings and trigger database test
  useEffect(() => {
    // Determine initial theme
    const storedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    const initialTheme = storedTheme || 'light';
    setTheme(initialTheme);
    document.body.setAttribute('data-theme', initialTheme);
  }, []);

  // Handle Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
    document.body.setAttribute('data-theme', nextTheme);
    triggerToast(nextTheme === 'light' ? 'پوسته روشن فعال شد' : 'پوسته تاریک فعال شد');
  };

  // Format Date helpers using Persian locale
  const getPersianDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(timestamp));
  };

  const getPersianTime = (timestamp: number) => {
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const getDayListLabel = (dateKey: string) => {
    const d = new Date(dateKey);
    return new Intl.DateTimeFormat('fa-IR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  };

  const todayLabel = useMemo(() => {
    return getPersianDate(Date.now());
  }, []);

  // Extract unique day keys (YYYY-MM-DD) formatted descending
  const dayKeysSorted = useMemo(() => {
    const keys = entries.map(e => {
      const d = new Date(e.createdAt);
      return d.toISOString().slice(0, 10);
    });
    return (Array.from(new Set(keys)) as string[]).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  // Set of dates with entries in YYYY-MM-DD format
  const datesWithEntries = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      const d = new Date(e.createdAt);
      set.add(d.toISOString().slice(0, 10));
    });
    return set;
  }, [entries]);

  const todayDateStr = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const getCalendarHeaderLabel = (year: number, month: number) => {
    const d = new Date(year, month, 1);
    return new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(d);
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  const handleDateClick = (dateStr: string) => {
    if (activeDay === dateStr) {
      setActiveDay('all');
    } else {
      setActiveDay(dateStr);
    }
  };

  // Generate calendar cells
  const { blanks, daysInMonth } = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const gFirstDayOfWeek = firstDay.getDay(); 
    // Convert Sunday-first to Saturday-first: Sunday is index 1, Saturday is index 0
    const firstDayIndex = (gFirstDayOfWeek + 1) % 7;
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    
    return {
      blanks: Array(firstDayIndex).fill(null),
      daysInMonth: Array.from({ length: totalDays }, (_, i) => i + 1)
    };
  }, [calendarYear, calendarMonth]);

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter(e => activeType === 'all' || e.type === activeType)
      .filter(e => {
        if (activeDay === 'all') return true;
        const d = new Date(e.createdAt);
        return d.toISOString().slice(0, 10) === activeDay;
      })
      .filter(e => {
        if (!searchTerm.trim()) return true;
        const normSearch = searchTerm.toLowerCase();
        const tagsString = (e.tags || []).join(' ');
        return (
          (e.title || '').toLowerCase().includes(normSearch) ||
          e.body.toLowerCase().includes(normSearch) ||
          tagsString.toLowerCase().includes(normSearch)
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
      });
  }, [entries, activeType, activeDay, searchTerm]);

  // Active label for current list filter
  const listLabelText = useMemo(() => {
    if (searchTerm.trim()) {
      return `نتایج جست‌وجو برای «${searchTerm}»`;
    }
    let label = 'همهٔ نوشته‌ها';
    if (activeDay !== 'all') {
      label = getDayListLabel(activeDay);
    }
    if (activeType !== 'all') {
      const typeObj = TYPES.find(t => t.key === activeType);
      label += ` · دستهٔ ${typeObj ? typeObj.label : ''}`;
    }
    return label;
  }, [activeType, activeDay, searchTerm]);

  // Handle adding an entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const bodyText = entryBody.trim();
    if (!bodyText) {
      triggerToast('متن نوشته نمی‌تواند خالی باشد');
      return;
    }

    // Parse tags: splitting by English or Persian comma
    const parsedTags = entryTags
      .split(/[،,]/)
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const newEntry: Entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      type: composerType,
      title: entryTitle.trim(),
      body: bodyText,
      tags: parsedTags,
      createdAt: Date.now()
    };

    // Optimistic UI updates
    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);

    // Reset fields
    setEntryTitle('');
    setEntryBody('');
    setEntryTags('');
    setComposerType('note');
    setActiveDay('all');
    setActiveType('all');

    if (dbConnected) {
      const { error } = await insertEntry(newEntry);
      if (error) {
        console.error('Error inserting to Supabase:', error);
        triggerToast('ذخیره محلی انجام شد (خطای همگام‌سازی). لطفاً اسکریپت بروزرسانی را از راهنمای جدول اجرا کنید.');
      } else {
        triggerToast('نوشته با موفقیت در پایگاه داده ثبت شد');
      }
    } else {
      triggerToast('نوشته به‌طور محلی ذخیره شد');
    }
  };

  // Delete an entry
  const handleDeleteEntry = async (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    setDeleteConfirmId(null);

    if (dbConnected) {
      const { error } = await deleteEntry(id);
      if (error) {
        console.error('Error deleting from Supabase:', error);
        triggerToast('حذف شد (خطای همگام‌سازی سرور)');
      } else {
        triggerToast('نوشته با موفقیت از پایگاه داده حذف شد');
      }
    } else {
      triggerToast('نوشته با موفقیت حذف شد');
    }
  };

  // Start editing mode
  const startEditMode = (entry: Entry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title || '');
    setEditBody(entry.body);
    setEditTags((entry.tags || []).join(', '));
  };

  // Save changes from editing
  const handleUpdateEntry = async (id: string) => {
    const bodyText = editBody.trim();
    if (!bodyText) {
      triggerToast('متن نوشته نمی‌تواند خالی باشد');
      return;
    }

    const parsedTags = editTags
      .split(/[،,]/)
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const originalEntry = entries.find(e => e.id === id);
    if (!originalEntry) return;

    const updatedEntry: Entry = {
      ...originalEntry,
      title: editTitle.trim(),
      body: bodyText,
      tags: parsedTags
    };

    const updatedEntries = entries.map(e => (e.id === id ? updatedEntry : e));
    setEntries(updatedEntries);
    setEditingId(null);

    if (dbConnected) {
      const { error } = await updateEntry(updatedEntry);
      if (error) {
        console.error('Error updating in Supabase:', error);
        triggerToast('تغییرات ذخیره شد (خطای همگام‌سازی سرور)');
      } else {
        triggerToast('تغییرات با موفقیت در پایگاه داده اعمال شد');
      }
    } else {
      triggerToast('تغییرات به‌طور محلی ذخیره شد');
    }
  };

  // Toggle card expansion
  const toggleCardExpansion = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  // Toggle pinned status
  const handleTogglePin = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const updatedEntry: Entry = {
      ...entry,
      pinned: !entry.pinned
    };

    const updatedEntries = entries.map(e => (e.id === id ? updatedEntry : e));
    setEntries(updatedEntries);

    if (dbConnected) {
      const { error } = await updateEntry(updatedEntry);
      if (error) {
        console.error('Error updating pin in Supabase:', error);
      }
    }
  };

  // Export entries as JSON
  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `roozneveshte-export-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast('فایل پشتیبان بارگیری شد');
    } catch (e) {
      triggerToast('خطا در صدور فایل پشتیبان');
    }
  };

  // Import entries from JSON file
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedData)) {
          // Merge avoiding duplicate IDs
          const existingIds = new Set(entries.map(x => x.id));
          const toAdd = importedData.filter((x: any) => x && x.id && !existingIds.has(x.id));

          if (toAdd.length === 0) {
            triggerToast('تمام نوشته‌های فایل تکراری هستند یا قالب نادرست است');
            return;
          }

          // Format clean Entry objects
          const cleanAdded: Entry[] = toAdd.map((item: any) => ({
            id: item.id,
            type: item.type || 'note',
            title: item.title || '',
            body: item.body || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            createdAt: Number(item.createdAt) || Date.now()
          }));

          const merged = [...entries, ...cleanAdded].sort((a, b) => b.createdAt - a.createdAt);
          setEntries(merged);

          if (dbConnected) {
            // Try to upload imported data to Supabase
            let successCount = 0;
            for (const item of cleanAdded) {
              const { error } = await insertEntry(item);
              if (!error) successCount++;
            }
            triggerToast(`${successCount} نوشته جدید با موفقیت همگام‌سازی و وارد شد`);
          } else {
            triggerToast(`${cleanAdded.length} نوشته به‌صورت محلی وارد شد`);
          }
        } else {
          triggerToast('قالب فایل نامعتبر است (آرایه معتبر پیدا نشد)');
        }
      } catch (err) {
        triggerToast('خطا در خواندن فایل پشتیبان');
      }
    };
    reader.readAsText(file);
    // Reset file input value to allow re-importing the same file
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Get matching Lucide icon for each type
  const getTypeIconComponent = (key: Entry['type'], size = 18) => {
    switch (key) {
      case 'note': return <FileText size={size} />;
      case 'thought': return <Brain size={size} />;
      case 'idea': return <Lightbulb size={size} />;
      case 'quote': return <Quote size={size} />;
      case 'list': return <ListTodo size={size} />;
      case 'link': return <LinkIcon size={size} />;
      case 'code': return <CodeIcon size={size} />;
      default: return <FileText size={size} />;
    }
  };

  // Make link urls clickable
  const linkifyText = (text: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlPattern);
    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--teal)] underline hover:opacity-85 break-all font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-[var(--ink-soft)] text-sm" dir="rtl">
        در حال بارگذاری...
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={() => {}} />;
  }

  return (
    <div className="app min-h-screen relative flex bg-[var(--paper)] text-[var(--ink)] overflow-hidden">
      
      {/* ---------- Floating Sidebar Overlay (Mobile) ---------- */}
      <AnimatePresence>
        {isSidebarOpen && !focusedEntryId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ---------- Sidebar Component ---------- */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && !focusedEntryId && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="sidebar fixed right-0 top-0 h-full w-[280px] md:w-[300px] stitched-spine bg-[var(--paper-2)] border-l border-[var(--line)] p-6 flex flex-col gap-6 z-50 shadow-2xl overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute top-4 left-4 p-2 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper)] rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
            
            {/* Brand details */}
            <div className="brand flex flex-col gap-1 pr-2">
          <div className="flex items-center gap-2">
            <BookOpen className="text-[var(--sage-dark)] dark:text-[var(--sage)]" size={26} />
            <h1 className="text-2xl font-extrabold tracking-tight select-none">روزنوشت</h1>
          </div>
          <span className="text-xs text-[var(--ink-soft)] font-medium leading-relaxed">
            دفترچهٔ یادداشت‌های موضوعی روزانه
          </span>
        </div>

        {/* Logged-in Account Info Card */}
        <div className="bg-[var(--paper)] rounded-xl p-3 border border-[var(--line)] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-[var(--line-strong)] shrink-0 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--paper-2)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--sage-dark)] shrink-0">
                <User size={15} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[var(--ink)] truncate">
                {user.displayName || 'کاربر روزنوشت'}
              </span>
              <span className="text-[11px] text-[var(--ink-soft)] truncate text-left" dir="ltr">
                {user.email}
              </span>
            </div>
          </div>
          <button
            onClick={() => initDbConnection(false, user)}
            disabled={checkingDb}
            title="همگام‌سازی مجدد"
            className="p-1.5 hover:bg-[var(--paper-2)] rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw size={13} className={`text-[var(--ink-soft)] ${checkingDb ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Realtime Search Box */}
        <div className="search-box relative">
          <input
            type="text"
            placeholder="جست‌وجو در نوشته‌ها..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-10 py-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-sm focus:border-[var(--sage)] focus:outline-none transition-colors"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" size={16} />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 360 Scan Feature Toggle */}
        <div className="bg-[var(--paper)] rounded-xl p-3 border border-[var(--line)] shadow-[0_2px_10px_rgba(0,0,0,0.015)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className={`w-8 h-4 flex items-center rounded-full p-1 cursor-pointer transition-colors ${is360ScanEnabled ? 'bg-[var(--sage)]' : 'bg-[var(--line-strong)]'}`} onClick={() => {
                  const newVal = !is360ScanEnabled;
                  setIs360ScanEnabled(newVal);
                  localStorage.setItem('roozneveshte_360_v1', newVal.toString());
                }}>
                   <motion.div layout className="bg-white w-2.5 h-2.5 rounded-full shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{ marginLeft: is360ScanEnabled ? '0' : 'auto', marginRight: is360ScanEnabled ? 'auto' : '0' }} />
                </div>
                <span className="text-xs font-bold text-[var(--ink)] tracking-tight">اسکن ۳۶۰</span>
             </div>
             <span className="text-[10px] text-[var(--ink-soft)] font-medium bg-[var(--paper-2)] px-1.5 py-0.5 rounded-md border border-[var(--line)]">ویژهٔ اپ دسکتاپ</span>
          </div>
          <p className="text-[10px] text-[var(--ink-soft)] leading-relaxed font-medium">
            با فعالسازی این گزینه در اپلیکیشن الکترون، تمام متونی که در سیستم‌عامل (هر صفحه‌ای) کپی می‌کنید، به‌صورت خودکار جذب و دسته‌بندی می‌شود. (در نسخه وب تنها هنگام فوکوس روی پنجره کار می‌کند)
          </p>
        </div>

        {/* Categorical Filtering Rows */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-[var(--ink-soft)] font-bold">دسته‌بندی‌ها</span>
          <div className="filter-row flex flex-wrap gap-1.5">
            <button
              onClick={() => { setActiveType('all'); setActiveDay('all'); }}
              className={`chip text-[12px] px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                activeType === 'all'
                  ? 'bg-[var(--sage)] border-[var(--sage)] text-white font-bold'
                  : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--line-strong)]'
              }`}
            >
              همه نوشته‌ها
            </button>
            {TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveType(activeType === t.key ? 'all' : t.key); }}
                className={`chip text-[11.5px] px-2.5 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                  activeType === t.key
                    ? 'font-bold text-white shadow-sm'
                    : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--line-strong)]'
                }`}
                style={activeType === t.key ? { backgroundColor: t.color, borderColor: t.color } : {}}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mini Calendar Component */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-[var(--ink-soft)] font-bold">تقویم روزنوشت‌ها</span>
          <div className="bg-[var(--paper)] rounded-xl p-3 border border-[var(--line)] shadow-[0_2px_10px_rgba(0,0,0,0.015)] flex flex-col gap-2.5">
            {/* Month & Year header with Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-[var(--paper-2)] rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                title="ماه قبل"
              >
                <ChevronRight size={15} />
              </button>
              
              <span className="text-xs font-bold select-none text-[var(--ink)]">
                {getCalendarHeaderLabel(calendarYear, calendarMonth)}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-[var(--paper-2)] rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                title="ماه بعد"
              >
                <ChevronLeft size={15} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--ink-soft)]">
              {/* Day names */}
              {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day, i) => (
                <div key={i} className="font-semibold py-1">
                  {day}
                </div>
              ))}

              {/* Empty cells */}
              {blanks.map((_, i) => (
                <div key={`blank-${i}`} className="py-1.5" />
              ))}

              {/* Day cells */}
              {daysInMonth.map(day => {
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasEntry = datesWithEntries.has(dateStr);
                const isSelected = activeDay === dateStr;
                const isToday = todayDateStr === dateStr;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(dateStr)}
                    className={`relative py-1 rounded-lg text-xs font-medium cursor-pointer transition-all flex flex-col items-center justify-center h-7 w-7 mx-auto ${
                      isSelected
                        ? 'bg-[var(--sage)] text-white font-bold shadow-sm'
                        : isToday
                        ? 'bg-[var(--paper-2)] border border-[var(--sage)] text-[var(--ink)] font-bold'
                        : 'hover:bg-[var(--paper-2)] text-[var(--ink)]'
                    }`}
                  >
                    <span>{day}</span>
                    {hasEntry && (
                      <span
                        className={`absolute bottom-1 w-1 h-1 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-[var(--clay)]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chronological List of Days */}
        <div className="flex flex-col gap-2 flex-1 min-h-[150px]">
          <span className="text-[11px] text-[var(--ink-soft)] font-bold">روزها</span>
          <div className="day-list flex-1 overflow-y-auto max-h-[220px] md:max-h-none flex flex-col gap-1 pr-1">
            {dayKeysSorted.length === 0 ? (
              <span className="text-xs text-[var(--ink-soft)] opacity-80 py-4 text-center">
                هنوز روزنوشتی ثبت نشده است.
              </span>
            ) : (
              <>
                <button
                  onClick={() => setActiveDay('all')}
                  className={`day-item flex justify-between items-center px-3 py-2 text-xs rounded-xl text-right transition-colors cursor-pointer ${
                    activeDay === 'all'
                      ? 'bg-[var(--ink)] text-[var(--paper)] font-bold'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--paper)]'
                  }`}
                >
                  <span>همهٔ روزها</span>
                  <span className="text-[10px] opacity-70 bg-[var(--line)] dark:bg-[var(--line-strong)] dark:text-[var(--paper)] text-[var(--ink)] px-1.5 py-0.5 rounded-md">
                    {entries.length}
                  </span>
                </button>

                {dayKeysSorted.map(dayKey => {
                  const dayCount = entries.filter(e => {
                    const d = new Date(e.createdAt);
                    return d.toISOString().slice(0, 10) === dayKey;
                  }).length;
                  
                  return (
                    <button
                      key={dayKey}
                      onClick={() => setActiveDay(activeDay === dayKey ? 'all' : dayKey)}
                      className={`day-item flex justify-between items-center px-3 py-2 text-xs rounded-xl text-right transition-colors cursor-pointer ${
                        activeDay === dayKey
                          ? 'bg-[var(--ink)] text-[var(--paper)] font-bold'
                          : 'text-[var(--ink-soft)] hover:bg-[var(--paper)]'
                      }`}
                    >
                      <span>{getDayListLabel(dayKey)}</span>
                      <span className="text-[10px] opacity-70 bg-[var(--line)] dark:bg-[var(--line-strong)] dark:text-[var(--paper)] text-[var(--ink)] px-1.5 py-0.5 rounded-md">
                        {dayCount}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Sidebar backups footer */}
        <div className="side-footer border-t border-[var(--line)] pt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              if (user?.email) setSupaEmail(user.email);
              setSupaStatusMsg(null);
              setIsRecoveryModalOpen(true);
            }}
            className="w-full py-2.5 px-2 text-xs border border-[var(--sage)]/50 rounded-xl bg-[var(--sage)]/15 hover:bg-[var(--sage)]/25 text-[var(--sage-dark)] dark:text-[var(--sage)] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Database size={14} />
            <span>بازیابی از Supabase / مرورگر</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 py-2 px-1 text-xs border border-[var(--line)] rounded-xl bg-[var(--paper)] hover:bg-[var(--paper-2)] hover:border-[var(--line-strong)] text-[var(--ink-soft)] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>بارگیری پشتیبان</span>
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-1 text-xs border border-[var(--line)] rounded-xl bg-[var(--paper)] hover:bg-[var(--paper-2)] hover:border-[var(--line-strong)] text-[var(--ink-soft)] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>بارگذاری نوشته</span>
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept="application/json"
              className="hidden"
            />
          </div>
          
          <button
            onClick={async () => {
              await signOut(auth);
            }}
            className="w-full py-2 px-1 text-xs border border-red-200 dark:border-red-900/30 rounded-xl bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>خروج از حساب کاربری</span>
          </button>
        </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ---------- Main Workspace ---------- */}
      <main 
        className={`main flex-1 flex flex-col h-screen overflow-y-auto w-full transition-all duration-300 ${isSidebarOpen && !focusedEntryId ? 'md:pr-[300px]' : 'pr-0'}`}
      >
        <div className="p-6 md:p-10 max-w-4xl mx-auto w-full flex flex-col gap-6">
        
        {!focusedEntryId ? (
          <>
            {/* Workspace Top Bar */}
            <div className="top-row flex justify-between items-center">
              <div className="flex items-center gap-3">
                {!isSidebarOpen && (
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2.5 rounded-xl bg-[var(--paper-2)] border border-[var(--line)] hover:border-[var(--line-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                    title="نمایش سایدبار"
                  >
                    <Menu size={20} />
                  </button>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--ink-soft)] font-semibold">نوشته‌های روز</span>
                  <div className="text-sm text-[var(--ink-soft)]">
                    امروز: <b className="text-[var(--ink)] font-bold">{todayLabel}</b>
                  </div>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="theme-toggle w-10 h-10 rounded-full bg-[var(--paper-2)] border border-[var(--line)] hover:border-[var(--line-strong)] text-[var(--ink-soft)] flex items-center justify-center transition-all cursor-pointer"
                title="تغییر تم رنگی"
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>

            {/* Smart Paste Global Banner */}
            <div className="bg-gradient-to-r from-[var(--sage)] to-blue-500 rounded-xl p-[1.5px]">
              <div className="bg-[var(--paper-2)] rounded-[10px] p-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-[var(--sage)] bg-[var(--sage)]/10 p-2 rounded-lg">
                    <Brain size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--ink)]">ذخیره سریع با دسته‌بندی هوشمند</span>
                    <span className="text-[11px] text-[var(--ink-soft)]">بدون نیاز به کلیک، در هر جای این صفحه متن خود را <kbd className="font-sans px-1 bg-[var(--line)] rounded">Ctrl+V</kbd> کنید.</span>
                  </div>
                </div>
                {isCategorizing && (
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--sage)] animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    در حال تحلیل و ذخیره...
                  </div>
                )}
              </div>
            </div>

            {/* Composer Form Card */}
            <div className="composer bg-[var(--paper-2)] border border-[var(--line)] rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(43,38,34,0.03)] flex flex-col gap-4">
              
              {/* Subtype selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[var(--ink-soft)] font-bold">نوع روزنوشت</span>
                <div className="composer-head flex flex-wrap gap-1.5">
                  {TYPES.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setComposerType(t.key)}
                      className={`type-pill text-[12px] px-3.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        composerType === t.key
                          ? 'font-bold shadow-sm text-white'
                          : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--line-strong)]'
                      }`}
                      style={composerType === t.key ? { backgroundColor: t.color, borderColor: t.color } : {}}
                    >
                      <span className="text-xs">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form input fields */}
              <form onSubmit={handleSaveEntry} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="عنوان نوشته (اختیاری)..."
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  className="title-in w-full bg-transparent border-b border-[var(--line)] py-1.5 font-bold text-lg focus:border-[var(--sage)] focus:outline-none transition-colors"
                />
                
                <textarea
                  id="composerBody"
                  placeholder="هرچه می‌خواهی بنویس... (از دکمه‌های کنترل+اینتر هم می‌توانی برای ذخیره سریع استفاده کنی)"
                  value={entryBody}
                  onChange={(e) => setEntryBody(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveEntry(e);
                    }
                  }}
                  rows={4}
                  className="w-full bg-transparent py-1 text-[15px] leading-relaxed resize-y focus:outline-none placeholder-[var(--ink-soft)]"
                />

                <div className="composer-foot border-t border-[var(--line)] pt-3.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Tag size={14} className="text-[var(--clay)] shrink-0" />
                    <input
                      type="text"
                      placeholder="برچسب‌ها (مثال: سپاسگزاری، ایده، برنامه‌نویسی - با ویرگول جدا کن)"
                      value={entryTags}
                      onChange={(e) => setEntryTags(e.target.value)}
                      className="tags-in flex-1 bg-transparent text-xs text-[var(--clay-dark)] focus:outline-none placeholder-[var(--ink-soft)]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setEntryBody(prev => (prev ? prev + '\n' + text : text));
                            triggerToast('متن از کلیپ‌بورد جای‌گذاری شد');
                            document.getElementById('composerBody')?.focus();
                          }
                        } catch (err) {
                          triggerToast('دسترسی به کلیپ‌بورد داده نشد');
                        }
                      }}
                      className="py-2.5 px-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      title="جای‌گذاری از کلیپ‌بورد"
                    >
                      <Copy size={16} />
                      <span>پیست</span>
                    </button>

                    <button
                      type="submit"
                      className="save-btn py-2.5 px-5 rounded-xl border border-transparent bg-[var(--sage-dark)] text-white hover:opacity-90 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-opacity"
                    >
                      <span>＋ ثبت نوشته</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Dynamic Journal Entries Header */}
            <div className="flex items-center gap-3">
              <p className="entries-label text-sm font-bold text-[var(--ink-soft)] select-none shrink-0 m-0">
                {listLabelText}
              </p>
              <div className="h-[1px] flex-1 bg-[var(--line)]"></div>
              <span className="text-xs text-[var(--ink-soft)]">
                {filteredEntries.length} نوشته
              </span>
            </div>
          </>
        ) : (
          <div className="focus-header flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <button 
              onClick={() => setFocusedEntryId(null)}
              className="flex items-center gap-2 text-sm font-bold text-[var(--sage-dark)] hover:opacity-80 transition-opacity bg-[var(--sage)]/10 px-4 py-2 rounded-xl"
            >
              <ChevronRight size={18} />
              <span>بازگشت به نوشته‌ها</span>
            </button>
            <button
              onClick={toggleTheme}
              className="theme-toggle w-10 h-10 rounded-full bg-[var(--paper-2)] border border-[var(--line)] hover:border-[var(--line-strong)] text-[var(--ink-soft)] flex items-center justify-center transition-all cursor-pointer"
              title="تغییر تم رنگی"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        )}

        {/* Journal Entries List container */}
        <div className="entries-container flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {(!focusedEntryId && filteredEntries.length === 0) ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="empty-state bg-[var(--paper-2)] border border-[var(--line)] rounded-2xl p-16 text-center text-[var(--ink-soft)] flex flex-col items-center justify-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-2xl text-[var(--ink-soft)] opacity-70">
                  ✎
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--ink)] mb-1">هیچ روزنوشتی یافت نشد</h3>
                  <p className="text-xs leading-relaxed max-w-sm">
                    {searchTerm.trim() 
                      ? 'عبارت دیگری را جست‌وجو کنید یا فیلترهای کناری را ریست کنید.'
                      : 'اولین دل‌نوشته، یادداشت یا ایده خود را در کادر بالا بنویسید یا نوشته‌های قبلی خود را از Supabase بازیابی کنید.'}
                  </p>
                </div>
                {!searchTerm.trim() && (
                  <button
                    onClick={() => {
                      if (user?.email) setSupaEmail(user.email);
                      setSupaStatusMsg(null);
                      setIsRecoveryModalOpen(true);
                    }}
                    className="mt-2 px-4 py-2.5 rounded-xl bg-[var(--sage-dark)] text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-sm"
                  >
                    <Database size={15} />
                    <span>بازیابی نوشته‌های قبلی (از Supabase یا مرورگر)</span>
                  </button>
                )}
              </motion.div>
            ) : (
              (focusedEntryId ? entries.filter(e => e.id === focusedEntryId) : filteredEntries).map(e => {
                const typeObj = TYPES.find(t => t.key === e.type) || TYPES[0];
                const isEditing = editingId === e.id;
                const isLong = e.body.length > 250 || e.body.split('\n').length > 5;
                const isExpanded = focusedEntryId || expandedIds.has(e.id);
                const isCollapsible = isLong && !isExpanded;

                return (
                  <motion.div
                    layout
                    key={e.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`group entry-card bg-[var(--paper-2)] border border-[var(--line)] border-r-[4px] rounded-2xl p-5 shadow-sm hover:shadow-[0_4px_20px_rgba(43,38,34,0.04)] transition-all relative overflow-hidden flex flex-col gap-3 ${e.pinned ? 'border-amber-200 border-r-amber-400 dark:border-amber-900/50 dark:border-r-amber-500 shadow-amber-500/5' : ''}`}
                    style={!e.pinned ? { borderRightColor: typeObj.color } : {}}
                  >
                    
                    {/* Check if we are currently editing this item */}
                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-xs font-bold text-[var(--ink-soft)] flex items-center gap-1">
                            ویرایش {typeObj.label}
                          </span>
                          <span className="text-[10px] text-[var(--ink-soft)]">{getPersianTime(e.createdAt)}</span>
                        </div>
                        
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-2 text-sm font-bold focus:border-[var(--sage)] focus:outline-none transition-colors"
                          placeholder="عنوان یادداشت..."
                        />
                        
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={4}
                          className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-2 text-sm leading-relaxed focus:border-[var(--sage)] focus:outline-none transition-colors"
                          placeholder="متن یادداشت..."
                        />
                        
                        <input
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 text-xs text-[var(--clay-dark)] focus:border-[var(--sage)] focus:outline-none transition-colors"
                          placeholder="برچسب‌ها (جداکننده ویرگول)..."
                        />

                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 border border-[var(--line)] rounded-xl text-xs font-semibold hover:bg-[var(--paper)] text-[var(--ink-soft)] cursor-pointer"
                          >
                            انصراف
                          </button>
                          <button
                            onClick={() => handleUpdateEntry(e.id)}
                            className="px-4 py-2 bg-[var(--sage-dark)] text-white rounded-xl text-xs font-semibold hover:opacity-90 cursor-pointer"
                          >
                            ذخیره تغییرات
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Regular View State
                      <>
                        <div className="entry-top flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2.5">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: typeObj.color }}
                            />
                            <span className="text-[12px] font-bold text-[var(--ink)] flex items-center gap-1">
                              {typeObj.label}
                            </span>
                            <span className="text-[10px] text-[var(--ink-soft)] font-medium bg-[var(--paper)] px-2 py-0.5 rounded border border-[var(--line)]">
                              {getPersianTime(e.createdAt)}
                            </span>
                            {e.pinned && (
                              <span className="text-amber-500" title="سنجاق‌شده">
                                <Pin size={12} fill="currentColor" />
                              </span>
                            )}
                          </div>

                          {/* Actions Panel */}
                          <div className="entry-actions flex items-center gap-0.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--paper)] rounded-lg p-0.5 border border-[var(--line)] shadow-sm">
                            
                            {/* Pin Button */}
                            <button
                              onClick={() => handleTogglePin(e.id)}
                              className={`p-1.5 rounded-md cursor-pointer transition-colors ${e.pinned ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-2)]'}`}
                              title={e.pinned ? "برداشتن سنجاق" : "سنجاق کردن"}
                            >
                              {e.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                            </button>

                            {/* Toggle card expansion if long */}
                            {isLong && !focusedEntryId && (
                              <button
                                onClick={() => toggleCardExpansion(e.id)}
                                className="p-1.5 hover:bg-[var(--paper-2)] rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
                                title={isExpanded ? 'نمایش کمتر' : 'نمایش کامل'}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}

                            {/* Focus/Maximize Button */}
                            <button
                              onClick={() => setFocusedEntryId(focusedEntryId ? null : e.id)}
                              className="p-1.5 hover:bg-[var(--paper-2)] rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                              title={focusedEntryId ? "خروج از تمرکز" : "مطالعه با تمرکز"}
                            >
                              {focusedEntryId ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>

                            {/* Copy Button */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(e.body);
                                triggerToast('متن کپی شد');
                              }}
                              className="p-1.5 hover:bg-[var(--paper-2)] rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                              title="کپی نوشته"
                            >
                              <Copy size={14} />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => startEditMode(e)}
                              className="p-1.5 hover:bg-[var(--paper-2)] rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                              title="ویرایش نوشته"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete Confirm Trigger */}
                            {deleteConfirmId === e.id ? (
                              <div className="flex items-center gap-1 px-1">
                                <button
                                  onClick={() => handleDeleteEntry(e.id)}
                                  className="text-[10px] bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2 py-1 rounded-md cursor-pointer transition-colors"
                                  title="تایید حذف"
                                >
                                  حذف؟
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="p-1 hover:bg-[var(--paper-2)] rounded-md text-[var(--ink-soft)] cursor-pointer"
                                  title="لغو"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(e.id)}
                                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md text-[var(--ink-soft)] cursor-pointer transition-colors"
                                title="حذف نوشته"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title (if present) */}
                        {e.title && (
                          <button 
                            onClick={() => setFocusedEntryId(e.id)}
                            className="entry-title text-right font-bold text-[15px] text-[var(--ink)] leading-relaxed hover:text-[var(--sage)] transition-colors cursor-pointer w-fit"
                            title="مطالعه با تمرکز"
                          >
                            {e.title}
                          </button>
                        )}

                        {/* Body text content */}
                        <div 
                          className={`entry-body break-words w-full ${
                            e.type === 'code' ? 'font-mono bg-[var(--paper)] p-3.5 border border-[var(--line)] rounded-xl direction-ltr text-left overflow-x-auto text-[13px] text-[var(--ink)] shadow-inner leading-relaxed' : 'text-[var(--ink)] whitespace-pre-wrap text-[15px] leading-[2.1] text-justify font-medium tracking-normal opacity-90'
                          } ${isCollapsible ? 'max-h-[100px] overflow-hidden relative' : ''}`}
                          style={{ textJustify: 'inter-word' }}
                        >
                          {e.type === 'code' ? e.body : linkifyText(e.body)}
                          
                          {/* Fade mask for collapsed text */}
                          {isCollapsible && (
                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--paper-2)] to-transparent pointer-events-none" />
                          )}
                        </div>

                        {/* Expand/Collapse Toggle Text buttons */}
                        {isLong && !focusedEntryId && (
                          <button
                            onClick={() => toggleCardExpansion(e.id)}
                            className="text-[11px] text-[var(--sage-dark)] font-bold hover:opacity-80 flex items-center gap-1 cursor-pointer w-fit mt-1 bg-[var(--sage)]/10 px-2.5 py-1 rounded-md transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={12} />
                                <span>نمایش کمتر</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown size={12} />
                                <span>ادامه نوشته...</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* List of tags */}
                        {e.tags && e.tags.length > 0 && (
                          <div className="entry-tags flex flex-wrap gap-1.5 mt-2">
                            {e.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold text-[var(--ink-soft)] bg-[var(--paper)] border border-[var(--line)] px-2 py-0.5 rounded-md"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
        </div>
      </main>

      {/* ---------- Supabase & LocalStorage Recovery Modal ---------- */}
      <AnimatePresence>
        {isRecoveryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            dir="rtl"
            onClick={() => setIsRecoveryModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[var(--paper)] border border-[var(--line-strong)] rounded-2xl p-6 shadow-2xl flex flex-col gap-5 text-right max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <Database className="text-[var(--sage-dark)]" size={20} />
                  <h2 className="text-base font-extrabold text-[var(--ink)]">
                    بازیابی نوشته‌های قبلی (Supabase و مرورگر)
                  </h2>
                </div>
                <button
                  onClick={() => setIsRecoveryModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--paper-2)] text-[var(--ink-soft)] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {supaStatusMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs leading-relaxed font-medium border ${
                    supaStatusMsg.type === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                      : supaStatusMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {supaStatusMsg.text}
                </div>
              )}

              {/* Section 1: Supabase Direct Migration */}
              <div className="bg-[var(--paper-2)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[var(--ink)]">
                    روش اول: انتقال مستقیم از دیتابیس قبلی (Supabase)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                    پیشنهادی
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                  پروژه قبلی شما در Supabase به دلیل عدم فعالیت چندروزه در حالت <b>Paused (معلق)</b> قرار گرفته است و نوشته‌هایتان پاک نشده‌اند. ابتدا از لینک زیر پروژه را در سایت Supabase روشن (Restore) کنید و بعد از ۲ دقیقه فرم زیر را بزنید:
                </p>

                <a
                  href="https://supabase.com/dashboard/project/pybofuhhevqarmphgyhg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-[var(--paper)] border border-[var(--line-strong)] hover:border-[var(--sage)] text-xs font-bold text-[var(--sage-dark)] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>۱. باز کردن پنل Supabase و زدن دکمه Restore project ↗</span>
                </a>

                <form onSubmit={handleMigrateFromSupabase} className="flex flex-col gap-2.5 mt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1">
                      ایمیل اکانت قبلی در Supabase
                    </label>
                    <input
                      type="email"
                      value={supaEmail}
                      onChange={(e) => setSupaEmail(e.target.value)}
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs text-left focus:border-[var(--sage)] focus:outline-none"
                      placeholder="sfcbgdfgsdfsdfvfgssdfsdgvfdg@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink-soft)] mb-1">
                      رمز عبور اکانت قبلی شما در Supabase
                    </label>
                    <input
                      type="password"
                      value={supaPassword}
                      onChange={(e) => setSupaPassword(e.target.value)}
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs text-left focus:border-[var(--sage)] focus:outline-none"
                      placeholder="رمز عبوری که قبلاً با آن وارد می‌شدید..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={supaLoading}
                    className="w-full py-2.5 px-3 rounded-xl bg-[var(--sage-dark)] text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                  >
                    <RefreshCw size={14} className={supaLoading ? 'animate-spin' : ''} />
                    <span>
                      {supaLoading
                        ? 'در حال اتصال به Supabase و دریافت نوشته‌ها...'
                        : '۲. اتصال به Supabase و انتقال همه نوشته‌ها به Firebase'}
                    </span>
                  </button>
                </form>
              </div>

              {/* Section 2: Browser LocalStorage Recovery */}
              <div className="bg-[var(--paper-2)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  روش دوم: بازیابی از حافظه همین مرورگر (LocalStorage)
                </span>
                <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                  هر بار که قبلاً وارد سایت می‌شدید، یک نسخه پشتیبان از نوشته‌هایتان در حافظه مرورگرِ همان آدرس اینترنتی ذخیره می‌شد. (اگر قبلاً از آدرس قبلی سایت خود استفاده می‌کردید، همان آدرس قبلی را در مرورگر باز کنید و دکمه زیر را بزنید):
                </p>
                <button
                  type="button"
                  onClick={handleRecoverLegacyEntries}
                  className="w-full py-2.5 px-3 rounded-xl bg-[var(--paper)] border border-[var(--line-strong)] hover:border-[var(--sage)] text-xs font-bold text-[var(--ink)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>بررسی و بازیابی نوشته‌ها از حافظه این مرورگر</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Elegant Floating Toast Status ---------- */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="toast fixed bottom-6 left-1/2 bg-[var(--ink)] text-[var(--paper)] text-xs font-semibold px-5 py-3 rounded-full shadow-lg border border-[var(--line-strong)]/20 z-50 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--sage)] animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
