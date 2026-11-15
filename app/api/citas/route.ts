import { NextResponse } from "next/server";
import { CONSULTORIO, config } from "@/lib/config";
import { HORA_FIN, HORA_INICIO } from "@/lib/store";
import { crearQr } from "@/lib/pey";
import { conDb, evento, horariosDisponibles, nuevaCita, ocupa } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const citas = await conDb((db) => ({ citas: [...db.citas].reverse(), eventos: db.eventos.slice(-200).reverse() }));
  return NextResponse.json({ ...citas, modo: config.modo, consultorio: CONSULTORIO, horas: [HORA_INICIO, HORA_FIN], horarios: horariosDisponibles(), ahora: Date.now() });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { horario?: string; paciente?: string; telefono?: string };
  const paciente = (b.paciente ?? "").trim().slice(0, 80);
  const telefono = (b.telefono ?? "").replace(/\D/g, "");
  if (!b.horario || !horariosDisponibles().includes(b.horario)) return NextResponse.json({ error: "Horario no válido" }, { status: 400 });
  if (!paciente) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  if (telefono.length !== 10) return NextResponse.json({ error: "El teléfono debe tener 10 dígitos" }, { status: 400 });

  // 1) Apartar el horario (atómico).
  const cita = await conDb((db) => {
    if (db.citas.some((c) => c.horario === b.horario && ocupa(c))) return null;
    const c = nuevaCita(db, { horario: b.horario!, paciente, telefono });
    evento(db, c, "apartada");
    return c;
  });
  if (!cita) return NextResponse.json({ error: "Ese horario se acaba de ocupar" }, { status: 409 });

  // 2) Crear el cobro CoDi en pey.
  try {
    const qr = await crearQr({
      monto: cita.monto,
      concepto: `Anticipo cita ${CONSULTORIO.nombre}`.slice(0, 40),
      numRef: cita.numRef,
      expiracionSeg: config.minutosApartado * 60,
      metadata: { citaId: cita.id },
    });
    const lista = await conDb((db) => {
      const c = db.citas.find((x) => x.id === cita.id)!;
      c.codiQrId = qr.id;
      c.qrString = qr.qrString;
      return c;
    });
    return NextResponse.json({ cita: lista });
  } catch (e) {
    await conDb((db) => {
      const c = db.citas.find((x) => x.id === cita.id)!;
      c.estado = "expirada";
      evento(db, c, "error_cobro");
    });
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear el cobro CoDi" }, { status: 502 });
  }
}
