import { NextResponse } from "next/server";
import { conDb } from "@/lib/store";

export const dynamic = "force-dynamic";

// El paciente se arrepiente antes de pagar: libera el horario de inmediato.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await conDb((db) => {
    const c = db.citas.find((x) => x.id === id);
    if (!c) return 404;
    if (c.estado !== "apartada") return 409;
    c.estado = "expirada";
    db.eventos.push(`${new Date().toISOString()} cita ${c.id} cancelada por el paciente, horario liberado`);
    return 200;
  });
  return NextResponse.json({ ok: r === 200 }, { status: r });
}
