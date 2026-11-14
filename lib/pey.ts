import { config } from "./config";

const BASE = "https://api.pey.mx";

export type QrCreado = { id: string; qrString: string };
export type Transaccion = {
  id: string;
  status: string;
  amount: number;
  datePaid?: number;
};

async function llamar<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + ruta, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`pey ${ruta} respondió ${r.status}: ${await r.text()}`);
  return (await r.json()) as T;
}

/** POST /codi/qr — crea el cobro CoDi que el paciente escanea con la app de su banco. */
export async function crearQr(p: {
  monto: number;
  concepto: string;
  numRef: string;
  expiracionSeg: number;
  metadata: Record<string, string>;
}): Promise<QrCreado> {
  if (config.modo === "simulado") {
    const id = "SIM" + Math.random().toString(36).slice(2, 9).toUpperCase();
    return { id, qrString: JSON.stringify({ TYP: 1, v: "01", ic: 0, IDC: id, simulado: true }) };
  }
  return llamar<QrCreado>("/codi/qr", {
    method: "POST",
    body: JSON.stringify({
      amount: p.monto,
      concept: p.concepto,
      numRef: p.numRef,
      expiration: Math.max(360, p.expiracionSeg),
      metadata: p.metadata,
    }),
  });
}

/**
 * GET /transaction/codi/qr/{id} — confirma desde el servidor que el QR de verdad tiene un pago.
 * No basta con creerle al webhook: se vuelve a preguntar a pey.
 */
export async function pagosDelQr(codiQrId: string): Promise<Transaccion[]> {
  if (config.modo === "simulado") return []; // en simulado el webhook firmado es la única fuente
  const r = await llamar<{ items: Transaccion[] }>(`/transaction/codi/qr/${encodeURIComponent(codiQrId)}`);
  return r.items ?? [];
}
