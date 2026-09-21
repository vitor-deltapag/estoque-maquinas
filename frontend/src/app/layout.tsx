import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import ThemeProvider from "../components/ThemeProvider";
import ToastErroProvider from "../components/ToastErro";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Estoque Delta",
  description: "Sistema de gerenciamento de estoque",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300`}>
        <ThemeProvider>
          <ToastErroProvider>
            <Header />
            {children}
          </ToastErroProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}