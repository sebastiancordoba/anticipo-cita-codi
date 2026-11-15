import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CONSULTORIO } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: `Agenda tu cita · ${CONSULTORIO.nombre}`,
  description: "Elige horario y confirma tu cita con un anticipo por CoDi.",
};

export const viewport: Viewport = { themeColor: "#fafaf9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
