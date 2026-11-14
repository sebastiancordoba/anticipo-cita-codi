import { config } from "./config";
import { pagosDelQr } from "./pey";
import { conDb } from "./store";

export type EventoPago = {
  type: string;
  codiQrId?: string;
  transactionId: string;
  amount: number;
  datePaid?: number;
  numRef?: string;
};

export type Resultado =
  | { ok: true; accion: "confirmada" | "ya_procesado" | "pago_tardio" | "reconfirmada_tarde"; citaId: string }
  | { ok: false; motivo: string };

/** Aplica un pago recibido a su cita. Es idempotente: el mismo transactionId nunca se procesa dos veces. */
export async function aplicarPago(ev: EventoPago): Promise<Resultado> {
  if (ev.type !== "codi.qr.payment_received" || !ev.codiQrId) return { ok: false, motivo: "evento no manejado" };

  // Confirmación del lado del servidor: preguntar a pey antes de dar la cita por pagada.
  if (config.modo === "real") {
    const pagos = await pagosDelQr(ev.codiQrId);
    const real = pagos.find((p) => p.id === ev.transactionId && p.status === "PAID");
    if (!real) return { ok: false, motivo: "pey no reporta ese pago como PAID" };
    ev = { ...ev, amount: real.amount };
  }

  return conDb((db) => {
    const cita = db.citas.find((c) => c.codiQrId === ev.codiQrId);
    if (!cita) return { ok: false, motivo: "no hay cita para ese QR" } as Resultado;
    if (cita.transactionId === ev.transactionId) return { ok: true, accion: "ya_procesado", citaId: cita.id } as Resultado;
    if (ev.amount + 1e-9 < cita.monto) return { ok: false, motivo: `monto ${ev.amount} menor al anticipo ${cita.monto}` } as Resultado;

    cita.transactionId = ev.transactionId;
    cita.pagada = Date.now();
    const log = (t: string) => db.eventos.push(`${new Date().toISOString()} ${t}`);

    if (cita.estado === "apartada") {
      cita.estado = "confirmada";
      log(`cita ${cita.id} confirmada con pago ${ev.transactionId}`);
      return { ok: true, accion: "confirmada", citaId: cita.id } as Resultado;
    }
    // Pago tardío: si el horario sigue libre se confirma; si alguien más lo tomó, se marca para devolver.
    const ocupado = db.citas.some(
      (c) => c.id !== cita.id && c.horario === cita.horario && (c.estado === "apartada" || c.estado === "confirmada"),
    );
    if (!ocupado) {
      cita.estado = "confirmada";
      log(`cita ${cita.id} confirmada con pago tardío ${ev.transactionId}`);
      return { ok: true, accion: "reconfirmada_tarde", citaId: cita.id } as Resultado;
    }
    cita.estado = "pago_tardio";
    log(`cita ${cita.id}: pago tardío ${ev.transactionId} con horario ya ocupado — devolver anticipo`);
    return { ok: true, accion: "pago_tardio", citaId: cita.id } as Resultado;
  });
}
