"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

const CARDS = [
  {
    href: "/novo-dispositivo",
    badge: "Estoque",
    badgeClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
    buttonClass: "bg-blue-600 hover:bg-blue-700",
    titulo: "Máquina",
    texto: "Cadastrar uma ou várias máquinas no estoque.",
  },
  {
    href: "/novo-cliente",
    badge: "Cadastros",
    badgeClass: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30",
    buttonClass: "bg-purple-600 hover:bg-purple-700",
    titulo: "Cliente",
    texto: "Cadastrar cliente com MID, razão social e fantasia.",
  },
  {
    href: "/novo-fornecedor",
    badge: "Cadastros",
    badgeClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    buttonClass: "bg-amber-600 hover:bg-amber-700",
    titulo: "Fornecedor",
    texto: "Cadastrar fornecedor com nome e código.",
  },
  {
    href: "/parceiros/novo",
    badge: "Cadastros",
    badgeClass: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30",
    buttonClass: "bg-teal-600 hover:bg-teal-700",
    titulo: "Parceiro",
    texto: "Cadastrar um parceiro e ver as máquinas vinculadas.",
  },


];

export default function Cadastros() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const res = await apiFetch("/usuarios/me");
        if (!res.ok) return;
        const data = await res.json();
        setIsAdmin(data.perfil === "ADMIN");
      } catch (error) {
        console.error(error);
      }
    }
    carregarPerfil();
  }, []);

  const cards = isAdmin
    ? [
        ...CARDS,
        {
          href: "/novo-usuario",
          badge: "Admin",
          badgeClass: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30",
          buttonClass: "bg-orange-600 hover:bg-orange-700",
          titulo: "Usuário",
          texto: "Cadastrar um novo acesso ao sistema.",
        },
      ]
    : CARDS;

  return (
    <main className="p-10 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-orange-600">Cadastros</h1>
        <p className="text-gray-900 dark:text-white mt-2 text-base">Escolha um card para abrir o formulário.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-orange-400 transition-all min-h-[220px]"
          >
            <div>
              <span className={`text-xs font-bold py-1 px-2.5 rounded-full uppercase tracking-wider ${card.badgeClass}`}>
                {card.badge}
              </span>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3">{card.titulo}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{card.texto}</p>
            </div>
            <span className={`mt-6 block text-center text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors ${card.buttonClass}`}>
              Abrir formulário →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
