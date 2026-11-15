"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, CalendarPlus, Check, Clock, Download, MapPin, RefreshCw, ShieldCheck, Smartphone, Stethoscope,
} from "lucide-react";
import { claveDia, fmtDia, fmtDiaCorto, fmtHora, fmtMonto, fmtTel, googleCal, ics, type Estado } from "./formato";
import { Boton, Esqueleto, Insignia, Spinner, Tarjeta, cx } from "./ui";

type Horario = { horario: string; libre: boolean };
type Consultorio = { nombre: string; medica: string; especialidad: string; direccion: string; duracionMin: number };
type Cita = {
  id: string; horario: string; paciente: string; monto: number; estado: Estado; venceEn: number; creada: number;
  numRef: string; transactionId?: string; pagada?: number;
};
type Info = { horarios: Horario[]; anticipo: number; modo: string; consultorio: Consultorio; minutosApartado: number };

export default function Paciente() {
  const [info, setInfo] = useState<Info | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [cita, setCita] = useState<Cita | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setErrorCarga(false);
    try {
      const r = await fetch("/api/horarios", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = (await r.json()) as Info;
      setInfo(d);
      setDia((act) => act ?? (d.horarios.find((h) => h.libre) ? claveDia(d.horarios.find((h) => h.libre)!.horario) : null));
    } catch {
      setErrorCarga(true);
    }
  }, []);

  // Recupera la cita en curso si se recarga la página (?cita=c0001).
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

  const abrirCita = (c: Cita, svg: string | null) => {
    setCita(c);
    setQrSvg(svg);
    history.replaceState(null, "", `/?cita=${c.id}`);
    window.scrollTo({ top: 0 });
  };
  const reiniciar = () => {
    setCita(null);
    setQrSvg(null);
    setHora(null);
    history.replaceState(null, "", "/");
    cargar();
  };

  return (
    <div className="min-h-dvh">
      <Barra consultorio={info?.consultorio} modo={info?.modo} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8">
        {cita ? (
          <Pago cita={cita} qrSvg={qrSvg} info={info} onCita={setCita} onQr={setQrSvg} onReiniciar={reiniciar} />
        ) : (
          <Reservar
            info={info} errorCarga={errorCarga} reintentar={cargar}
            dia={dia} setDia={(d) => { setDia(d); setHora(null); }} hora={hora} setHora={setHora}
            onApartada={abrirCita}
          />
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

/* ───────────── Paso 1–3: día, hora y datos ───────────── */

function Reservar(p: {
  info: Info | null; errorCarga: boolean; reintentar: () => void;
  dia: string | null; setDia: (d: string) => void; hora: string | null; setHora: (h: string | null) => void;
  onApartada: (c: Cita, svg: string | null) => void;
}) {
  const { info } = p;
  const dias = useMemo(() => {
    const m = new Map<string, Horario[]>();
    for (const h of info?.horarios ?? []) m.set(claveDia(h.horario), [...(m.get(claveDia(h.horario)) ?? []), h]);
    return [...m.entries()];
  }, [info]);
  const horasDelDia = dias.find(([k]) => k === p.dia)?.[1] ?? [];
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.hora) setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [p.hora]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
      <section className="min-w-0 animate-entra">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Agenda tu consulta</h1>
        <p className="mt-1.5 text-[15px] text-tinta-2">
          Elige un horario y confírmalo con un anticipo por CoDi. Se descuenta del total de la consulta.
        </p>

        <Resumen info={info} className="mt-5 lg:hidden" />

        {p.errorCarga ? (
          <Tarjeta className="mt-6 flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="size-6 text-alerta" />
            <div>
              <p className="font-medium">No pudimos cargar la agenda</p>
              <p className="text-sm text-tinta-2">Revisa tu conexión e inténtalo de nuevo.</p>
            </div>
            <Boton variante="secundario" onClick={p.reintentar}><RefreshCw className="size-4" />Reintentar</Boton>
          </Tarjeta>
        ) : !info ? (
          <div className="mt-6 space-y-4">
            <div className="flex gap-2">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-[72px] w-20" />)}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Esqueleto key={i} className="h-11" />)}</div>
          </div>
        ) : dias.length === 0 || !info.horarios.some((h) => h.libre) ? (
          <Tarjeta className="mt-6 flex flex-col items-center gap-2 p-10 text-center">
            <Clock className="size-6 text-tinta-3" />
            <p className="font-medium">No hay horarios disponibles</p>
            <p className="text-sm text-tinta-2">Todos los lugares de los próximos días están ocupados. Vuelve a revisar más tarde.</p>
          </Tarjeta>
        ) : (
          <>
            <Paso n={1} titulo="Elige el día" className="mt-7" />
            <div className="sin-barra -mx-4 mt-3 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {dias.map(([k, hs]) => {
                const libres = hs.filter((h) => h.libre).length;
                const d = fmtDiaCorto(hs[0].horario);
                const activo = k === p.dia;
                return (
                  <button
                    key={k} disabled={!libres} onClick={() => p.setDia(k)}
                    className={cx(
                      "flex min-w-[84px] snap-start flex-col items-center rounded-xl px-3 py-2.5 ring-1 transition-all duration-150 active:scale-[0.97]",
                      activo ? "bg-acento text-white ring-acento shadow-suave" : "bg-superficie ring-borde hover:ring-borde-fuerte",
                      !libres && "opacity-40",
                    )}
                  >
                    <span className={cx("text-xs font-medium", activo ? "text-white/80" : "text-tinta-2")}>{d.semana}</span>
                    <span className="text-xl font-semibold leading-tight tabular-nums">{d.num}</span>
                    <span className={cx("text-[11px]", activo ? "text-white/80" : "text-tinta-3")}>{libres ? `${libres} libres` : "Lleno"}</span>
                  </button>
                );
              })}
            </div>

            <Paso n={2} titulo="Elige la hora" className="mt-7" />
            <div key={p.dia} className="mt-3 grid animate-entra grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {horasDelDia.map((h) => {
                const activo = p.hora === h.horario;
                return (
                  <button
                    key={h.horario} disabled={!h.libre} onClick={() => p.setHora(activo ? null : h.horario)}
                    className={cx(
                      "h-11 rounded-xl text-[15px] font-medium tabular-nums ring-1 transition-all duration-150 active:scale-[0.97]",
                      activo ? "bg-acento-suave text-acento ring-2 ring-acento" : "bg-superficie ring-borde hover:ring-acento/50 hover:text-acento",
                      !h.libre && "cursor-not-allowed bg-transparent text-tinta-3 line-through ring-borde/60 hover:text-tinta-3 hover:ring-borde/60",
                    )}
                  >
                    {fmtHora(h.horario)}
                  </button>
                );
              })}
            </div>

            <div ref={formRef} className="scroll-mt-20">
              {p.hora && <Datos hora={p.hora} info={info} onApartada={p.onApartada} onOcupado={() => { p.setHora(null); p.reintentar(); }} />}
            </div>
          </>
        )}
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-24"><Resumen info={info} hora={p.hora} /></div>
      </aside>
    </div>
  );
}

function Paso({ n, titulo, className }: { n: number; titulo: string; className?: string }) {
  return (
    <h2 className={cx("flex items-center gap-2.5 text-[15px] font-semibold", className)}>
      <span className="grid size-6 place-items-center rounded-full bg-tinta text-xs text-white">{n}</span>
      {titulo}
    </h2>
  );
}

function Resumen({ info, hora, className }: { info: Info | null; hora?: string | null; className?: string }) {
  const c = info?.consultorio;
  return (
    <Tarjeta className={cx("p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-acento-suave text-sm font-semibold text-acento">ER</div>
        <div className="min-w-0">
          <p className="font-semibold">{c?.medica ?? "\u00a0"}</p>
          <p className="text-sm text-tinta-2">{c?.especialidad}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <Fila icono={<Clock className="size-4" />}>Consulta de {c?.duracionMin ?? 30} min</Fila>
        <Fila icono={<MapPin className="size-4" />}>{c?.direccion ?? "—"}</Fila>
        <Fila icono={<ShieldCheck className="size-4" />}>Anticipo {info ? fmtMonto(info.anticipo) : "—"} por CoDi, sin comisión</Fila>
      </dl>
      {hora && (
        <div className="mt-4 animate-entra rounded-xl bg-acento-suave p-3 text-sm text-acento ring-1 ring-inset ring-acento-borde">
          <p className="font-medium">{fmtDia(hora)}</p>
          <p>{fmtHora(hora)} h</p>
        </div>
      )}
    </Tarjeta>
  );
}

function Fila({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-tinta-2">
      <span className="mt-0.5 text-tinta-3">{icono}</span>
      <span>{children}</span>
    </div>
  );
}

function Datos({ hora, info, onApartada, onOcupado }: {
  hora: string; info: Info; onApartada: (c: Cita, svg: string | null) => void; onOcupado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [tocado, setTocado] = useState({ nombre: false, tel: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const digitos = tel.replace(/\D/g, "");
  const errNombre = nombre.trim().length < 3 ? "Escribe tu nombre completo" : "";
  const errTel = digitos.length !== 10 ? "Deben ser 10 dígitos" : "";
  const valido = !errNombre && !errTel;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocado({ nombre: true, tel: true });
    if (!valido) return;
    setEnviando(true);
    setError("");
    try {
      const r = await fetch("/api/citas", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ horario: hora, paciente: nombre.trim(), telefono: digitos }),
      });
      const d = await r.json();
      if (r.status === 409) { setError("Alguien acaba de tomar ese horario. Elige otro."); onOcupado(); return; }
      if (!r.ok) throw new Error(d.error);
      const det = await fetch(`/api/citas/${d.cita.id}`).then((x) => x.json());
      onApartada(det.cita, det.qrSvg);
    } catch (err) {
      setError((err as Error).message || "No pudimos generar el cobro. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-7 animate-entra" noValidate>
      <Paso n={3} titulo="Tus datos" />
      <Tarjeta className="mt-3 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-borde">
          <span className="text-tinta-2">{fmtDia(hora)}</span>
          <span className="font-semibold tabular-nums">{fmtHora(hora)} h</span>
        </div>
        <Campo etiqueta="Nombre completo" error={tocado.nombre ? errNombre : ""}>
          <input
            value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, nombre: true }))}
            autoComplete="name" placeholder="Ana López Hernández" className={entrada(tocado.nombre && !!errNombre)}
          />
        </Campo>
        <Campo etiqueta="Celular" ayuda="Para avisarte si cambia algo de tu cita" error={tocado.tel ? errTel : ""}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-tinta-3">+52</span>
            <input
              value={fmtTel(tel)} onChange={(e) => setTel(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, tel: true }))}
              inputMode="numeric" autoComplete="tel-national" placeholder="55 1234 5678" className={cx(entrada(tocado.tel && !!errTel), "pl-12 tabular-nums")}
            />
          </div>
        </Campo>
        {error && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta"><AlertCircle className="size-4 shrink-0" />{error}</p>
        )}
      </Tarjeta>

      {/* Botón fijo abajo en móvil, en línea en escritorio */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-fondo p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Boton type="submit" cargando={enviando} className="w-full sm:w-auto">
          {enviando ? "Generando cobro…" : <>Continuar al pago · {fmtMonto(info.anticipo)}</>}
        </Boton>
        <p className="mt-2 text-center text-xs text-tinta-3 sm:text-left">Te guardamos el horario {info.minutosApartado} min mientras pagas.</p>
      </div>
    </form>
  );
}

const entrada = (mal: boolean) =>
  cx(
    "h-12 w-full rounded-xl bg-superficie px-3.5 text-base ring-1 ring-inset transition-shadow placeholder:text-tinta-3 focus:outline-none focus:ring-2",
    mal ? "ring-alerta/60 focus:ring-alerta" : "ring-borde focus:ring-acento",
  );

function Campo({ etiqueta, ayuda, error, children }: { etiqueta: string; ayuda?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first-of-type:mt-0">
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      {children}
      <span className={cx("mt-1 block text-xs", error ? "text-alerta" : "text-tinta-3")}>{error || ayuda || " "}</span>
    </label>
  );
}

/* ───────────── Pago y confirmación ───────────── */

function Pago({ cita, qrSvg, info, onCita, onQr, onReiniciar }: {
  cita: Cita; qrSvg: string | null; info: Info | null; onCita: (c: Cita) => void; onQr: (s: string | null) => void; onReiniciar: () => void;
}) {
  const [ahora, setAhora] = useState(Date.now());
  const [simulando, setSimulando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    if (cita.estado !== "apartada") return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    const sondeo = setInterval(async () => {
      const r = await fetch(`/api/citas/${cita.id}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      onCita(d.cita);
      if (d.qrSvg) onQr(d.qrSvg);
    }, 2000);
    return () => { clearInterval(reloj); clearInterval(sondeo); };
  }, [cita.estado, cita.id, onCita, onQr]);

  const restante = Math.max(0, Math.ceil((cita.venceEn - ahora) / 1000));
  const total = Math.max(1, Math.round((cita.venceEn - cita.creada) / 1000));

  async function simular() {
    setSimulando(true);
    await fetch(`/api/simular/${cita.id}`, { method: "POST" });
    const d = await fetch(`/api/citas/${cita.id}`).then((r) => r.json());
    onCita(d.cita);
    setSimulando(false);
  }
  async function cancelar() {
    setCancelando(true);
    await fetch(`/api/citas/${cita.id}/cancelar`, { method: "POST" });
    onReiniciar();
  }

  if (cita.estado === "confirmada") return <Confirmada cita={cita} info={info} onOtra={onReiniciar} />;
  if (cita.estado === "expirada" || cita.estado === "pago_tardio")
    return (
      <div className="mx-auto max-w-md animate-entra pt-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-stone-100"><Clock className="size-6 text-tinta-2" /></div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {cita.estado === "expirada" ? "Se acabó el tiempo para pagar" : "Tu pago llegó tarde"}
        </h1>
        <p className="mt-2 text-[15px] text-tinta-2">
          {cita.estado === "expirada"
            ? "Liberamos el horario para otra persona. No se hizo ningún cargo."
            : "El horario ya lo había tomado otra persona. Te devolveremos el anticipo a la misma cuenta."}
        </p>
        <Boton className="mt-6 w-full" onClick={onReiniciar}>Elegir otro horario</Boton>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl animate-entra">
      <button onClick={cancelar} disabled={cancelando} className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-tinta-2 hover:text-tinta">
        {cancelando ? <Spinner className="size-3.5" /> : <ArrowLeft className="size-4" />} Cambiar horario
      </button>
    <div className="mt-3 grid gap-6 md:grid-cols-[1fr_1.1fr] md:gap-8">
      {/* Resumen de la orden (izquierda en escritorio, debajo del QR en móvil) */}
      <div className="order-2 md:order-1 md:pt-1">
        <p className="text-sm text-tinta-2">Anticipo para confirmar tu cita</p>
        <p className="mt-0.5 text-4xl font-semibold tracking-tight tabular-nums">{fmtMonto(cita.monto)}</p>
        <div className="mt-5 divide-y divide-borde overflow-hidden rounded-2xl bg-superficie ring-1 ring-borde">
          <Linea k="Consulta" v={`${info?.consultorio.medica ?? ""} · ${info?.consultorio.especialidad ?? ""}`} />
          <Linea k="Fecha" v={fmtDia(cita.horario)} />
          <Linea k="Hora" v={`${fmtHora(cita.horario)} h`} />
          <Linea k="Paciente" v={cita.paciente} />
          <Linea k="Total hoy" v={fmtMonto(cita.monto)} fuerte />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-tinta-3">
          El anticipo se descuenta del total de tu consulta. Si no pagas a tiempo, el horario se libera y no se hace ningún cargo.
        </p>
      </div>

      {/* Tarjeta de pago CoDi */}
      <Tarjeta className="order-1 overflow-hidden md:order-2">
        <div className="h-1 bg-stone-100">
          <div className="h-full bg-acento transition-[width] duration-1000 ease-linear" style={{ width: `${(restante / total) * 100}%` }} />
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
            <span className={cx("rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums", restante < 60 ? "bg-alerta-suave text-alerta" : "bg-stone-100 text-tinta")}>
              {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")}
            </span>
          </div>
          <p className="mt-1 text-xs text-tinta-3">Tiempo que te guardamos el horario</p>

          <div className="mx-auto mt-5 w-full max-w-[248px] rounded-2xl bg-white p-3 ring-1 ring-borde">
            {qrSvg ? <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <Esqueleto className="aspect-square w-full" />}
          </div>
          <p className="mt-2 text-center text-xs font-medium tracking-wide text-tinta-3">PAGA CON CoDi®</p>

          <ol className="mt-5 space-y-2.5 text-sm">
            {["Abre la app de tu banco", "Entra a CoDi y elige pagar con QR", "Escanea el código y confirma"].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-tinta-2">{i + 1}</span>
                <span className="text-tinta-2">{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-xs text-tinta-2 ring-1 ring-inset ring-borde">
            <Smartphone className="size-4 shrink-0 text-tinta-3" />
            ¿Estás en el celular? Toma captura del código y súbela desde la app de tu banco.
          </p>

          {info?.modo === "simulado" && (
            <Boton variante="secundario" className="mt-4 w-full" cargando={simulando} onClick={simular}>
              Simular pago (modo demo)
            </Boton>
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
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">¡Tu cita está confirmada!</h1>
        <p className="mt-1.5 text-[15px] text-tinta-2">Recibimos tu anticipo. Te esperamos.</p>
      </div>

      <Tarjeta className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <Insignia estado="confirmada" />
          <span className="text-xs text-tinta-3">Ref. {cita.numRef}</span>
        </div>
        <p className="mt-3 text-lg font-semibold">{fmtDia(cita.horario)}</p>
        <p className="text-[15px] text-tinta-2">{fmtHora(cita.horario)} h · {c?.duracionMin ?? 30} min</p>
        <div className="mt-4 space-y-2 border-t border-borde pt-4 text-sm">
          <Fila icono={<Stethoscope className="size-4" />}>{c?.medica} · {c?.especialidad}</Fila>
          <Fila icono={<MapPin className="size-4" />}>{c?.direccion}</Fila>
          <Fila icono={<Check className="size-4" />}>Anticipo pagado: {fmtMonto(cita.monto)} por CoDi</Fila>
        </div>
      </Tarjeta>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={googleCal(ev)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie text-sm font-medium ring-1 ring-borde transition hover:bg-stone-50 active:scale-[0.98]">
          <CalendarPlus className="size-4" /> Google Calendar
        </a>
        <button onClick={descargarIcs} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie text-sm font-medium ring-1 ring-borde transition hover:bg-stone-50 active:scale-[0.98]">
          <Download className="size-4" /> Apple / Outlook
        </button>
      </div>
      <Boton variante="fantasma" className="mt-3 w-full" onClick={onOtra}>Agendar otra cita</Boton>
    </div>
  );
}
