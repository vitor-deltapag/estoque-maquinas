import { getAccessToken, setAccessToken, supabase, clearSessionStarted } from "./supabase";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function postLogin(email: string, senha: string) {
  return fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
}

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha"];

let refreshInFlight: Promise<string | null> | null = null;

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (PUBLIC_PATHS.includes(window.location.pathname)) return;
  window.location.assign("/login");
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) return null;
      setAccessToken(data.session.access_token);
      return data.session.access_token;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function forceSignOut() {
  setAccessToken(null);
  clearSessionStarted();
  await supabase.auth.signOut({ scope: "local" });
  redirectToLogin();
}

// Rotas autenticadas. path começa com "/".
export async function apiFetch(path: string, init: RequestInit = {}) {
  let token = getAccessToken();
  if (!token) {
    throw new Error("Não autenticado");
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  const url = `${API_URL}${path}`;
  let res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      res = await fetch(url, { ...init, headers });
    }
    if (res.status === 401) {
      await forceSignOut();
    }
  }

  return res;
}
