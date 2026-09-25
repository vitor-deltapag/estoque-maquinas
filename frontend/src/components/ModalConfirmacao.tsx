"use client";

type ModalConfirmacaoProps = {
  aberto: boolean;
  titulo: string;
  texto: string;
  confirmarLabel: string;
  carregando?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
};

export default function ModalConfirmacao({
  aberto,
  titulo,
  texto,
  confirmarLabel,
  carregando = false,
  onCancelar,
  onConfirmar,
}: ModalConfirmacaoProps) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-8 dark:bg-gray-900 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{titulo}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{texto}</p>
        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onCancelar}
            disabled={carregando}
            className="w-1/2 border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-semibold p-2.5 rounded-lg disabled:opacity-50"
          >
            {carregando ? "Aguarde..." : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
