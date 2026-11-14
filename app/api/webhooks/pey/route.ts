import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { aplicarPago, type EventoPago } from "@/lib/pagos";
import { verificar } from "@/lib/webhook";

export const dynamic = "force-dynamic";

// pey avisa aquí cuando llega un pago (Standard Webhooks). Hay que registrar esta URL en
// portal.mipey.mx → Desarrollador → engrane de la API key → "Crear Webhook".
export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (!verificar(config.webhookSecret, req.headers, cuerpo)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }
  const ev = JSON.parse(cuerpo) as EventoPago;
  const r = await aplicarPago(ev);
  console.log("webhook pey", ev.type, ev.transactionId, r);
  // 2xx para que pey no reintente lo que ya procesamos o no nos toca.
  return NextResponse.json(r, { status: 200 });
}
