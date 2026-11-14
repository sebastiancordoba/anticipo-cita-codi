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
console.log("Todo bien.");
