import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const REMEMBER_KEY = "estoque-delta-remember";
export const SESSION_STARTED_KEY = "estoque-delta-session-started";
export const MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const memory = new Map<string, string>();

function isAuthTokenKey(key: string) {
  return key.startsWith("sb-") && key.includes("auth-token");
}

export function isRememberMe() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "0";
}

function authStorage() {
  if (typeof window === "undefined") {
    return {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
  }
  return isRememberMe() ? window.localStorage : window.sessionStorage;
}

function otherStorage() {
  return isRememberMe() ? window.sessionStorage : window.localStorage;
}

const adaptiveStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return memory.get(key) ?? null;
    return authStorage().getItem(key) ?? otherStorage().getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") {
      memory.set(key, value);
      return;
    }
    authStorage().setItem(key, value);
    otherStorage().removeItem(key);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") {
      memory.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  const dest = remember ? window.localStorage : window.sessionStorage;
  const source = remember ? window.sessionStorage : window.localStorage;
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  for (const key of Object.keys(source)) {
    if (!isAuthTokenKey(key)) continue;
    const value = source.getItem(key);
    if (value) dest.setItem(key, value);
    source.removeItem(key);
  }
}

export function markSessionStarted() {
  if (typeof window === "undefined") return;
  const started = String(Date.now());
  window.localStorage.setItem(SESSION_STARTED_KEY, started);
  window.sessionStorage.setItem(SESSION_STARTED_KEY, started);
}

export function clearSessionStarted() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STARTED_KEY);
  window.sessionStorage.removeItem(SESSION_STARTED_KEY);
}

function sessionStartedMs(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STARTED_KEY) ?? window.sessionStorage.getItem(SESSION_STARTED_KEY);
  if (!raw) return null;
  const started = Number(raw);
  return Number.isFinite(started) ? started : null;
}

/** Sessão persistida (lembrar de mim) vale no máximo 7 dias desde o login. */
export function ensureSessionWithinMaxAge(): "ok" | "expired" {
  const started = sessionStartedMs();
  if (started == null) {
    markSessionStarted();
    return "ok";
  }
  if (Date.now() - started > MAX_SESSION_MS) return "expired";
  return "ok";
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: adaptiveStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let cachedAccessToken: string | null = null;

function tokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const storages = [window.localStorage, window.sessionStorage];
  for (const storage of storages) {
    for (const key of Object.keys(storage)) {
      if (!isAuthTokenKey(key)) continue;
      try {
        const parsed = JSON.parse(storage.getItem(key) || "");
        const token = parsed?.access_token;
        if (typeof token === "string" && token) return token;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export function getAccessToken(): string | null {
  return cachedAccessToken || tokenFromStorage();
}

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null;
  });
}
