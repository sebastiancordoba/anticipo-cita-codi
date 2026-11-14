import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { conDb } from "@/lib/store";
import { firmar } from "@/lib/webhook";

export const dynamic = "force-dynamic";

// Solo en modo simulado: arma el mismo webhook que mandaría pey, lo firma y lo envía a nuestro endpoint.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (config.modo !== "simulado") return NextResponse.json({ error: "solo en modo simulado" }, { status: 403 });
  const { id } = await params;
  const cita = await conDb((db) => db.citas.find((c) => c.id === id) ?? null);
  if (!cita?.codiQrId) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const repetir = new URL(req.url).searchParams.get("tx");
  const cuerpo = JSON.stringify({
    type: "codi.qr.payment_received",
    amount: cita.monto,
    codiQrId: cita.codiQrId,
    concept: "Anticipo",
    datePaid: Math.floor(Date.now() / 1000),
    numRef: cita.numRef,
    transactionId: repetir ?? "SIMTX" + Date.now().toString(36).toUpperCase(),
  });
  const wid = "msg_" + Date.now();
  const ts = String(Math.floor(Date.now() / 1000));
  const r = await fetch(new URL("/api/webhooks/pey", req.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": wid,
      "webhook-timestamp": ts,
      "webhook-signature": firmar(config.webhookSecret, wid, ts, cuerpo),
    },
    body: cuerpo,
  });
  return NextResponse.json({ enviado: JSON.parse(cuerpo), respuesta: await r.json() }, { status: r.status });
}
