"use client";
import { useEffect, useMemo, useState } from "react";
import { ETIQUETA, cap, fmtDia, fmtHora, fmtMonto } from "./formato";

type Horario = { horario: string; libre: boolean };
type Cita = { id: string; horario: string; paciente: string; monto: number; estado: string; venceEn: number };

export default function Paciente() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [anticipo, setAnticipo] = useState(0);
  const [modo, setModo] = useState("");
  const [elegido, setElegido] = useState<string | null>(null);
  const [paciente, setPaciente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cita, setCita] = useState<Cita | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [ahora, setAhora] = useState(Date.now());

  const cargarHorarios = () =>
    fetch("/api/horarios").then((r) => r.json()).then((d) => { setHorarios(d.horarios); setAnticipo(d.anticipo); setModo(d.modo); });
  useEffect(() => { cargarHorarios(); }, []);

  // Mientras la cita espera el anticipo, se consulta su estado cada 2 s (el webhook la confirma en el servidor).
  useEffect(() => {
    if (!cita || cita.estado !== "apartada") return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/citas/${cita.id}`).then((r) => r.json());
      setCita(d.cita);
      if (d.qrSvg) setQrSvg(d.qrSvg);
      setAhora(Date.now());
    }, 2000);
    return () => clearInterval(t);
  }, [cita]);

  const porDia = useMemo(() => {
    const m = new Map<string, Horario[]>();
    for (const h of horarios) { const k = fmtDia(h.horario); m.set(k, [...(m.get(k) ?? []), h]); }
    return [...m.entries()];
  }, [horarios]);

  async function apartar() {
    setError(""); setEnviando(true);
    const r = await fetch("/api/citas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ horario: elegido, paciente, telefono }) });
    const d = await r.json(); setEnviando(false);
    if (!r.ok) { setError(d.error ?? "Error"); cargarHorarios(); return; }
    const det = await fetch(`/api/citas/${d.cita.id}`).then((x) => x.json());
    setCita(det.cita); setQrSvg(det.qrSvg);
  }

  async function simularPago() {
    if (cita) await fetch(`/api/simular/${cita.id}`, { method: "POST" });
  }

  if (cita) {
    const restante = Math.max(0, Math.round((cita.venceEn - ahora) / 1000));
    return (
      <main>
        <Encabezado />
        <div className="tarjeta centro" style={{ marginTop: 16 }}>
          <p><span className={`chip ${cita.estado}`}>{ETIQUETA[cita.estado]}</span></p>
          <p><b>{fmtDia(cita.horario)}, {fmtHora(cita.horario)}</b><br /><span className="suave">{cita.paciente}</span></p>
          {cita.estado === "apartada" && (
            <>
              <p>Escanea con la app de tu banco (CoDi) para pagar el anticipo de <b>{fmtMonto(cita.monto)}</b>.</p>
              {qrSvg && <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
              <p className="suave">Te guardamos el horario {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")} min. Esta pantalla cambia sola al llegar el pago.</p>
              {modo === "simulado" && <button onClick={simularPago}>Simular pago (modo demo)</button>}
            </>
          )}
          {cita.estado === "confirmada" && <p>✅ Recibimos tu anticipo. Tu cita está confirmada; se descuenta del total de la consulta.</p>}
          {cita.estado === "expirada" && <p>El tiempo para pagar terminó y liberamos el horario. Puedes elegir otro.</p>}
          {cita.estado === "pago_tardio" && <p>Tu pago llegó después de que el horario se ocupó. Te lo devolvemos; elige otro horario.</p>}
          {cita.estado !== "apartada" && <button onClick={() => { setCita(null); setElegido(null); cargarHorarios(); }}>Volver</button>}
        </div>
      </main>
    );
  }

  return (
    <main>
      <Encabezado />
      {modo === "simulado" && <p className="aviso">Modo demo: los pagos son simulados</p>}
      <h2>1. Elige un horario</h2>
      {porDia.map(([dia, hs]) => (
        <div key={dia} className="dia">
          <div className="suave">{cap(dia)}</div>
          <div className="horarios">
            {hs.map((h) => (
              <button key={h.horario} disabled={!h.libre} className={elegido === h.horario ? "elegido" : ""} onClick={() => setElegido(h.horario)}>
                {fmtHora(h.horario)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {elegido && (
        <div className="tarjeta" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>2. Tus datos</h2>
          <label>Nombre<input value={paciente} onChange={(e) => setPaciente(e.target.value)} placeholder="Nombre y apellido" /></label>
          <label>Celular (10 dígitos)<input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="numeric" placeholder="5512345678" /></label>
          <p className="suave">Anticipo para confirmar: <b>{fmtMonto(anticipo)}</b> por CoDi, sin comisión para ti.</p>
          <button className="primario" disabled={enviando} onClick={apartar}>{enviando ? "Generando cobro…" : "Apartar y pagar anticipo"}</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </main>
  );
}

function Encabezado() {
  return (
    <header>
      <h1>Consultorio Roble</h1>
      <div className="suave">Medicina general · consultorio ficticio de demostración</div>
    </header>
  );
}
