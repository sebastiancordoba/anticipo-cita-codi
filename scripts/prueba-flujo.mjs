// Prueba de punta a punta en modo simulado contra un servidor ya levantado (npm run dev).
// Uso: npm run prueba  (BASE=http://localhost:3000 por defecto)
const BASE = process.env.BASE ?? "http://localhost:3000";
const j = async (r) => ({ status: r.status, body: await r.json() });
const ok = (cond, msg) => { if (!cond) { console.error("✗", msg); process.exit(1); } console.log("✓", msg); };

const h = await j(await fetch(`${BASE}/api/horarios`));
const libre = h.body.horarios.find((x) => x.libre);
ok(libre, "hay horarios libres");

const c = await j(await fetch(`${BASE}/api/citas`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ horario: libre.horario, paciente: "Paciente de Prueba", telefono: "5500000000" }) }));
ok(c.status === 200 && c.body.cita.estado === "apartada" && c.body.cita.codiQrId, "cita apartada con QR");
const id = c.body.cita.id;

const dup = await fetch(`${BASE}/api/citas`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ horario: libre.horario, paciente: "Otro", telefono: "5500000001" }) });
ok(dup.status === 409, "el mismo horario no se puede apartar dos veces");

const falsa = await fetch(`${BASE}/api/webhooks/pey`, { method: "POST", headers: { "webhook-id": "x", "webhook-timestamp": String(Math.floor(Date.now() / 1000)), "webhook-signature": "v1,AAAA" },
  body: JSON.stringify({ type: "codi.qr.payment_received", codiQrId: c.body.cita.codiQrId, transactionId: "X", amount: 999 }) });
ok(falsa.status === 401, "webhook con firma falsa se rechaza");

const p = await j(await fetch(`${BASE}/api/simular/${id}`, { method: "POST" }));
ok(p.body.respuesta.accion === "confirmada", "el pago confirma la cita");
const tx = p.body.enviado.transactionId;

const rep = await j(await fetch(`${BASE}/api/simular/${id}?tx=${tx}`, { method: "POST" }));
ok(rep.body.respuesta.accion === "ya_procesado", "el mismo pago repetido no se procesa dos veces");

const fin = await j(await fetch(`${BASE}/api/citas/${id}`));
ok(fin.body.cita.estado === "confirmada", "estado final: confirmada");
// Cobro al celular (CoDi push): se envía, se paga y confirma otra cita.
const libre2 = (await j(await fetch(`${BASE}/api/horarios`))).body.horarios.find((x) => x.libre);
const c2 = await j(await fetch(`${BASE}/api/citas`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ horario: libre2.horario, paciente: "Paciente Celular", telefono: "5500000002" }) }));
const id2 = c2.body.cita.id;
const pn = await fetch(`${BASE}/api/citas/${id2}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "cobro_celular", quien: "paciente" }) });
ok(pn.status === 200, "el paciente pide el cobro a su celular");
const pp = await j(await fetch(`${BASE}/api/simular/${id2}?metodo=celular`, { method: "POST" }));
ok(pp.body.enviado.type === "codi.pn.payment_received" && pp.body.respuesta.accion === "confirmada", "el pago desde el celular confirma la cita");
const dupl = await j(await fetch(`${BASE}/api/simular/${id2}`, { method: "POST" }));
ok(dupl.body.respuesta.accion === "pago_duplicado", "un segundo pago (QR) de la misma cita queda por devolver");

// Acciones del consultorio
const prohibido = await fetch(`${BASE}/api/citas/${id}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "asistio", quien: "paciente" }) });
ok(prohibido.status === 403, "el paciente no puede marcar asistencia");
const asis = await fetch(`${BASE}/api/citas/${id}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "asistio" }) });
ok(asis.status === 200, "el consultorio marca asistencia");
const canc = await fetch(`${BASE}/api/citas/${id}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "cancelar" }) });
ok(canc.status === 200, "el consultorio cancela una cita pagada");
const lista = (await j(await fetch(`${BASE}/api/citas`))).body.citas;
const cancelada = lista.find((c) => c.id === id);
ok(cancelada.estado === "cancelada" && cancelada.reembolsos?.length === 1, "la cita cancelada queda con su anticipo por devolver");
const dev = await fetch(`${BASE}/api/citas/${id}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "reembolso_hecho" }) });
ok(dev.status === 200, "se registra la devolución");
const libreOtra = await fetch(`${BASE}/api/citas`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ horario: libre.horario, paciente: "Nuevo Paciente", telefono: "5500000003" }) });
ok(libreOtra.status === 200, "el horario cancelado vuelve a estar libre");
console.log("Todo bien.");
