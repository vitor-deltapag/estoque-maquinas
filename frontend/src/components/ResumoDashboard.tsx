"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ResumoProps {
  dispositivos: any[];
}

export default function ResumoDashboard({ dispositivos }: ResumoProps) {
  const [isMontado, setIsMontado] = useState(false);

  useEffect(() => {
    setIsMontado(true);
  }, []);

  const total = dispositivos.length;
  const noCliente = dispositivos.filter(d => d.estado === "NO CLIENTE").length;
  const emEstoque = dispositivos.filter(d => d.estado === "ESTOQUE").length;
  const emReparo = dispositivos.filter(d => d.estado === "REPARO").length;

  const modelosBase = ['P2 BIN', 'X990', 'S920', 'A910', 'L300'];
  const modelosCadastrados = dispositivos.map(d => d.modelo).filter(Boolean);
  const todosModelos = Array.from(new Set([...modelosBase, ...modelosCadastrados]));

  const statsPorModelo = todosModelos.map(modelo => {
    const maquinas = dispositivos.filter(d => d.modelo === modelo);
    const qtdNoCliente = maquinas.filter(d => d.estado === "NO CLIENTE").length;
    const qtdEstoque = maquinas.filter(d => d.estado === "ESTOQUE").length;
    const qtdReparo = maquinas.filter(d => d.estado === "REPARO").length;
    const qtdPerdida = maquinas.filter(d => d.estado === "MAQUINA PERDIDA").length;

    const chartData = [
      { name: "No Cliente", value: qtdNoCliente, color: "#f97316" }, 
      { name: "Estoque", value: qtdEstoque, color: "#3b82f6" },       
      { name: "Reparo", value: qtdReparo, color: "#ef4444" },         
      { name: "Perdida", value: qtdPerdida, color: "#6b7280" }        
    ].filter(item => item.value > 0); 

    if (chartData.length === 0) {
      chartData.push({ name: "Sem registros", value: 1, color: "#f3f4f6" });
    }

    return {
      modelo,
      total: maquinas.length,
      qtdNoCliente,
      qtdEstoque,
      qtdReparo,
      qtdPerdida,
      chartData
    };
  });

  if (!isMontado) {
    return <div className="text-center text-gray-500 py-10">Carregando painel analítico...</div>;
  }

  return (
    <div className="mb-10 space-y-8">
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center border-b-4 border-b-gray-800">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total de Máquinas</p>
          <p className="text-4xl font-black text-gray-800 mt-2">{total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center border-b-4 border-b-orange-500">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">No Cliente</p>
          <p className="text-4xl font-black text-orange-600 mt-2">{noCliente}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center border-b-4 border-b-blue-500">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Em Estoque</p>
          <p className="text-4xl font-black text-blue-600 mt-2">{emEstoque}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center border-b-4 border-b-red-500">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Em Reparo</p>
          <p className="text-4xl font-black text-red-600 mt-2">{emReparo}</p>
        </div>
      </div>

      <hr className="border-gray-200" />

      <h2 className="text-xl font-bold text-orange-500">Resumo por Modelo</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {statsPorModelo.map((stat) => (
          <div key={stat.modelo} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-full">
            
            <h3 className="text-center font-extrabold text-gray-800 uppercase tracking-widest mb-4">
              Quantidades {stat.modelo}
            </h3>
            
            <div className="flex flex-row items-center justify-between flex-grow">
              
              <div className="space-y-3 text-sm font-semibold text-gray-600 w-1/2">
                <p className="text-gray-900 bg-gray-100 py-1 px-2 rounded">
                  TOTAL: <span className="font-black text-lg">{stat.total}</span>
                </p>
                <p className="flex items-center gap-2 pl-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                  NO CLIENTE: <span className="text-gray-900 font-bold">{stat.qtdNoCliente}</span>
                </p>
                <p className="flex items-center gap-2 pl-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  ESTOQUE: <span className="text-gray-900 font-bold">{stat.qtdEstoque}</span>
                </p>
                
                {stat.qtdReparo > 0 && (
                  <p className="flex items-center gap-2 pl-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    REPARO: <span className="text-gray-900 font-bold">{stat.qtdReparo}</span>
                  </p>
                )}
                {stat.qtdPerdida > 0 && (
                  <p className="flex items-center gap-2 pl-2">
                    <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                    PERDIDA: <span className="text-gray-900 font-bold">{stat.qtdPerdida}</span>
                  </p>
                )}
              </div>

              {/* 
                CORREÇÃO DEFINITIVA: 
                - Removido o height="100%" (que causa o bug de renderização).
                - Aplicado height=144 fixo para casar com a altura da div (h-36 do Tailwind).
                - Adicionado minWidth={0} e minHeight={0} para travar os cálculos negativos do Recharts.
              */}
              <div className="w-1/2 flex justify-end items-center" style={{ minHeight: '144px' }}>
                <ResponsiveContainer width="100%" height={144} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={stat.chartData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {stat.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}