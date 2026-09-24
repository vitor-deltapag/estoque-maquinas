"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiFetch } from "../lib/api";

export default function Home() {
  const [metricas, setMetricas] = useState({ maquinas: 0, clientes: 0, fornecedores: 0, parceiro: 0, evento: 0, eventosPendentes: 0, usuarios: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [graficosModelos, setGraficosModelos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Cores padronizadas para os status do sistema
  const CORES_STATUS: Record<string, string> = {
    "NO CLIENTE": "#10B981", // Verde
    "ESTOQUE": "#3B82F6",    // Azul
    "REPARO": "#EF4444",     // Vermelho
    "MAQUINA PERDIDA": "#EF4444", // Vermelho
  };
  const COR_PADRAO = "#9CA3AF"; // Cinza para status indefinido

  useEffect(() => {
    async function carregarDashboard() {
      try {
        // Faz APENAS UMA requisição super rápida para a rota otimizada do dashboard
        const [response, meRes] = await Promise.all([
          apiFetch(`/dispositivos/dashboard`, { cache: "no-store" }),
          apiFetch(`/usuarios/me`, { cache: "no-store" }),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          setIsAdmin(me.perfil === "ADMIN");
        }

        if (response.ok) {
          const dash = await response.json();

          setMetricas({
            maquinas: dash.total_maquinas,
            clientes: dash.total_clientes,
            fornecedores: dash.total_fornecedores,
            parceiro: dash.total_parceiro || 0,
            evento: dash.total_evento || 0,
            eventosPendentes: dash.total_eventos_pendentes || 0,
            usuarios: dash.total_usuarios || 0,
          });

          const agrupado = dash.agrupamento_modelos;

          // Formata para o gráfico
          const graficosFormatados = Object.keys(agrupado).map((modeloStr) => {
            const dadosDoModelo = Object.keys(agrupado[modeloStr]).map((estadoStr) => ({
              name: estadoStr,
              value: agrupado[modeloStr][estadoStr]
            }));
            return {
              modelo: modeloStr,
              dados: dadosDoModelo
            };
          });

          setGraficosModelos(graficosFormatados);
        }
      } catch (error) {
        console.error("Erro ao carregar os dados:", error);
      } finally {
        setCarregando(false);
      }
    }
    carregarDashboard();
  }, []);

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors">
        <p className="text-orange-600 font-medium text-lg animate-pulse">Carregando painel de controle...</p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-orange-600">Painel de Controle</h1>
        <p className="text-gray-900 dark:text-gray-300 mt-2 text-base transition-colors dark:text-white">Visão geral do Estoque Delta e gerenciamento.</p>
      </div>

      {metricas.eventosPendentes > 0 && (
        <Link
          href="/eventos"
          className="mb-8 block rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4 hover:border-red-400 transition-colors"
        >
          <p className="font-bold text-red-700 dark:text-red-300">Pendência de devolução</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {metricas.eventosPendentes === 1
              ? "1 evento já terminou. Cobre a devolução das máquinas."
              : `${metricas.eventosPendentes} eventos já terminaram. Cobre a devolução das máquinas.`}
          </p>
        </Link>
      )}

      {/* CARDS DE NAVEGAÇÃO SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 py-1 px-2.5 rounded-full uppercase tracking-wider transition-colors">Módulo Principal</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3 transition-colors">Máquinas</h2>
            <p className="text-3xl font-black text-gray-900 dark:text-white mt-4 font-mono transition-colors">{metricas.maquinas} <span className="text-sm font-medium text-gray-400 dark:text-gray-500 transition-colors">cadastradas</span></p>
          </div>
          <Link href="/dispositivos" className="mt-6 block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
            Gerenciar Máquinas →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 py-1 px-2.5 rounded-full uppercase tracking-wider transition-colors">Cadastros</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3 transition-colors">Clientes (MIDs)</h2>
            <p className="text-3xl font-black text-gray-900 dark:text-white mt-4 font-mono transition-colors">{metricas.clientes} <span className="text-sm font-medium text-gray-400 dark:text-gray-500 transition-colors">ativos</span></p>
          </div>
          <Link href="/clientes" className="mt-6 block text-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
            Gerenciar Clientes →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 py-1 px-2.5 rounded-full uppercase tracking-wider transition-colors">Cadastros</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3 transition-colors">Distribuidores</h2>
            <p className="text-3xl font-black text-gray-900 dark:text-white mt-4 font-mono transition-colors">{metricas.fornecedores} <span className="text-sm font-medium text-gray-400 dark:text-gray-500 transition-colors">registrados</span></p>
          </div>
          <Link href="/distribuidores" className="mt-6 block text-center bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
            Gerenciar Distribuidores →
          </Link>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 mb-12 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 py-1 px-2.5 rounded-full uppercase tracking-wider transition-colors">Máquinas</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3 transition-colors">Parceiro</h2>
            <p className="text-3xl font-black text-gray-900 dark:text-white mt-4 font-mono transition-colors">{metricas.parceiro} <span className="text-sm font-medium text-gray-400 dark:text-gray-500 transition-colors">em parceiro</span></p>
          </div>
          <Link href="/dispositivos?parceiro=true" className="mt-6 block text-center bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
            Ver em parceiro →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 py-1 px-2.5 rounded-full uppercase tracking-wider transition-colors">Máquinas</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3 transition-colors">Evento</h2>
            <p className="text-3xl font-black text-gray-900 dark:text-white mt-4 font-mono transition-colors">{metricas.evento} <span className="text-sm font-medium text-gray-400 dark:text-gray-500 transition-colors">em evento</span></p>
          </div>
          <Link href="/eventos" className="mt-6 block text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
            Gerenciar eventos →
          </Link>
        </div>

        {isAdmin && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 py-1 px-2.5 rounded-full uppercase tracking-wider transition-colors">Admin</span>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-3 transition-colors">Usuários</h2>
              <p className="text-3xl font-black text-gray-900 dark:text-white mt-4 font-mono transition-colors">{metricas.usuarios} <span className="text-sm font-medium text-gray-400 dark:text-gray-500 transition-colors">cadastrados</span></p>
            </div>
            <Link href="/usuarios" className="mt-6 block text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
              Gerenciar Usuários →
            </Link>
          </div>
        )}
      </div>

      {/* GRÁFICOS DIVIDIDOS POR MODELO */}
      <h2 className="text-2xl font-bold text-orange-600 mb-6 border-b border-gray-200 dark:border-gray-800 pb-2 transition-colors">Status do Estoque por Modelo</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

        {graficosModelos.map((grafico, index) => (
          <div key={index} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col items-center transition-all">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 bg-gray-100 dark:bg-gray-800 px-4 py-1 rounded-md transition-colors">
              Modelo: {grafico.modelo}
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="99%" height={256}>
                <PieChart>
                  <Pie
                    data={grafico.dados}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {grafico.dados.map((entry: any, i: number) => (
                      <Cell key={`cell-${i}`} fill={CORES_STATUS[entry.name] || COR_PADRAO} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Máquinas`, 'Quantidade']} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium transition-colors">
              Total: {grafico.dados.reduce((acc: number, cur: any) => acc + cur.value, 0)} máquinas
            </p>
          </div>
        ))}

        {graficosModelos.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-10 transition-colors">Nenhum dado de modelo encontrado no banco.</p>
        )}

      </div>
    </main>
  );
}