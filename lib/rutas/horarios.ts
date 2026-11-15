import { NextResponse } from "next/server";
import { conDb, horariosDisponibles, ocupa } from "@/lib/store";
import { CONSULTORIO, config } from "@/lib/config";


export async function GET() {
  const res = await conDb((db) => {
    const tomados = new Set(db.citas.filter(ocupa).map((c) => c.horario));
    return horariosDisponibles().map((h) => ({ horario: h, libre: !tomados.has(h) }));
  });
  return NextResponse.json({ horarios: res, anticipo: config.anticipoMXN, modo: config.modo, consultorio: CONSULTORIO, minutosApartado: config.minutosApartado });
}
