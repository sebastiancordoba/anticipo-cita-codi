import { CONSULTORIO, config } from "./config";
import { cobrarAlCelular, crearQr } from "./pey";
import { conDb, evento, ocupa, type Cita } from "./store";

export type Accion = "cobro_celular" | "renovar_qr" | "recordatorio" | "cancelar" | "asistio" | "no_asistio" | "reembolso_hecho";
type Quien = "paciente" | "consultorio";
type Res = { ok: true; cita: Cita; extra?: Record<string, string> } | { ok: false; status: number; error: string };

const concepto = () => `Anticipo cita ${CONSULTORIO.nombre}`.slice(0, 40);
const fallo = (status: number, error: string): Res => ({ ok: false, status, error });

export async function ejecutar(id: string, accion: Accion, quien: Quien): Promise<Res> {
  const actual = await conDb((db) => db.citas.find((c) => c.id === id) ?? null);
  if (!actual) return fallo(404, "No existe la cita");

  switch (accion) {
    case "cobro_celular": {
      if (actual.estado !== "apartada") return fallo(409, "La cita ya no espera pago");
      // CoDi pide al menos 6 min de vigencia: si queda menos, se extiende el apartado.
      const nuevoVence = Math.max(actual.venceEn, Date.now() + 6 * 60_000 + 5_000);
      let pn;
      try {
        pn = await cobrarAlCelular({
          monto: actual.monto, telefono: actual.telefono, concepto: concepto(), numRef: actual.numRef,
          expiracionSeg: Math.round((nuevoVence - Date.now()) / 1000), metadata: { citaId: actual.id },
        });
      } catch (e) {
        console.error(e);
        return fallo(502, "El banco no aceptó el cobro al celular. ¿Ese número tiene CoDi activo? Usa el QR.");
      }
      return guardar(id, (c, db) => {
        c.pnTransactionId = pn.transactionId;
        c.pnEnviado = Date.now();
        c.venceEn = nuevoVence;
        evento(db, c, "cobro_celular", quien);
      });
    }
    case "renovar_qr": {
      if (actual.estado !== "apartada" && actual.estado !== "expirada") return fallo(409, "Solo se renueva un cobro pendiente o vencido");
      const libre = await conDb((db) => !db.citas.some((c) => c.id !== id && c.horario === actual.horario && ocupa(c)));
      if (!libre) return fallo(409, "Ese horario ya lo tomó otra persona");
      const qr = await crearQr({
        monto: actual.monto, concepto: concepto(), numRef: actual.numRef,
        expiracionSeg: config.minutosApartado * 60, metadata: { citaId: actual.id },
      }).catch((e) => { console.error(e); return null; });
      if (!qr) return fallo(502, "No se pudo crear el nuevo cobro");
      return guardar(id, (c, db) => {
        c.codiQrId = qr.id;
        c.qrString = qr.qrString;
        c.estado = "apartada";
        c.venceEn = Date.now() + config.minutosApartado * 60_000;
        evento(db, c, "qr_renovado", quien);
      });
    }
    case "recordatorio":
      return guardar(id, (c, db) => {
        (c.recordatorios ??= []).push(Date.now());
        evento(db, c, "recordatorio");
      });
    case "cancelar":
      if (actual.estado !== "apartada" && actual.estado !== "confirmada") return fallo(409, "La cita ya no está activa");
      return guardar(id, (c, db) => {
        if (c.estado === "confirmada" && c.transactionId) {
          (c.reembolsos ??= []).push({ tx: c.transactionId, monto: c.monto, motivo: "Cita cancelada", creado: Date.now() });
        }
        c.estado = "cancelada";
        c.canceladaPor = quien;
        evento(db, c, "cancelada", quien);
      });
    case "asistio":
    case "no_asistio":
      if (actual.estado !== "confirmada") return fallo(409, "Solo en citas confirmadas");
      return guardar(id, (c, db) => {
        c.asistencia = accion;
        evento(db, c, accion);
      });
    case "reembolso_hecho":
      if (!(actual.reembolsos ?? []).some((r) => !r.hecho)) return fallo(409, "No hay nada por devolver");
      return guardar(id, (c, db) => {
        for (const r of c.reembolsos ?? []) r.hecho ??= Date.now();
        evento(db, c, "reembolso_hecho");
      });
  }
  return fallo(400, "Acción desconocida");
}

async function guardar(id: string, fn: (c: Cita, db: Parameters<Parameters<typeof conDb>[0]>[0]) => void): Promise<Res> {
  const c = await conDb((db) => {
    const c = db.citas.find((x) => x.id === id)!;
    fn(c, db);
    return c;
  });
  return { ok: true, cita: c };
}
