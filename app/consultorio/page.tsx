"use client";
import { useEffect, useState } from "react";
import { ETIQUETA, cap, fmtDia, fmtHora, fmtMonto } from "../formato";

type Cita = { id: string; horario: string; paciente: string; monto: number; estado: string; transactionId?: string };

export default function Consultorio() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [eventos, setEventos] = useState<string[]>([]);
  useEffect(() => {
    const cargar = () => fetch("/api/citas").then((r) => r.json()).then((d) => { setCitas(d.citas); setEventos(d.eventos); });
    cargar();
    const t = setInterval(cargar, 2000);
    return () => clearInterval(t);
  }, []);

  const n = (e: string) => citas.filter((c) => c.estado === e).length;
  const cobrado = citas.filter((c) => c.estado === "confirmada").reduce((s, c) => s + c.monto, 0);
  const agenda = [...citas].sort((a, b) => a.horario.localeCompare(b.horario));

  return (
    <main>
      <h1>Agenda del consultorio</h1>
      <div className="suave">Se actualiza sola cuando pey avisa de un pago CoDi.</div>
      <div className="kpis" style={{ marginTop: 16 }}>
        <div className="tarjeta kpi"><span className="suave">Confirmadas</span><b>{n("confirmada")}</b></div>
        <div className="tarjeta kpi"><span className="suave">Esperando anticipo</span><b>{n("apartada")}</b></div>
        <div className="tarjeta kpi"><span className="suave">Expiradas</span><b>{n("expirada")}</b></div>
        <div className="tarjeta kpi"><span className="suave">Anticipos cobrados</span><b>{fmtMonto(cobrado)}</b></div>
      </div>
      <h2>Citas</h2>
      <div className="tarjeta tabla-scroll">
        <table>
          <thead><tr><th>Horario</th><th>Paciente</th><th>Estado</th><th>Pago</th></tr></thead>
          <tbody>
            {agenda.length === 0 && <tr><td colSpan={4} className="suave">Aún no hay citas.</td></tr>}
            {agenda.map((c) => (
              <tr key={c.id}>
                <td>{cap(fmtDia(c.horario))}, {fmtHora(c.horario)}</td>
                <td>{c.paciente}</td>
                <td><span className={`chip ${c.estado}`}>{ETIQUETA[c.estado]}</span></td>
                <td className="suave">{c.transactionId ? `${fmtMonto(c.monto)} · ${c.transactionId.slice(0, 10)}…` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Bitácora</h2>
      <div className="tarjeta suave" style={{ fontSize: ".85rem", fontFamily: "ui-monospace, monospace" }}>
        {eventos.length ? eventos.map((e, i) => <div key={i}>{e}</div>) : "Sin eventos."}
      </div>
    </main>
  );
}
