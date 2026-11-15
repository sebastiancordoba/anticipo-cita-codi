"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowLeft, BellRing, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Download, Globe, MapPin, Navigation,
  QrCode, RefreshCw, ShieldCheck, Smartphone, Stethoscope,
} from "lucide-react";
import { claveDia, etiquetaDia, fmtDia, fmtDiaCorto, fmtHora, fmtMonto, fmtTel, googleCal, ics, reloj, type Estado } from "./formato";
import { Boton, Esqueleto, Insignia, Spinner, Tarjeta, cx } from "./ui";

type Horario = { horario: string; libre: boolean };
type Consultorio = { nombre: string; medica: string; especialidad: string; direccion: string; duracionMin: number };
type Cita = {
  id: string; horario: string; paciente: string; monto: number; estado: Estado; venceEn: number; creada: number;
  numRef: string; transactionId?: string; pagada?: number; pnEnviado?: number;
};
type Info = { horarios: Horario[]; anticipo: number; modo: string; consultorio: Consultorio; minutosApartado: number };

const mapa = (dir: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`;

export default function Paciente() {
  const [info, setInfo] = useState<Info | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [cita, setCita] = useState<Cita | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [telefono, setTelefono] = useState("");

  const cargar = useCallback(async () => {
    setErrorCarga(false);
    try {
      const r = await fetch("/api/horarios", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = (await r.json()) as Info;
      setInfo(d);
      const primero = d.horarios.find((h) => h.libre);
      setDia((act) => act ?? (primero ? claveDia(primero.horario) : null));
    } catch {
      setErrorCarga(true);
    }
  }, []);

  // Recupera la cita en curso si se recarga la página o se abre desde WhatsApp (?cita=c0001).
  useEffect(() => {
    cargar();
    const id = new URLSearchParams(location.search).get("cita");
    if (id)
      fetch(`/api/citas/${id}`).then(async (r) => {
        if (!r.ok) return history.replaceState(null, "", "/");
        const d = await r.json();
        setCita(d.cita);
        setQrSvg(d.qrSvg);
      });
  }, [cargar]);

  const abrirCita = (c: Cita, svg: string | null, tel: string) => {
    setCita(c);
    setQrSvg(svg);
    setTelefono(tel);
    history.replaceState(null, "", `/?cita=${c.id}`);
    window.scrollTo({ top: 0 });
  };
  const reiniciar = () => {
    setCita(null);
    setQrSvg(null);
    setHora(null);
    history.replaceState(null, "", "/");
    cargar();
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh">
      <Barra consultorio={info?.consultorio} modo={info?.modo} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-36 pt-5 sm:px-6 sm:pb-16 sm:pt-10">
        {cita ? (
          <Pago cita={cita} qrSvg={qrSvg} info={info} telefono={telefono} onCita={setCita} onQr={setQrSvg} onReiniciar={reiniciar} />
        ) : hora && info ? (
          <Datos hora={hora} info={info} onVolver={() => setHora(null)} onApartada={abrirCita} onOcupado={() => { setHora(null); cargar(); }} />
        ) : (
          <Agenda info={info} errorCarga={errorCarga} reintentar={cargar} dia={dia} setDia={setDia} onHora={(h) => { setHora(h); window.scrollTo({ top: 0 }); }} />
        )}
      </main>
    </div>
  );
}

/* ───────────── Barra superior ───────────── */

function Barra({ consultorio, modo }: { consultorio?: Consultorio; modo?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-borde/70 bg-fondo/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-acento text-white"><Stethoscope className="size-4" /></span>
          <span className="text-[15px] font-semibold tracking-tight">{consultorio?.nombre ?? "Consultorio Roble"}</span>
        </a>
        {modo === "simulado" && (
          <span className="rounded-full bg-espera-suave px-2.5 py-1 text-xs font-medium text-espera ring-1 ring-inset ring-espera/20">Modo demo</span>
        )}
      </div>
    </header>
  );
}

/* ───────────── Paso 1: día y hora (estilo Cal.com) ───────────── */

function Agenda(p: { info: Info | null; errorCarga: boolean; reintentar: () => void; dia: string | null; setDia: (d: string) => void; onHora: (h: string) => void }) {
  const { info } = p;
  const dias = useMemo(() => {
    const m = new Map<string, Horario[]>();
    for (const h of info?.horarios ?? []) m.set(claveDia(h.horario), [...(m.get(claveDia(h.horario)) ?? []), h]);
    return m;
  }, [info]);
  const horas = dias.get(p.dia ?? "") ?? [];
  const sinLugares = info && ![...dias.values()].some((hs) => hs.some((h) => h.libre));

  if (p.errorCarga)
    return (
      <Tarjeta className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <AlertCircle className="size-6 text-alerta" />
        <div><p className="font-medium">No pudimos cargar la agenda</p><p className="text-sm text-tinta-2">Revisa tu conexión e inténtalo de nuevo.</p></div>
        <Boton variante="secundario" onClick={p.reintentar}><RefreshCw className="size-4" />Reintentar</Boton>
      </Tarjeta>
    );

  return (
    <div className="animate-entra">
      <Tarjeta className="overflow-hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)_240px]">
        {/* Columna 1: quién y qué */}
        <div className="border-b border-borde p-5 lg:border-b-0 lg:border-r lg:p-6">
          <div className="flex items-center gap-3 lg:block">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-acento-suave text-sm font-semibold text-acento">ER</div>
            <div className="lg:mt-3">
              <p className="text-sm text-tinta-2">{info?.consultorio.medica ?? " "}</p>
              <h1 className="text-xl font-semibold tracking-tight">Consulta de {info?.consultorio.especialidad.toLowerCase() ?? "medicina general"}</h1>
            </div>
          </div>
          <div className="mt-4 space-y-2.5 text-sm text-tinta-2">
            <Fila icono={<Clock className="size-4" />}>{info?.consultorio.duracionMin ?? 30} min</Fila>
            <Fila icono={<MapPin className="size-4" />}>{info?.consultorio.direccion ?? "—"}</Fila>
            <Fila icono={<ShieldCheck className="size-4" />}>Anticipo de {info ? fmtMonto(info.anticipo) : "—"} por CoDi para confirmar. Se descuenta del total.</Fila>
            <span className="hidden lg:block"><Fila icono={<Globe className="size-4" />}>Hora del centro de México</Fila></span>
          </div>
        </div>

        {/* Columna 2: calendario (escritorio) o tira de días (móvil) */}
        <div className="p-5 lg:p-6">
          <h2 className="text-[15px] font-semibold">Elige un día</h2>
          {!info ? (
            <div className="mt-4 flex gap-2">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-[68px] w-[72px]" />)}</div>
          ) : sinLugares ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
              <Clock className="size-6 text-tinta-3" />
              <p className="font-medium">No hay horarios disponibles</p>
              <p className="text-sm text-tinta-2">Todos los lugares de los próximos días están ocupados. Vuelve más tarde.</p>
            </div>
          ) : (
            <>
              <TiraDias dias={dias} dia={p.dia} setDia={p.setDia} />
              <Mes dias={dias} dia={p.dia} setDia={p.setDia} />
            </>
          )}
        </div>

        {/* Columna 3: horas del día */}
        <div className="border-t border-borde p-5 lg:max-h-[600px] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-6">
          {p.dia && info && !sinLugares ? (
            <Horas key={p.dia} dia={p.dia} horas={horas} onHora={p.onHora} />
          ) : !info ? (
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">{Array.from({ length: 6 }, (_, i) => <Esqueleto key={i} className="h-11" />)}</div>
          ) : null}
        </div>
      </Tarjeta>
      <p className="mt-4 text-center text-xs text-tinta-3">Consultorio ficticio de demostración · pagos con CoDi vía pey</p>
    </div>
  );
}

function TiraDias({ dias, dia, setDia }: { dias: Map<string, Horario[]>; dia: string | null; setDia: (d: string) => void }) {
  return (
    <div className="sin-barra -mx-5 mt-3 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 lg:hidden">
      {[...dias.entries()].map(([k, hs]) => {
        const libres = hs.filter((h) => h.libre).length;
        const d = fmtDiaCorto(hs[0].horario);
        const et = etiquetaDia(hs[0].horario);
        const activo = k === dia;
        return (
          <button key={k} disabled={!libres} onClick={() => setDia(k)}
            className={cx("flex min-w-[76px] snap-start flex-col items-center rounded-xl px-3 py-2 ring-1 transition-all duration-150 active:scale-[0.97]",
              activo ? "bg-acento text-white ring-acento shadow-suave" : "bg-superficie ring-borde hover:ring-borde-fuerte", !libres && "opacity-40")}>
            <span className={cx("text-xs font-medium", activo ? "text-white/85" : "text-tinta-2")}>{et === "Hoy" || et === "Mañana" ? et : d.semana}</span>
            <span className="text-xl font-semibold leading-tight tabular-nums">{d.num}</span>
            <span className={cx("text-[11px]", activo ? "text-white/80" : "text-tinta-3")}>{libres ? `${libres} libres` : "Lleno"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Mes({ dias, dia, setDia }: { dias: Map<string, Horario[]>; dia: string | null; setDia: (d: string) => void }) {
  const claves = [...dias.keys()].sort();
  const [mes, setMes] = useState((dia ?? claves[0] ?? new Date().toISOString()).slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const enMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const offset = (primero.getUTCDay() + 6) % 7; // semana empieza en lunes
  const hoy = claveDia(new Date().toISOString());
  const meses = [...new Set(claves.map((k) => k.slice(0, 7)))];
  const idx = meses.indexOf(mes);
  const titulo = primero.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="mt-4 hidden lg:block">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold first-letter:uppercase">{titulo}</span>
        <div className="flex gap-1">
          <button disabled={idx <= 0} onClick={() => setMes(meses[idx - 1])} className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100 disabled:opacity-30" aria-label="Mes anterior"><ChevronLeft className="size-4" /></button>
          <button disabled={idx < 0 || idx >= meses.length - 1} onClick={() => setMes(meses[idx + 1])} className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100 disabled:opacity-30" aria-label="Mes siguiente"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-tinta-3">
        {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: enMes }, (_, i) => {
          const k = `${mes}-${String(i + 1).padStart(2, "0")}`;
          const libres = dias.get(k)?.filter((h) => h.libre).length ?? 0;
          const activo = k === dia;
          return (
            <button key={k} disabled={!libres} onClick={() => setDia(k)}
              className={cx("relative grid aspect-square place-items-center rounded-xl text-sm tabular-nums transition-all duration-150",
                activo ? "bg-acento font-semibold text-white shadow-suave" : libres ? "bg-acento-suave font-semibold text-acento hover:ring-2 hover:ring-acento/40" : "text-tinta-3")}>
              {i + 1}
              {k === hoy && <span className={cx("absolute bottom-1.5 size-1 rounded-full", activo ? "bg-white" : "bg-acento")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Horas({ dia, horas, onHora }: { dia: string; horas: Horario[]; onHora: (h: string) => void }) {
  const libres = horas.filter((h) => h.libre);
  const manana = horas.filter((h) => +fmtHora(h.horario).split(":")[0] < 13);
  const tarde = horas.filter((h) => +fmtHora(h.horario).split(":")[0] >= 13);
  const d = fmtDiaCorto(`${dia}T18:00:00Z`);
  return (
    <div className="animate-entra">
      <h2 className="text-[15px] font-semibold">
        {d.semana} {d.num} {d.mes}
        {["Hoy", "Mañana"].includes(etiquetaDia(`${dia}T18:00:00Z`)) && <span className="ml-1.5 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-tinta-2">{etiquetaDia(`${dia}T18:00:00Z`)}</span>}
      </h2>
      {!libres.length && <p className="mt-3 text-sm text-tinta-2">Este día ya está lleno.</p>}
      {[["Por la mañana", manana], ["Por la tarde", tarde]].map(([t, hs]) => (hs as Horario[]).length ? (
        <div key={t as string} className="mt-4">
          <p className="mb-2 text-xs font-medium text-tinta-3">{t as string}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {(hs as Horario[]).map((h) => (
              <button key={h.horario} disabled={!h.libre} onClick={() => onHora(h.horario)}
                className={cx("h-11 rounded-xl text-[15px] font-medium tabular-nums ring-1 transition-all duration-150 active:scale-[0.97]",
                  h.libre ? "bg-superficie text-acento ring-acento/30 hover:bg-acento hover:text-white hover:ring-acento" : "cursor-not-allowed text-tinta-3 line-through ring-borde/60")}>
                {fmtHora(h.horario)}
              </button>
            ))}
          </div>
        </div>
      ) : null)}
    </div>
  );
}

function Fila({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-tinta-3">{icono}</span>
      <span>{children}</span>
    </div>
  );
}

/* ───────────── Paso 2: datos ───────────── */

function Datos({ hora, info, onVolver, onApartada, onOcupado }: {
  hora: string; info: Info; onVolver: () => void; onApartada: (c: Cita, svg: string | null, tel: string) => void; onOcupado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [tocado, setTocado] = useState({ nombre: false, tel: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const digitos = tel.replace(/\D/g, "");
  const errNombre = nombre.trim().length < 3 ? "Escribe tu nombre completo" : "";
  const errTel = digitos.length !== 10 ? "Deben ser 10 dígitos" : "";
  const c = info.consultorio;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocado({ nombre: true, tel: true });
    if (errNombre || errTel) return;
    setEnviando(true);
    setError("");
    try {
      const r = await fetch("/api/citas", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ horario: hora, paciente: nombre.trim(), telefono: digitos }),
      });
      const d = await r.json();
      if (r.status === 409) { setError("Alguien acaba de tomar ese horario. Elige otro."); setTimeout(onOcupado, 1500); return; }
      if (!r.ok) throw new Error(d.error);
      const det = await fetch(`/api/citas/${d.cita.id}`).then((x) => x.json());
      onApartada(det.cita, det.qrSvg, digitos);
    } catch (err) {
      setError((err as Error).message || "No pudimos generar el cobro. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mx-auto max-w-xl animate-entra">
      <button type="button" onClick={onVolver} className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-tinta-2 hover:text-tinta">
        <ArrowLeft className="size-4" /> Cambiar horario
      </button>
      <Tarjeta className="mt-3 overflow-hidden">
        <div className="flex items-center gap-4 border-b border-borde bg-stone-50/70 p-5">
          <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-superficie py-1.5 ring-1 ring-borde">
            <span className="text-[11px] font-medium uppercase text-alerta">{fmtDiaCorto(hora).mes}</span>
            <span className="text-xl font-semibold leading-none tabular-nums">{fmtDiaCorto(hora).num}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{fmtDia(hora)} · {fmtHora(hora)} h</p>
            <p className="truncate text-sm text-tinta-2">{c.medica} · {c.duracionMin} min · {c.nombre}</p>
          </div>
        </div>
        <div className="p-5">
          <h1 className="text-lg font-semibold tracking-tight">Tus datos</h1>
          <p className="text-sm text-tinta-2">Solo lo necesario para apartar tu lugar.</p>
          <div className="mt-4">
            <Campo etiqueta="Nombre completo" error={tocado.nombre ? errNombre : ""}>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, nombre: true }))}
                autoComplete="name" autoFocus placeholder="Ana López Hernández" className={entrada(tocado.nombre && !!errNombre)} />
            </Campo>
            <Campo etiqueta="Celular" ayuda="Aquí te llega la solicitud de pago CoDi y el recordatorio" error={tocado.tel ? errTel : ""}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-tinta-3">+52</span>
                <input value={fmtTel(tel)} onChange={(e) => setTel(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, tel: true }))}
                  type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="55 1234 5678" className={cx(entrada(tocado.tel && !!errTel), "pl-12 tabular-nums")} />
              </div>
            </Campo>
          </div>
          {error && <p className="mt-2 flex items-center gap-2 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta"><AlertCircle className="size-4 shrink-0" />{error}</p>}
        </div>
      </Tarjeta>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-fondo p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0">
        <Boton type="submit" cargando={enviando} className="w-full">
          {enviando ? "Apartando tu horario…" : <>Apartar y pagar anticipo · {fmtMonto(info.anticipo)}</>}
        </Boton>
        <p className="mt-2 text-center text-xs text-tinta-3">Te guardamos el horario {info.minutosApartado} min mientras pagas. Sin pago, no hay cargo.</p>
      </div>
    </form>
  );
}

const entrada = (mal: boolean) =>
  cx("h-12 w-full rounded-xl bg-superficie px-3.5 text-base ring-1 ring-inset transition-shadow placeholder:text-tinta-3 focus:outline-none focus:ring-2",
    mal ? "ring-alerta/60 focus:ring-alerta" : "ring-borde focus:ring-acento");

function Campo({ etiqueta, ayuda, error, children }: { etiqueta: string; ayuda?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      {children}
      <span className={cx("mt-1 block min-h-4 text-xs", error ? "text-alerta" : "text-tinta-3")}>{error || ayuda}</span>
    </label>
  );
}

/* ───────────── Paso 3: pago (estilo Stripe Checkout) ───────────── */

function Pago({ cita, qrSvg, info, telefono, onCita, onQr, onReiniciar }: {
  cita: Cita; qrSvg: string | null; info: Info | null; telefono: string; onCita: (c: Cita) => void; onQr: (s: string | null) => void; onReiniciar: () => void;
}) {
  const [ahora, setAhora] = useState(Date.now());
  const [metodo, setMetodo] = useState<"celular" | "qr">("qr");
  const [enviando, setEnviando] = useState(false);
  const [errorPn, setErrorPn] = useState("");
  const [simulando, setSimulando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [renovando, setRenovando] = useState(false);

  // En el celular no se puede escanear la propia pantalla: ahí lo natural es el cobro al celular.
  useEffect(() => { if (matchMedia("(pointer: coarse)").matches) setMetodo("celular"); }, []);

  const refrescar = useCallback(async () => {
    const r = await fetch(`/api/citas/${cita.id}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d = await r.json();
    onCita(d.cita);
    if (d.qrSvg) onQr(d.qrSvg);
  }, [cita.id, onCita, onQr]);

  useEffect(() => {
    if (cita.estado !== "apartada") return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    const s = setInterval(refrescar, 2000);
    return () => { clearInterval(t); clearInterval(s); };
  }, [cita.estado, refrescar]);

  const accion = async (a: string) =>
    fetch(`/api/citas/${cita.id}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: a, quien: "paciente" }) });

  async function cobrarCelular() {
    setEnviando(true);
    setErrorPn("");
    const r = await accion("cobro_celular");
    if (!r.ok) setErrorPn((await r.json().catch(() => ({}))).error ?? "No se pudo enviar");
    await refrescar();
    setEnviando(false);
  }
  async function simular() {
    setSimulando(true);
    await fetch(`/api/simular/${cita.id}?metodo=${metodo === "celular" && cita.pnEnviado ? "celular" : "qr"}`, { method: "POST" });
    await refrescar();
    setSimulando(false);
  }
  async function cancelar() {
    setCancelando(true);
    await accion("cancelar");
    onReiniciar();
  }
  async function renovar() {
    setRenovando(true);
    const r = await accion("renovar_qr");
    await refrescar();
    setRenovando(false);
    if (!r.ok) onReiniciar();
  }

  const restante = cita.venceEn - ahora;
  const total = Math.max(1, cita.venceEn - cita.creada);
  const c = info?.consultorio;

  if (cita.estado === "confirmada") return <Confirmada cita={cita} info={info} onOtra={onReiniciar} />;
  if (cita.estado !== "apartada")
    return (
      <div className="mx-auto max-w-md animate-entra pt-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-stone-100"><Clock className="size-6 text-tinta-2" /></div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {cita.estado === "expirada" ? "Se acabó el tiempo para pagar" : cita.estado === "cancelada" ? "Este apartado se canceló" : "Tu pago llegó tarde"}
        </h1>
        <p className="mt-2 text-[15px] text-tinta-2">
          {cita.estado === "pago_tardio"
            ? "El horario ya lo había tomado otra persona. Te devolveremos el anticipo a la misma cuenta."
            : "No se hizo ningún cargo. Si el horario sigue libre puedes intentarlo de nuevo."}
        </p>
        <div className="mt-6 space-y-2">
          {cita.estado === "expirada" && <Boton className="w-full" cargando={renovando} onClick={renovar}>Intentar de nuevo con {fmtHora(cita.horario)} h</Boton>}
          <Boton variante={cita.estado === "expirada" ? "fantasma" : "primario"} className="w-full" onClick={onReiniciar}>Elegir otro horario</Boton>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl animate-entra">
      <button onClick={cancelar} disabled={cancelando} className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-tinta-2 hover:text-tinta">
        {cancelando ? <Spinner className="size-3.5" /> : <ArrowLeft className="size-4" />} Cancelar y cambiar horario
      </button>
      <div className="mt-3 grid gap-6 md:grid-cols-[1fr_1.1fr] md:gap-10">
        {/* Resumen (izquierda en escritorio, abajo en móvil) */}
        <div className="order-2 md:order-1 md:pt-1">
          <p className="text-sm text-tinta-2">Anticipo para confirmar tu cita</p>
          <p className="mt-0.5 text-4xl font-semibold tracking-tight tabular-nums">{fmtMonto(cita.monto)}</p>
          <div className="mt-5 divide-y divide-borde overflow-hidden rounded-2xl bg-superficie ring-1 ring-borde">
            <Linea k="Consulta" v={`${c?.medica ?? ""} · ${c?.duracionMin ?? 30} min`} />
            <Linea k="Cuándo" v={`${etiquetaDia(cita.horario)} · ${fmtHora(cita.horario)} h`} />
            <Linea k="Paciente" v={cita.paciente} />
            <Linea k="Total hoy" v={fmtMonto(cita.monto)} fuerte />
          </div>
          <ul className="mt-4 space-y-2 text-xs text-tinta-2">
            <li className="flex gap-2"><Check className="size-3.5 shrink-0 text-ok" />Se descuenta del total de tu consulta.</li>
            <li className="flex gap-2"><Check className="size-3.5 shrink-0 text-ok" />Sin pago a tiempo, el horario se libera y no hay cargo.</li>
            <li className="flex gap-2"><Check className="size-3.5 shrink-0 text-ok" />CoDi es de Banxico: el dinero va directo de tu banco, sin tarjeta.</li>
          </ul>
        </div>

        {/* Tarjeta de pago */}
        <Tarjeta className="order-1 overflow-hidden md:order-2">
          <div className="h-1 bg-stone-100">
            <div className={cx("h-full transition-[width] duration-1000 ease-linear", restante < 120_000 ? "bg-alerta" : "bg-acento")} style={{ width: `${Math.max(0, (restante / total) * 100)}%` }} />
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-espera opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-espera" />
                </span>
                Esperando tu pago
              </span>
              <span className={cx("rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums", restante < 120_000 ? "bg-alerta-suave text-alerta" : "bg-stone-100 text-tinta")}>{reloj(restante)}</span>
            </div>
            <p className="mt-1 text-xs text-tinta-3">Tu horario está apartado {restante < 120_000 ? "solo unos minutos más" : "mientras corre el reloj"}</p>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-sm font-medium">
              {([["celular", "Al celular", Smartphone], ["qr", "Código QR", QrCode]] as const).map(([k, t, I]) => (
                <button key={k} onClick={() => setMetodo(k)} className={cx("inline-flex h-9 items-center justify-center gap-2 rounded-lg transition", metodo === k ? "bg-superficie text-tinta shadow-suave" : "text-tinta-2 hover:text-tinta")}>
                  <I className="size-4" />{t}
                </button>
              ))}
            </div>

            {metodo === "qr" ? (
              <div className="animate-entra">
                <div className="mx-auto mt-5 w-full max-w-[232px] rounded-2xl bg-white p-3 ring-1 ring-borde">
                  {qrSvg ? <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <Esqueleto className="aspect-square w-full" />}
                </div>
                <ol className="mt-5 space-y-2.5 text-sm">
                  {["Abre la app de tu banco", "Entra a CoDi y elige pagar con QR", "Escanea el código y confirma"].map((t, i) => (
                    <li key={t} className="flex items-center gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-tinta-2">{i + 1}</span>
                      <span className="text-tinta-2">{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="animate-entra pt-5 text-center">
                <div className={cx("mx-auto grid size-16 place-items-center rounded-2xl", cita.pnEnviado ? "bg-acento-suave text-acento" : "bg-stone-100 text-tinta-2")}>
                  {cita.pnEnviado ? <BellRing className="size-7 animate-pulso" /> : <Smartphone className="size-7" />}
                </div>
                {cita.pnEnviado ? (
                  <>
                    <p className="mt-4 font-semibold">Revisa la app de tu banco</p>
                    <p className="mt-1 text-sm text-tinta-2">Te llegó una solicitud de {fmtMonto(cita.monto)} de {c?.nombre}{telefono ? ` al ${fmtTel(telefono).slice(0, 2)} •••• ${telefono.slice(-4)}` : ""}. Ábrela y autoriza el pago.</p>
                    <button onClick={cobrarCelular} disabled={enviando} className="mt-3 text-sm font-medium text-acento hover:underline disabled:opacity-50">{enviando ? "Reenviando…" : "¿No llegó? Reenviar"}</button>
                  </>
                ) : (
                  <>
                    <p className="mt-4 font-semibold">Paga sin escanear nada</p>
                    <p className="mt-1 text-sm text-tinta-2">Te mandamos la solicitud de cobro CoDi a tu celular{telefono ? ` (${fmtTel(telefono).slice(0, 2)} •••• ${telefono.slice(-4)})` : ""}. Solo la autorizas en la app de tu banco.</p>
                    <Boton className="mt-4 w-full" cargando={enviando} onClick={cobrarCelular}>Enviar solicitud a mi celular</Boton>
                  </>
                )}
                {errorPn && <p className="mt-3 rounded-lg bg-alerta-suave px-3 py-2 text-left text-sm text-alerta">{errorPn}</p>}
                <p className="mt-4 text-xs text-tinta-3">Necesitas CoDi activado en tu banco. Si no, usa el código QR desde otro dispositivo.</p>
              </div>
            )}

            {info?.modo === "simulado" && (
              <Boton variante="secundario" className="mt-5 w-full" cargando={simulando} onClick={simular}>Simular pago (modo demo)</Boton>
            )}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

function Linea({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4 px-4 py-3 text-sm", fuerte && "bg-stone-50")}>
      <span className="text-tinta-2">{k}</span>
      <span className={cx("text-right", fuerte ? "font-semibold tabular-nums" : "font-medium")}>{v}</span>
    </div>
  );
}

/* ───────────── Confirmación ───────────── */

function Confirmada({ cita, info, onOtra }: { cita: Cita; info: Info | null; onOtra: () => void }) {
  const c = info?.consultorio;
  const ev = {
    inicio: cita.horario, minutos: c?.duracionMin ?? 30,
    titulo: `Consulta · ${c?.nombre ?? "Consultorio"}`, lugar: c?.direccion ?? "",
    detalle: `Cita confirmada con anticipo CoDi de ${fmtMonto(cita.monto)}. Ref. ${cita.numRef}`,
  };
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  function descargarIcs() {
    const url = URL.createObjectURL(new Blob([ics({ ...ev, uid: cita.id })], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `cita-${cita.id}.ics` });
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="mx-auto max-w-md animate-entra pt-2">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-ok-suave ring-8 ring-ok-suave/60">
          <svg viewBox="0 0 24 24" className="size-8 text-ok" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={48} className="animate-dibuja" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">¡Listo, {cita.paciente.split(" ")[0]}! Tu cita está confirmada</h1>
        <p className="mt-1.5 text-[15px] text-tinta-2">Recibimos tu anticipo de {fmtMonto(cita.monto)}. Te esperamos.</p>
      </div>

      <Tarjeta className="mt-6 overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-stone-50 py-1.5 ring-1 ring-borde">
            <span className="text-[11px] font-medium uppercase text-alerta">{fmtDiaCorto(cita.horario).mes}</span>
            <span className="text-xl font-semibold leading-none tabular-nums">{fmtDiaCorto(cita.horario).num}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{fmtDia(cita.horario)}</p>
            <p className="text-sm text-tinta-2">{fmtHora(cita.horario)} h · {c?.duracionMin ?? 30} min</p>
          </div>
          <Insignia estado="confirmada" />
        </div>
        <div className="space-y-2.5 border-t border-borde p-5 text-sm text-tinta-2">
          <Fila icono={<Stethoscope className="size-4" />}>{c?.medica} · {c?.especialidad}</Fila>
          <Fila icono={<MapPin className="size-4" />}>{c?.direccion}</Fila>
          <Fila icono={<Check className="size-4" />}>Anticipo pagado por CoDi · Ref. {cita.numRef}</Fila>
        </div>
      </Tarjeta>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={googleCal(ev)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie text-sm font-medium ring-1 ring-borde transition hover:bg-stone-50 active:scale-[0.98]">
          <CalendarPlus className="size-4" /> Google Calendar
        </a>
        <button onClick={descargarIcs} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie text-sm font-medium ring-1 ring-borde transition hover:bg-stone-50 active:scale-[0.98]">
          <Download className="size-4" /> Apple / Outlook
        </button>
        <a href={mapa(c?.direccion ?? "")} target="_blank" rel="noreferrer" className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie text-sm font-medium ring-1 ring-borde transition hover:bg-stone-50 active:scale-[0.98]">
          <Navigation className="size-4" /> Cómo llegar
        </a>
      </div>
      <p className="mt-4 text-center text-xs text-tinta-3">Antes de tu cita te mandamos un recordatorio por WhatsApp.</p>
      <Boton variante="fantasma" className="mt-2 w-full" onClick={onOtra}>Agendar otra cita</Boton>
    </div>
  );
}
