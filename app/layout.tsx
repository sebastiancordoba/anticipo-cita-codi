import "./globals.css";
import type { Metadata } from "next";
import { CONSULTORIO } from "@/lib/config";

export const metadata: Metadata = {
  title: `Anticipo CoDi · ${CONSULTORIO.nombre}`,
  description: "Aparta tu cita y confírmala con un anticipo por CoDi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
