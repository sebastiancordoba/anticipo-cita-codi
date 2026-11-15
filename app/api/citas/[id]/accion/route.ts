import { NextResponse } from "next/server";
import { ejecutar, type Accion } from "@/lib/acciones";

export const dynamic = "force-dynamic";

const DEL_PACIENTE: Accion[] = ["cobro_celular", "renovar_qr", "cancelar"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { accion?: Accion; quien?: "paciente" | "consultorio" };
  if (!b.accion) return NextResponse.json({ error: "Falta la acción" }, { status: 400 });
  const quien = b.quien === "paciente" ? "paciente" : "consultorio";
  if (quien === "paciente" && !DEL_PACIENTE.includes(b.accion)) return NextResponse.json({ error: "No permitido" }, { status: 403 });
  const r = await ejecutar(id, b.accion, quien);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, estado: r.cita.estado });
}
