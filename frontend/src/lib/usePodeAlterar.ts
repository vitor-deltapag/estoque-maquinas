"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export function usePodeAlterar() {
  const [podeAlterar, setPodeAlterar] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    apiFetch("/usuarios/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const me = await res.json();
        setPodeAlterar(Boolean(me.permissoes?.alterar_estoque));
      })
      .catch(() => {})
      .finally(() => setPronto(true));
  }, []);

  return { podeAlterar, pronto };
}
