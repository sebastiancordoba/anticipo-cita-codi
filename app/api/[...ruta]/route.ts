import { NextResponse } from "next/server";
import * as horarios from "@/lib/rutas/horarios";
import * as citas from "@/lib/rutas/citas";
import * as cita from "@/lib/rutas/cita";
import * as accion from "@/lib/rutas/accion";
import * as webhook from "@/lib/rutas/webhook";
import * as simular from "@/lib/rutas/simular";

export const dynamic = "force-dynamic";

// Toda la API vive en una sola función: en Vercel cada route.ts es una función aparte con su propio /tmp,
// y sin Redis la cita creada en una no existía en la otra.
type Ctx = { params: Promise<{ ruta: string[] }> };
const conId = (id: string) => ({ params: Promise.resolve({ id }) });
const noHay = () => NextResponse.json({ error: "No existe" }, { status: 404 });

export async function GET(req: Request, { params }: Ctx) {
  const r = (await params).ruta;
  if (r.length === 1 && r[0] === "horarios") return horarios.GET();
  if (r.length === 1 && r[0] === "citas") return citas.GET();
  if (r.length === 2 && r[0] === "citas") return cita.GET(req, conId(r[1]));
  return noHay();
}

export async function POST(req: Request, { params }: Ctx) {
  const r = (await params).ruta;
  if (r.length === 1 && r[0] === "citas") return citas.POST(req);
  if (r.length === 3 && r[0] === "citas" && r[2] === "accion") return accion.POST(req, conId(r[1]));
  if (r.length === 2 && r[0] === "webhooks" && r[1] === "pey") return webhook.POST(req);
  if (r.length === 2 && r[0] === "simular") return simular.POST(req, conId(r[1]));
  return noHay();
}
