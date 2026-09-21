"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NovoAdquirenteRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/parceiros/novo");
  }, [router]);
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-950">
      <p className="text-orange-600 font-medium animate-pulse">Abrindo cadastro de parceiro...</p>
    </main>
  );
}
