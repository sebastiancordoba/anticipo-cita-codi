import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { conDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cita = await conDb((db) => db.citas.find((c) => c.id === id) ?? null);
  if (!cita) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const qrSvg = cita.qrString && cita.estado === "apartada" ? await QRCode.toString(cita.qrString, { type: "svg", margin: 1 }) : null;
  return NextResponse.json({ cita: { ...cita, telefono: undefined }, qrSvg });
}
