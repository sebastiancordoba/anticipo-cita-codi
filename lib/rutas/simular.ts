import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { conDb } from "@/lib/store";
import { firmar } from "@/lib/webhook";
import { POST as webhookPey } from "./webhook";


// Solo en modo simulado: arma el mismo webhook que mandaría pey, lo firma y lo envía a nuestro endpoint.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (config.modo !== "simulado") return NextResponse.json({ error: "solo en modo simulado" }, { status: 403 });
  const { id } = await params;
  const cita = await conDb((db) => db.citas.find((c) => c.id === id) ?? null);
  if (!cita?.codiQrId && !cita?.pnTransactionId) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const repetir = q.get("tx");
  const pn = q.get("metodo") === "celular" && cita.pnTransactionId;
  const cuerpo = JSON.stringify({
    type: pn ? "codi.pn.payment_received" : "codi.qr.payment_received",
    amount: cita.monto,
    codiQrId: cita.codiQrId,
    concept: "Anticipo",
    datePaid: Math.floor(Date.now() / 1000),
    numRef: cita.numRef,
    transactionId: pn ? cita.pnTransactionId : repetir ?? "SIMTX" + Date.now().toString(36).toUpperCase(),
  });
  const wid = "msg_" + Date.now();
  const ts = String(Math.floor(Date.now() / 1000));
  // Se llama al manejador del webhook dentro del mismo proceso (misma instancia y mismo almacén), con la misma firma.
  const r = await webhookPey(new Request(new URL("/api/webhooks/pey", req.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": wid,
      "webhook-timestamp": ts,
      "webhook-signature": firmar(config.webhookSecret, wid, ts, cuerpo),
    },
    body: cuerpo,
  }));
  return NextResponse.json({ enviado: JSON.parse(cuerpo), respuesta: await r.json() }, { status: r.status });
}
