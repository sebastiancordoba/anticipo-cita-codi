import { config } from "./config";
import { pagosDelQr, transaccion } from "./pey";
import { conDb, evento, ocupa, type Cita } from "./store";

export type EventoPago = {
  type: string;
  codiQrId?: string;
  transactionId: string;
  amount: number;
  datePaid?: number;
  numRef?: string;
};

export type Resultado =
  | { ok: true; accion: "confirmada" | "ya_procesado" | "pago_tardio" | "reconfirmada_tarde" | "pago_duplicado"; citaId: string }
  | { ok: false; motivo: string };

const TIPOS = ["codi.qr.payment_received", "codi.pn.payment_received"];

/**
 * Aplica un pago recibido (QR o cobro al celular) a su cita.
 * Idempotente: el mismo transactionId nunca se procesa dos veces. Un segundo pago distinto
 * para la misma cita (p. ej. pagó el QR y también el cobro al celular) queda como reembolso pendiente.
 */
export async function aplicarPago(ev: EventoPago): Promise<Resultado> {
  if (!TIPOS.includes(ev.type)) return { ok: false, motivo: "evento no manejado" };
  const esPn = ev.type === "codi.pn.payment_received";
  if (!esPn && !ev.codiQrId) return { ok: false, motivo: "falta codiQrId" };

  // Confirmación del lado del servidor: preguntar a pey antes de dar el pago por bueno.
  if (config.modo === "real") {
    const real = esPn
      ? await transaccion(ev.transactionId)
      : (await pagosDelQr(ev.codiQrId!)).find((p) => p.id === ev.transactionId) ?? null;
    if (!real || real.status !== "PAID") return { ok: false, motivo: "pey no reporta ese pago como PAID" };
    ev = { ...ev, amount: real.amount };
  }

  return conDb((db): Resultado => {
    const cita = esPn
      ? db.citas.find((c) => c.pnTransactionId === ev.transactionId)
      : db.citas.find((c) => c.codiQrId === ev.codiQrId);
    if (!cita) return { ok: false, motivo: "no hay cita para ese pago" };
    const yaVisto = cita.transactionId === ev.transactionId || (cita.reembolsos ?? []).some((r) => r.tx === ev.transactionId);
    if (yaVisto) return { ok: true, accion: "ya_procesado", citaId: cita.id };
    if (ev.amount + 1e-9 < cita.monto) return { ok: false, motivo: `monto ${ev.amount} menor al anticipo ${cita.monto}` };

    const devolver = (c: Cita, motivo: string) =>
      (c.reembolsos ??= []).push({ tx: ev.transactionId, monto: ev.amount, motivo, creado: Date.now() });

    if (cita.transactionId) {
      devolver(cita, "Pago duplicado");
      evento(db, cita, "pago_duplicado", ev.transactionId);
      return { ok: true, accion: "pago_duplicado", citaId: cita.id };
    }

    cita.transactionId = ev.transactionId;
    cita.pagada = Date.now();
    if (cita.estado === "apartada") {
      cita.estado = "confirmada";
      evento(db, cita, "confirmada", esPn ? "celular" : "qr");
      return { ok: true, accion: "confirmada", citaId: cita.id };
    }
    // Pago tardío: si el horario sigue libre se confirma; si alguien más lo tomó, se devuelve.
    const ocupado = db.citas.some((c) => c.id !== cita.id && c.horario === cita.horario && ocupa(c));
    if (!ocupado && cita.estado === "expirada") {
      cita.estado = "confirmada";
      evento(db, cita, "confirmada_tarde");
      return { ok: true, accion: "reconfirmada_tarde", citaId: cita.id };
    }
    cita.estado = cita.estado === "cancelada" ? "cancelada" : "pago_tardio";
    devolver(cita, cita.estado === "cancelada" ? "Pagó una cita cancelada" : "Pago tardío, horario ocupado");
    evento(db, cita, "pago_tardio");
    return { ok: true, accion: "pago_tardio", citaId: cita.id };
  });
}
