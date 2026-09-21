"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type MensagemUi = { tipo: string; texto: string };

type ToastItem = { id: number; texto: string };

const ToastErroContext = createContext<(texto: string) => void>(() => {});

export function useToastErro() {
  return useContext(ToastErroContext);
}

export function useMensagem() {
  const mostrarErro = useToastErro();
  const [mensagem, setMensagemState] = useState<MensagemUi>({ tipo: "", texto: "" });
  const setMensagem = useCallback(
    (msg: MensagemUi) => {
      setMensagemState(msg);
      if (msg.tipo === "erro" && msg.texto) mostrarErro(msg.texto);
    },
    [mostrarErro],
  );
  return [mensagem, setMensagem] as const;
}

export function useMensagemErro() {
  const mostrarErro = useToastErro();
  const [mensagemErro, setMensagemErroState] = useState("");
  const setMensagemErro = useCallback(
    (valor: string) => {
      setMensagemErroState(valor);
      if (valor) mostrarErro(valor);
    },
    [mostrarErro],
  );
  return [mensagemErro, setMensagemErro] as const;
}

export default function ToastErroProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const mostrarErro = useCallback((texto: string) => {
    const msg = typeof texto === "string" && texto.trim() ? texto : "Erro ao processar a operação.";
    const id = Date.now() + Math.random();
    setToasts((atual) => [...atual, { id, texto: msg }]);
    window.setTimeout(() => {
      setToasts((atual) => atual.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastErroContext.Provider value={mostrarErro}>
      {children}
      <div className="fixed bottom-4 left-4 z-[80] flex max-w-sm flex-col gap-2 pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="alert"
            className="pointer-events-auto rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {item.texto}
          </div>
        ))}
      </div>
    </ToastErroContext.Provider>
  );
}
