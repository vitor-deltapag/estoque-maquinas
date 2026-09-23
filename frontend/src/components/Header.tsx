"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase, getAccessToken, ensureSessionWithinMaxAge, clearSessionStarted, isRememberMe } from "../lib/supabase";
import ThemeToggle from "./ThemeToggle";
import { apiFetch } from "../lib/api";

const ROTAS_PUBLICAS = ["/login", "/esqueci-senha", "/redefinir-senha"];
const IDLE_MS = 15 * 60 * 1000;

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<string>("COMUM");
  const idleLogoutRef = useRef(false);
  const expiredLogoutRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      const isPublic = ROTAS_PUBLICAS.includes(pathnameRef.current);

      if (isPublic) {
        setCarregando(false);
        return;
      }

      if (!session) {
        if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
          const dest = idleLogoutRef.current
            ? "/login?inativo=1"
            : expiredLogoutRef.current
              ? "/login?expirada=1"
              : "/login";
          idleLogoutRef.current = false;
          expiredLogoutRef.current = false;
          router.replace(dest);
        }
        setCarregando(false);
        return;
      }

      if (ensureSessionWithinMaxAge() === "expired") {
        expiredLogoutRef.current = true;
        clearSessionStarted();
        void supabase.auth.signOut();
        setCarregando(false);
        return;
      }

      setCarregando(false);

      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;

      window.setTimeout(() => {
        void (async () => {
          try {
            const res = await apiFetch("/usuarios/me");
            if (cancelled || !res.ok) return;
            const data = await res.json();
            setPerfil(data.perfil);
          } catch (error) {
            console.error(error);
          }
        })();
      }, 0);
    });

    const fallback = window.setTimeout(() => {
      if (cancelled) return;
      setCarregando(false);
      if (!ROTAS_PUBLICAS.includes(pathnameRef.current) && !getAccessToken()) {
        router.replace("/login");
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (ROTAS_PUBLICAS.includes(pathname)) return;

    let last = Date.now();
    const mark = () => {
      last = Date.now();
    };
    const eventos = ["mousedown", "keydown", "scroll", "touchstart"];
    eventos.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));

    const id = window.setInterval(async () => {
      if (!getAccessToken()) return;
      if (ensureSessionWithinMaxAge() === "expired") {
        expiredLogoutRef.current = true;
        clearSessionStarted();
        await supabase.auth.signOut();
        return;
      }
      if (Date.now() - last < IDLE_MS) return;
      if (isRememberMe()) return;
      idleLogoutRef.current = true;
      await supabase.auth.signOut();
    }, 30_000);

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, mark));
      window.clearInterval(id);
    };
  }, [pathname]);

  const handleSair = async () => {
    clearSessionStarted();
    await supabase.auth.signOut();
  };

  if (carregando && !ROTAS_PUBLICAS.includes(pathname)) {
    return <div className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300"></div>;
  }

  if (ROTAS_PUBLICAS.includes(pathname)) {
    return null;
  }

  const isAtivo = (caminho: string) => {
    const ativo = caminho === "/cadastros"
      ? pathname === "/cadastros" || (pathname.startsWith("/novo-") && !pathname.startsWith("/novo-cliente"))
      : caminho === "/eventos"
        ? pathname === "/eventos" || pathname.startsWith("/eventos/")
        : caminho === "/clientes"
          ? pathname === "/clientes" || pathname.startsWith("/editar-cliente") || pathname.startsWith("/novo-cliente")
          : caminho === "/parceiros"
            ? pathname === "/parceiros" || pathname.startsWith("/parceiros/")
            : pathname === caminho;
            return ativo
            ? "text-orange-600 font-bold border-b-2 border-orange-600 pb-1"
            : "text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors font-medium pb-1";
        };
        return (
          <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <div className="shrink-0 flex items-center gap-3">
                  <Link href="/" className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight transition-colors">
                    Estoque <span className="text-orange-500">Delta</span>
                  </Link>
                </div>
                <nav className="hidden md:flex space-x-4 lg:space-x-6 text-sm">
                  <Link href="/" className={isAtivo("/")}>Painel</Link>
                  <Link href="/dispositivos" className={isAtivo("/dispositivos")}>Máquinas</Link>
                  <Link href="/movimentacoes" className={isAtivo("/movimentacoes")}>Movimentações(em breve)</Link>
                  <Link href="/eventos" className={isAtivo("/eventos")}>Eventos</Link>
                  <Link href="/parceiros" className={isAtivo("/parceiros")}>Parceiros</Link>
                  <Link href="/clientes" className={isAtivo("/clientes")}>Clientes</Link>
                  <Link href="/cadastros" className={isAtivo("/cadastros")}>Cadastros</Link>
                  {perfil === "ADMIN" && (
                    <Link href="/usuarios" className={isAtivo("/usuarios")}>Usuários</Link>
                  )}
                </nav>

          <div className="flex items-center">
            <ThemeToggle />
            <button
              onClick={handleSair}
              className="text-sm font-semibold text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white border border-red-600 dark:border-red-500 hover:bg-red-600 dark:hover:bg-red-500 transition-colors py-1.5 px-4 rounded-lg cursor-pointer"
            >
              Sair
            </button>

          </div>

        </div>
      </div>
    </header>
  );
}