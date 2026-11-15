"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, Clock, Copy, ExternalLink,
  Inbox, List, MessageCircle, MoreHorizontal, Phone, Plus, QrCode, RotateCcw, Search, Share2, Smartphone, Stethoscope,
  Undo2, UserCheck, UserX, X, XCircle,
} from "lucide-react";
import {
  ESTADOS, claveDia, cuandoFue, etiquetaDia, falta, fmtDia, fmtHora, fmtMonto, fmtTel, horaDe, reloj, type Estado,
} from "../formato";
import { Avatar, Avisos, Esqueleto, Hoja, Insignia, Kbd, Menu, OpcionMenu, Tarjeta, cx, useAviso } from "../ui";

type Reembolso = { tx: string; monto: number; motivo: string; creado: number; hecho?: number };
type Cita = {
  id: string; horario: string; paciente: string; telefono: string; monto: number; estado: Estado; creada: number; venceEn: number;
  pagada?: number; transactionId?: string; numRef: string; pnEnviado?: number; canceladaPor?: string;
  asistencia?: "asistio" | "no_asistio"; recordatorios?: number[]; reembolsos?: Reembolso[];
};
type Evento = { t: number; cita?: string; tipo: string; detalle?: string };
type Datos = {
  citas: Cita[]; eventos: Evento[]; modo: string; horas: [number, number]; ahora: number;
  consultorio: { nombre: string; medica: string; direccion: string; duracionMin: number };
};
type Filtro = "todas" | Estado | "devolver";
type Vista = "lista" | "calendario";

const pendientes = (c: Cita) => (c.reembolsos ?? []).filter((r) => !r.hecho);
const URGENTE_MS = 2 * 60_000;

export default function Pagina() {
  return <Avisos><Consultorio /></Avisos>;
}

function Consultorio() {
  const avisar = useAviso();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [vista, setVista] = useState<Vista>("lista");
  const [dia, setDia] = useState<string | null>(null); // null = próximos
  const [ahora, setAhora] = useState(Date.now());
  const [resaltar, setResaltar] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [buscar, setBuscar] = useState(false);
  const previo = useRef<Map<string, Estado> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/citas", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = (await r.json()) as Datos;
      if (previo.current) {
        const cambio = new Set(d.citas.filter((c) => previo.current!.get(c.id) !== c.estado).map((c) => c.id));
        const pagos = d.citas.filter((c) => c.estado === "confirmada" && previo.current!.get(c.id) === "apartada");
        pagos.forEach((c) => avisar(`${c.paciente} pagó el anticipo`, "ok"));
        if (cambio.size) { setResaltar(cambio); setTimeout(() => setResaltar(new Set()), 2500); }
      }
      previo.current = new Map(d.citas.map((c) => [c.id, c.estado]));
      setDatos(d);
      setError(false);
    } catch {
      setError(true);
    }
  }, [avisar]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 2500);
    const r = setInterval(() => setAhora(Date.now()), 1000);
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscar((b) => !b); }
    };
    document.addEventListener("keydown", tecla);
    return () => { clearInterval(t); clearInterval(r); document.removeEventListener("keydown", tecla); };
  }, [cargar]);

  const accion = useCallback(async (c: Cita, a: string, okTexto: string) => {
    const r = await fetch(`/api/citas/${c.id}/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: a }) });
    const d = await r.json().catch(() => ({}));
    avisar(r.ok ? okTexto : d.error ?? "No se pudo", r.ok ? "ok" : "error");
    cargar();
  }, [avisar, cargar]);

  const citas = useMemo(() => datos?.citas ?? [], [datos]);
  const hoy = claveDia(new Date(ahora).toISOString());
  const porDevolver = citas.filter((c) => pendientes(c).length);
  const cuenta = (f: Filtro) => f === "todas" ? citas.length : f === "devolver" ? porDevolver.length : citas.filter((c) => c.estado === f).length;

  const visibles = useMemo(() => citas
    .filter((c) => filtro === "todas" || (filtro === "devolver" ? pendientes(c).length : c.estado === filtro))
    .filter((c) => (dia ? claveDia(c.horario) === dia : claveDia(c.horario) >= hoy || c.estado === "apartada" || pendientes(c).length))
    .sort((a, b) => a.horario.localeCompare(b.horario)), [citas, filtro, dia, hoy]);

  const seleccionada = citas.find((c) => c.id === abierta) ?? null;
  const moverDia = (n: number) => {
    const base = new Date(`${dia ?? hoy}T12:00:00Z`).getTime() + n * 86400_000;
    setDia(new Date(base).toISOString().slice(0, 10));
  };
  const etiquetaNav = dia ? etiquetaDia(`${dia}T18:00:00Z`, ahora) : "Próximas";

  return (
    <div className="min-h-dvh">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-borde bg-superficie/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-acento text-white"><Stethoscope className="size-3.5" /></span>
            <span className="hidden truncate text-sm font-semibold sm:inline">{datos?.consultorio.nombre ?? "Consultorio Roble"}</span>
            <span className="hidden text-tinta-3 sm:inline">/</span>
            <span className="text-sm font-medium text-tinta-2">Agenda</span>
          </div>

          <NavDia className="ml-2 hidden md:flex" etiqueta={etiquetaNav} esHoy={dia === hoy} onHoy={() => setDia(dia === hoy ? null : hoy)} onMover={moverDia} onTodas={dia ? () => setDia(null) : undefined} />

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setBuscar(true)} className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-tinta-2 ring-1 ring-borde transition hover:bg-stone-50 hover:text-tinta sm:w-48 sm:px-2.5">
              <Search className="size-4" /><span className="hidden flex-1 text-left sm:inline">Buscar…</span><span className="hidden sm:inline"><Kbd>⌘K</Kbd></span>
            </button>
            <Compartir />
            <a href="/" target="_blank" className="hidden h-8 items-center gap-1.5 rounded-lg bg-tinta px-3 text-sm font-medium text-white transition hover:bg-tinta/90 sm:inline-flex">
              <Plus className="size-4" /> Nueva cita
            </a>
            <span className="ml-1 hidden items-center gap-1.5 text-xs text-tinta-3 lg:inline-flex" title={error ? "Sin conexión" : "Actualizando en vivo"}>
              <span className={cx("size-2 rounded-full", error ? "bg-alerta" : "animate-pulso bg-ok")} />{error ? "Sin conexión" : "En vivo"}
            </span>
          </div>
        </div>
        <div className="border-t border-borde px-4 py-2 md:hidden">
          <NavDia etiqueta={etiquetaNav} esHoy={dia === hoy} onHoy={() => setDia(dia === hoy ? null : hoy)} onMover={moverDia} onTodas={dia ? () => setDia(null) : undefined} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
        {!datos ? <Cargando /> : (
          <>
            <Foco citas={citas} ahora={ahora} hoy={hoy} abrir={setAbierta} accion={accion} consultorio={datos.consultorio} />
            <Metricas citas={citas} ahora={ahora} hoy={hoy} />

            {porDevolver.length > 0 && filtro !== "devolver" && (
              <button onClick={() => setFiltro("devolver")} className="mt-4 flex w-full items-center gap-3 rounded-xl bg-alerta-suave px-4 py-3 text-left text-sm text-alerta ring-1 ring-inset ring-alerta/20 transition hover:ring-alerta/40">
                <AlertTriangle className="size-4 shrink-0" />
                <span className="flex-1">
                  <b>{fmtMonto(porDevolver.reduce((s, c) => s + pendientes(c).reduce((a, r) => a + r.monto, 0), 0))}</b> por devolver a {porDevolver.length === 1 ? porDevolver[0].paciente : `${porDevolver.length} pacientes`}
                </span>
                <span className="inline-flex items-center gap-1 font-medium">Revisar <ArrowRight className="size-3.5" /></span>
              </button>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="sin-barra -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    {(["todas", "confirmada", "apartada", "devolver", "expirada", "cancelada", "pago_tardio"] as Filtro[])
                      .filter((f) => f === "todas" || cuenta(f) > 0 || filtro === f)
                      .map((f) => (
                        <button key={f} onClick={() => setFiltro(f)}
                          className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors",
                            filtro === f ? "bg-tinta text-white" : "text-tinta-2 hover:bg-stone-100 hover:text-tinta")}>
                          {({ todas: "Todas", devolver: "Por devolver", apartada: "Pendientes", confirmada: "Confirmadas", expirada: "Expiradas", cancelada: "Canceladas", pago_tardio: "Pagos tardíos" } as Record<Filtro, string>)[f]}
                          <span className={cx("rounded px-1 text-xs tabular-nums", filtro === f ? "bg-white/20" : "bg-stone-100 text-tinta-3")}>{cuenta(f)}</span>
                        </button>
                      ))}
                  </div>
                  <div className="flex rounded-lg bg-stone-100 p-0.5">
                    {(["lista", "calendario"] as const).map((v) => (
                      <button key={v} onClick={() => setVista(v)}
                        className={cx("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition", vista === v ? "bg-superficie text-tinta shadow-suave" : "text-tinta-2 hover:text-tinta")}>
                        {v === "lista" ? <List className="size-3.5" /> : <CalendarDays className="size-3.5" />}{v === "lista" ? "Lista" : "Calendario"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  {vista === "calendario" ? (
                    <Calendario citas={citas.filter((c) => filtro === "todas" || (filtro === "devolver" ? pendientes(c).length : c.estado === filtro))}
                      desde={dia ?? hoy} horas={datos.horas} ahora={ahora} abrir={setAbierta} resaltar={resaltar} />
                  ) : visibles.length === 0 ? (
                    <Vacio hayCitas={citas.length > 0} limpiar={() => { setFiltro("todas"); setDia(null); }} etiqueta={dia ? etiquetaNav : null} />
                  ) : (
                    <Lista citas={visibles} ahora={ahora} resaltar={resaltar} abrir={setAbierta} accion={accion} consultorio={datos.consultorio} />
                  )}
                </div>
              </section>

              <aside className="min-w-0">
                <Actividad eventos={datos.eventos} citas={citas} ahora={ahora} abrir={setAbierta} />
              </aside>
            </div>
          </>
        )}
      </main>

      <Hoja abierta={!!seleccionada} onCerrar={() => setAbierta(null)} titulo="Detalle de la cita">
        {seleccionada && datos && (
          <Detalle cita={seleccionada} eventos={datos.eventos.filter((e) => e.cita === seleccionada.id)} ahora={ahora}
            cerrar={() => setAbierta(null)} accion={accion} consultorio={datos.consultorio} />
        )}
      </Hoja>

      {buscar && datos && (
        <Comandos citas={citas} cerrar={() => setBuscar(false)} abrir={(id) => { setAbierta(id); setBuscar(false); }}
          ejecutar={(k) => {
            setBuscar(false);
            if (k === "hoy") setDia(hoy);
            if (k === "proximas") setDia(null);
            if (k === "calendario") setVista("calendario");
            if (k === "lista") setVista("lista");
            if (k === "pendientes") setFiltro("apartada");
            if (k === "devolver") setFiltro("devolver");
            if (k === "nueva") window.open("/", "_blank");
            if (k === "copiar") navigator.clipboard?.writeText(location.origin + "/").then(() => avisar("Enlace de reserva copiado", "ok"));
          }} />
      )}
    </div>
  );
}

/* ───────────── Navegación de fecha ───────────── */

function NavDia({ etiqueta, esHoy, onHoy, onMover, onTodas, className }: { etiqueta: string; esHoy: boolean; onHoy: () => void; onMover: (n: number) => void; onTodas?: () => void; className?: string }) {
  return (
    <div className={cx("flex items-center gap-1", className)}>
      <button onClick={onHoy} className={cx("h-8 rounded-lg px-2.5 text-sm font-medium ring-1 transition", esHoy ? "bg-acento-suave text-acento ring-acento-borde" : "ring-borde hover:bg-stone-50")}>Hoy</button>
      <button onClick={() => onMover(-1)} aria-label="Día anterior" className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100"><ChevronLeft className="size-4" /></button>
      <button onClick={() => onMover(1)} aria-label="Día siguiente" className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100"><ChevronRight className="size-4" /></button>
      <span className="ml-1 text-sm font-semibold">{etiqueta}</span>
      {onTodas && <button onClick={onTodas} className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-tinta-3 hover:bg-stone-100 hover:text-tinta"><X className="size-3" />Ver próximas</button>}
    </div>
  );
}

/* ───────────── Franja de foco: siguiente cita y lo urgente ───────────── */

function Foco({ citas, ahora, hoy, abrir, accion, consultorio }: { citas: Cita[]; ahora: number; hoy: string; abrir: (id: string) => void; accion: Acc; consultorio: Datos["consultorio"] }) {
  const futuras = citas.filter((c) => (c.estado === "confirmada" || c.estado === "apartada") && new Date(c.horario).getTime() + 30 * 60_000 > ahora)
    .sort((a, b) => a.horario.localeCompare(b.horario));
  const siguiente = futuras.find((c) => c.estado === "confirmada") ?? futuras[0];
  const deHoy = citas.filter((c) => claveDia(c.horario) === hoy && (c.estado === "confirmada" || c.estado === "apartada"));
  const urgentes = citas.filter((c) => c.estado === "apartada").sort((a, b) => a.venceEn - b.venceEn);

  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
      <Tarjeta className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-tinta-3">
          <span>Siguiente cita</span>
          <span className="normal-case tracking-normal">{deHoy.length ? `Hoy: ${deHoy.length} ${deHoy.length === 1 ? "cita" : "citas"}` : "Hoy sin citas"}</span>
        </div>
        {siguiente ? (
          <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <button onClick={() => abrir(siguiente.id)} className="flex min-w-0 flex-1 basis-full items-center gap-3 text-left sm:basis-0">
              <Avatar nombre={siguiente.paciente} className="size-10 text-sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{siguiente.paciente}</p>
                <p className="text-sm text-tinta-2">
                  {etiquetaDia(siguiente.horario, ahora)} · {fmtHora(siguiente.horario)} h <span className="text-tinta-3">· {falta(new Date(siguiente.horario).getTime(), ahora)}</span>
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 pl-[52px] sm:pl-0">
              <Insignia estado={siguiente.estado} />
              <a href={whatsapp(siguiente, consultorio)} target="_blank" rel="noreferrer" onClick={() => accion(siguiente, "recordatorio", "Recordatorio registrado")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium ring-1 ring-borde transition hover:bg-stone-50">
                <MessageCircle className="size-4 text-[#25D366]" /> Recordar
              </a>
            </div>
          </div>
          {futuras.filter((c) => c.id !== siguiente.id).length > 0 && (
            <div className="mt-3 border-t border-borde pt-2.5">
              <p className="mb-1 text-xs text-tinta-3">Después</p>
              <ul className="space-y-0.5">
                {futuras.filter((c) => c.id !== siguiente.id).slice(0, 2).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => abrir(c.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left text-sm hover:bg-stone-50">
                      <span className="w-24 shrink-0 text-xs tabular-nums text-tinta-3">{etiquetaDia(c.horario, ahora)} {fmtHora(c.horario)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.paciente}</span>
                      <span className={cx("size-2 shrink-0 rounded-full", ESTADOS[c.estado].punto)} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </>
        ) : (
          <p className="mt-3 text-sm text-tinta-2">No hay citas próximas. Comparte el enlace de reserva para recibir pacientes.</p>
        )}
      </Tarjeta>

      <Tarjeta className="p-4 sm:p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-tinta-3">Esperando pago</div>
        {urgentes.length ? (
          <ul className="mt-2 space-y-1">
            {urgentes.slice(0, 3).map((c) => {
              const resta = c.venceEn - ahora;
              return (
                <li key={c.id}>
                  <button onClick={() => abrir(c.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-stone-50">
                    <Avatar nombre={c.paciente} className="size-6 text-[10px]" />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.paciente}</span>
                    <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums", resta < URGENTE_MS ? "bg-alerta-suave text-alerta" : "bg-espera-suave text-espera")}>{reloj(resta)}</span>
                  </button>
                </li>
              );
            })}
            {urgentes.length > 3 && <li className="px-1.5 text-xs text-tinta-3">y {urgentes.length - 3} más</li>}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-tinta-2"><Check className="size-4 text-ok" /> Nadie está a medio pagar.</p>
        )}
      </Tarjeta>
    </div>
  );
}

/* ───────────── Métricas ───────────── */

function Metricas({ citas, ahora, hoy }: { citas: Cita[]; ahora: number; hoy: string }) {
  const pagadas = citas.filter((c) => c.pagada && c.transactionId);
  const dias = Array.from({ length: 7 }, (_, i) => claveDia(new Date(ahora - (6 - i) * 86400_000).toISOString()));
  const porDia = dias.map((d) => pagadas.filter((c) => claveDia(new Date(c.pagada!).toISOString()) === d).reduce((s, c) => s + c.monto, 0));
  const semana = porDia.reduce((a, b) => a + b, 0);
  const hoyMonto = porDia[6];
  const cerradas = citas.filter((c) => c.estado !== "apartada");
  const aTiempo = citas.filter((c) => c.transactionId && c.estado !== "pago_tardio").length;
  const tasa = cerradas.length ? Math.round((aTiempo / cerradas.length) * 100) : null;
  const marcadas = citas.filter((c) => c.asistencia);
  const asistieron = marcadas.filter((c) => c.asistencia === "asistio").length;
  const porMarcar = citas.filter((c) => c.estado === "confirmada" && !c.asistencia && new Date(c.horario).getTime() < ahora).length;
  const confirmadasFuturas = citas.filter((c) => c.estado === "confirmada" && claveDia(c.horario) >= hoy).length;

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tarjeta className="p-4">
        <Titulo icono={<CircleDollarSign className="size-4" />}>Cobrado esta semana</Titulo>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{fmtMonto(semana)}</p>
          <Mini valores={porDia} />
        </div>
        <p className="mt-0.5 text-xs text-tinta-3">Hoy {fmtMonto(hoyMonto)} · {pagadas.length} anticipos</p>
      </Tarjeta>
      <Tarjeta className="p-4">
        <Titulo icono={<Check className="size-4" />}>Pagaron a tiempo</Titulo>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{tasa === null ? "—" : `${tasa}%`}</p>
        <p className="mt-0.5 text-xs text-tinta-3">{cerradas.length ? `${aTiempo} de ${cerradas.length} apartados` : "Aún sin datos"}</p>
      </Tarjeta>
      <Tarjeta className="p-4">
        <Titulo icono={<CalendarDays className="size-4" />}>Confirmadas por venir</Titulo>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{confirmadasFuturas}</p>
        <p className="mt-0.5 text-xs text-tinta-3">con anticipo pagado</p>
      </Tarjeta>
      <Tarjeta className="p-4">
        <Titulo icono={<UserCheck className="size-4" />}>Asistencia</Titulo>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{marcadas.length ? `${Math.round((asistieron / marcadas.length) * 100)}%` : "—"}</p>
        <p className="mt-0.5 text-xs text-tinta-3">{marcadas.length ? `${asistieron} de ${marcadas.length} marcadas` : porMarcar ? `${porMarcar} por marcar` : "Se mide al pasar las citas"}</p>
      </Tarjeta>
    </div>
  );
}

function Titulo({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center justify-between text-[13px] font-medium text-tinta-2"><span>{children}</span><span className="text-tinta-3">{icono}</span></div>;
}

function Mini({ valores }: { valores: number[] }) {
  const max = Math.max(...valores, 0.0001);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {valores.map((v, i) => (
        <span key={i} className={cx("w-1.5 rounded-sm", i === valores.length - 1 ? "bg-acento" : "bg-acento/25")} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

/* ───────────── Lista ───────────── */

type Acc = (c: Cita, accion: string, okTexto: string) => Promise<void>;

function subtitulo(c: Cita, ahora: number) {
  const dev = pendientes(c).reduce((s, r) => s + r.monto, 0);
  switch (c.estado) {
    case "apartada": {
      const resta = c.venceEn - ahora;
      return <span className={resta < URGENTE_MS ? "font-medium text-alerta" : "text-espera"}>Vence en <span className="font-mono tabular-nums">{reloj(resta)}</span>{c.pnEnviado ? " · cobro enviado al celular" : ""}</span>;
    }
    case "confirmada":
      return <>Pagó {c.pagada ? cuandoFue(c.pagada, ahora) : ""}{c.asistencia === "asistio" ? " · asistió" : c.asistencia === "no_asistio" ? " · no asistió" : ""}{dev ? <span className="text-alerta"> · devolver {fmtMonto(dev)}</span> : null}</>;
    case "expirada":
      return <>Venció {cuandoFue(c.venceEn, ahora)} sin pago</>;
    case "cancelada":
      return <>Cancelada por {c.canceladaPor === "paciente" ? "el paciente" : "el consultorio"}{dev ? <span className="text-alerta"> · devolver {fmtMonto(dev)}</span> : ""}</>;
    case "pago_tardio":
      return <span className="text-alerta">Pagó tarde · devolver {fmtMonto(dev)}</span>;
  }
}

function Lista({ citas, ahora, resaltar, abrir, accion, consultorio }: { citas: Cita[]; ahora: number; resaltar: Set<string>; abrir: (id: string) => void; accion: Acc; consultorio: Datos["consultorio"] }) {
  const grupos = new Map<string, Cita[]>();
  for (const c of citas) grupos.set(claveDia(c.horario), [...(grupos.get(claveDia(c.horario)) ?? []), c]);
  return (
    <Tarjeta className="overflow-visible">
      {[...grupos.values()].map((g, gi) => (
        <div key={g[0].horario}>
          <div className={cx("sticky top-[105px] z-10 flex items-center justify-between border-b border-borde bg-stone-50/95 px-4 py-2 text-xs backdrop-blur md:top-14", gi === 0 && "rounded-t-2xl")}>
            <span className="font-semibold text-tinta">{etiquetaDia(g[0].horario, ahora)} <span className="font-normal text-tinta-3">· {fmtDia(g[0].horario)}</span></span>
            <span className="text-tinta-3">{g.length} {g.length === 1 ? "cita" : "citas"}</span>
          </div>
          <ul className="divide-y divide-borde">
            {g.map((c) => {
              const urgente = c.estado === "apartada" && c.venceEn - ahora < URGENTE_MS;
              return (
                <li key={c.id} onClick={() => abrir(c.id)}
                  className={cx("group relative flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-500",
                    resaltar.has(c.id) ? "bg-acento-suave" : urgente ? "bg-alerta-suave/50" : "hover:bg-stone-50")}>
                  {urgente && <span className="absolute inset-y-0 left-0 w-0.5 bg-alerta" />}
                  <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">{fmtHora(c.horario)}</span>
                  <Avatar nombre={c.paciente} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.paciente}</p>
                    <p className="truncate text-xs text-tinta-3">{subtitulo(c, ahora)}</p>
                  </div>
                  <Insignia estado={c.estado} className="hidden sm:inline-flex" />
                  <span className={cx("size-2 shrink-0 rounded-full sm:hidden", ESTADOS[c.estado].punto)} />
                  <Acciones c={c} accion={accion} consultorio={consultorio} compacta />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Tarjeta>
  );
}

function whatsapp(c: Cita, cons: Datos["consultorio"]) {
  const base = typeof location !== "undefined" ? location.origin : "";
  const nombre = c.paciente.split(" ")[0];
  const cuando = `${etiquetaDia(c.horario).toLowerCase()} a las ${fmtHora(c.horario)}`;
  const texto = c.estado === "apartada" || c.estado === "expirada"
    ? `Hola ${nombre}, te apartamos tu cita en ${cons.nombre} para ${cuando}. Para confirmarla, paga el anticipo por CoDi aquí: ${base}/?cita=${c.id}`
    : `Hola ${nombre}, te recordamos tu cita en ${cons.nombre} ${cuando} (${cons.direccion}). Si no puedes asistir, avísanos por aquí.`;
  return `https://wa.me/52${c.telefono}?text=${encodeURIComponent(texto)}`;
}

function Acciones({ c, accion, consultorio, compacta }: { c: Cita; accion: Acc; consultorio: Datos["consultorio"]; compacta?: boolean }) {
  const dev = pendientes(c).length > 0;
  const pasada = new Date(c.horario).getTime() < Date.now();
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {compacta && (
        <div className="hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
          <a href={whatsapp(c, consultorio)} target="_blank" rel="noreferrer" title="Recordar por WhatsApp" onClick={() => accion(c, "recordatorio", "Recordatorio registrado")}
            className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100 hover:text-tinta"><MessageCircle className="size-4" /></a>
          {c.estado === "apartada" && (
            <button title="Cobrar al celular (CoDi)" onClick={() => accion(c, "cobro_celular", "Cobro enviado al celular")} className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100 hover:text-tinta"><Smartphone className="size-4" /></button>
          )}
          {c.estado === "confirmada" && !c.asistencia && (
            <button title="Marcar que asistió" onClick={() => accion(c, "asistio", "Marcada como asistió")} className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100 hover:text-tinta"><UserCheck className="size-4" /></button>
          )}
        </div>
      )}
      <Menu boton={(abrir, abierto) => (
        <button onClick={abrir} aria-label="Más acciones" className={cx("grid size-8 place-items-center rounded-lg text-tinta-2 transition hover:bg-stone-100 hover:text-tinta", abierto && "bg-stone-100")}>
          <MoreHorizontal className="size-4" />
        </button>
      )}>
        {(cerrar) => (
          <>
            <OpcionMenu icono={<MessageCircle className="size-4" />} href={whatsapp(c, consultorio)} onClick={() => { cerrar(); accion(c, "recordatorio", "Recordatorio registrado"); }}>
              {c.estado === "apartada" ? "Mandar enlace de pago por WhatsApp" : "Recordar por WhatsApp"}
            </OpcionMenu>
            {c.estado === "apartada" && <OpcionMenu icono={<Smartphone className="size-4" />} onClick={() => { cerrar(); accion(c, "cobro_celular", "Cobro enviado al celular"); }}>Cobrar al celular (CoDi)</OpcionMenu>}
            {(c.estado === "apartada" || c.estado === "expirada") && <OpcionMenu icono={<QrCode className="size-4" />} onClick={() => { cerrar(); accion(c, "renovar_qr", "Nuevo cobro generado"); }}>Generar nuevo QR</OpcionMenu>}
            {c.estado === "confirmada" && (
              <>
                <OpcionMenu icono={<UserCheck className="size-4" />} onClick={() => { cerrar(); accion(c, "asistio", "Marcada como asistió"); }}>Asistió{c.asistencia === "asistio" ? " ✓" : ""}</OpcionMenu>
                <OpcionMenu icono={<UserX className="size-4" />} onClick={() => { cerrar(); accion(c, "no_asistio", "Marcada como no asistió"); }}>No asistió{c.asistencia === "no_asistio" ? " ✓" : ""}{!pasada ? " (aún no es la hora)" : ""}</OpcionMenu>
              </>
            )}
            {dev && <OpcionMenu icono={<Undo2 className="size-4" />} onClick={() => { cerrar(); accion(c, "reembolso_hecho", "Devolución registrada"); }}>Marcar anticipo devuelto</OpcionMenu>}
            <OpcionMenu icono={<Phone className="size-4" />} href={`tel:+52${c.telefono}`} onClick={cerrar}>Llamar · {fmtTel(c.telefono)}</OpcionMenu>
            {(c.estado === "apartada" || c.estado === "confirmada") && (
              <>
                <div className="my-1 h-px bg-borde" />
                <OpcionMenu peligro icono={<XCircle className="size-4" />} onClick={() => { cerrar(); if (confirm(`¿Cancelar la cita de ${c.paciente}?${c.estado === "confirmada" ? " El anticipo quedará por devolver." : ""}`)) accion(c, "cancelar", "Cita cancelada"); }}>
                  Cancelar cita
                </OpcionMenu>
              </>
            )}
          </>
        )}
      </Menu>
    </div>
  );
}

function Vacio({ hayCitas, limpiar, etiqueta }: { hayCitas: boolean; limpiar: () => void; etiqueta: string | null }) {
  return (
    <Tarjeta className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Inbox className="size-6 text-tinta-3" />
      <p className="font-medium">{!hayCitas ? "Aún no hay citas" : etiqueta ? `Sin citas para ${etiqueta.toLowerCase()}` : "Nada con este filtro"}</p>
      <p className="max-w-xs text-sm text-tinta-2">
        {hayCitas ? "Prueba con otro día o estado." : "Cuando un paciente aparte un horario aparecerá aquí y se confirmará solo al pagar."}
      </p>
      {hayCitas && <button onClick={limpiar} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-acento"><RotateCcw className="size-3.5" />Ver todas las próximas</button>}
    </Tarjeta>
  );
}

/* ───────────── Calendario con línea de "ahora" ───────────── */

function Calendario({ citas, desde, horas, ahora, abrir, resaltar }: { citas: Cita[]; desde: string; horas: [number, number]; ahora: number; abrir: (id: string) => void; resaltar: Set<string> }) {
  const dias = Array.from({ length: 5 }, (_, i) => new Date(new Date(`${desde}T12:00:00Z`).getTime() + i * 86400_000).toISOString().slice(0, 10));
  const filas: number[] = [];
  for (let m = horas[0] * 60; m < horas[1] * 60; m += 30) filas.push(m);
  const ALTO = 44;
  const hoy = claveDia(new Date(ahora).toISOString());
  const ahoraMin = (() => { const d = new Date(ahora - 6 * 3600_000); return d.getUTCHours() * 60 + d.getUTCMinutes(); })();
  const lineaVisible = dias.includes(hoy) && ahoraMin >= horas[0] * 60 && ahoraMin <= horas[1] * 60;
  const lineaTop = ((ahoraMin - horas[0] * 60) / 30) * ALTO;
  const iso = (d: string, m: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + (m + 360) * 60_000).toISOString();

  return (
    <Tarjeta className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid border-b border-borde" style={{ gridTemplateColumns: `52px repeat(5, 1fr)` }}>
          <div />
          {dias.map((d) => (
            <div key={d} className={cx("border-l border-borde px-3 py-2 text-xs", d === hoy && "bg-acento-suave/60")}>
              <span className={cx("font-semibold", d === hoy ? "text-acento" : "text-tinta")}>{etiquetaDia(`${d}T18:00:00Z`, ahora)}</span>
              {d === hoy || etiquetaDia(`${d}T18:00:00Z`, ahora) === "Mañana" ? <span className="text-tinta-3"> · {fmtDia(`${d}T18:00:00Z`).split(",")[1]}</span> : null}
            </div>
          ))}
        </div>
        <div className="relative grid max-h-[560px] overflow-y-auto" style={{ gridTemplateColumns: `52px repeat(5, 1fr)` }}>
          <div>
            {filas.map((m) => (
              <div key={m} style={{ height: ALTO }} className="pr-2 pt-1 text-right text-[11px] tabular-nums text-tinta-3">
                {m % 60 === 0 ? `${m / 60}:00` : ""}
              </div>
            ))}
          </div>
          {dias.map((d) => (
            <div key={d} className={cx("relative border-l border-borde", d === hoy && "bg-acento-suave/30")}>
              {filas.map((m) => {
                const pasado = new Date(iso(d, m)).getTime() < ahora;
                return <div key={m} style={{ height: ALTO }} className={cx("border-b", m % 60 === 0 ? "border-borde/40" : "border-borde", pasado && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(0_0_0/0.025)_6px,rgb(0_0_0/0.025)_7px)]")} />;
              })}
              {citas.filter((c) => claveDia(c.horario) === d).map((c) => {
                const m = (() => { const x = new Date(new Date(c.horario).getTime() - 6 * 3600_000); return x.getUTCHours() * 60 + x.getUTCMinutes(); })();
                if (m < horas[0] * 60 || m >= horas[1] * 60) return null;
                return (
                  <button key={c.id} onClick={() => abrir(c.id)} style={{ top: ((m - horas[0] * 60) / 30) * ALTO + 2, height: ALTO - 4 }}
                    className={cx("absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-xs ring-1 ring-inset transition hover:brightness-95", ESTADOS[c.estado].clase, resaltar.has(c.id) && "ring-2")}>
                    <p className="truncate font-medium">{fmtHora(c.horario)} {c.paciente}</p>
                    <p className="truncate opacity-75">{c.estado === "apartada" ? `Vence en ${reloj(c.venceEn - ahora)}` : ESTADOS[c.estado].etiqueta}</p>
                  </button>
                );
              })}
              {d === hoy && lineaVisible && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: lineaTop }}>
                  <div className="relative h-px bg-alerta"><span className="absolute -left-1 -top-1 size-2 rounded-full bg-alerta" /></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Tarjeta>
  );
}

/* ───────────── Actividad ───────────── */

function frase(e: Evento, c?: Cita) {
  const quien = c?.paciente ?? "Una cita";
  switch (e.tipo) {
    case "apartada": return <><b>{quien}</b> apartó {c ? `${etiquetaDia(c.horario).toLowerCase()} ${fmtHora(c.horario)}` : ""}</>;
    case "confirmada": return <><b>{quien}</b> pagó el anticipo{e.detalle === "celular" ? " desde su celular" : " con QR"}</>;
    case "confirmada_tarde": return <><b>{quien}</b> pagó tarde; el horario seguía libre</>;
    case "pago_tardio": return <><b>{quien}</b> pagó tarde: hay que devolver</>;
    case "pago_duplicado": return <><b>{quien}</b> pagó dos veces: devolver uno</>;
    case "expirada": return <>Venció el apartado de <b>{quien}</b></>;
    case "cancelada": return <><b>{quien}</b> {e.detalle === "paciente" ? "canceló antes de pagar" : "· cita cancelada por el consultorio"}</>;
    case "cobro_celular": return <>Cobro enviado al celular de <b>{quien}</b></>;
    case "qr_renovado": return <>Nuevo cobro para <b>{quien}</b></>;
    case "recordatorio": return <>Recordatorio por WhatsApp a <b>{quien}</b></>;
    case "asistio": return <><b>{quien}</b> asistió</>;
    case "no_asistio": return <><b>{quien}</b> no asistió</>;
    case "reembolso_hecho": return <>Anticipo devuelto a <b>{quien}</b></>;
    case "error_cobro": return <>No se pudo crear el cobro de <b>{quien}</b></>;
    default: return <>{e.tipo}</>;
  }
}
const tonoEvento = (t: string) =>
  t.startsWith("confirmada") || t === "asistio" ? "bg-ok" : ["pago_tardio", "pago_duplicado", "error_cobro", "no_asistio"].includes(t) ? "bg-alerta" : t === "apartada" || t === "cobro_celular" ? "bg-espera" : "bg-tinta-3";

function Actividad({ eventos, citas, ahora, abrir }: { eventos: Evento[]; citas: Cita[]; ahora: number; abrir: (id: string) => void }) {
  const [todo, setTodo] = useState(false);
  const [abiertaMovil, setAbiertaMovil] = useState(false);
  const lista = todo ? eventos : eventos.slice(0, 8);
  const grupos = new Map<string, Evento[]>();
  for (const e of lista) { const k = etiquetaDia(new Date(e.t).toISOString(), ahora); grupos.set(k, [...(grupos.get(k) ?? []), e]); }
  return (
    <div className="lg:sticky lg:top-20">
      <button onClick={() => setAbiertaMovil((a) => !a)} className="flex w-full items-center justify-between text-sm font-semibold lg:pointer-events-none">
        Actividad <span className="text-xs font-normal text-tinta-3 lg:hidden">{abiertaMovil ? "Ocultar" : `Ver (${eventos.length})`}</span>
      </button>
      <div className={cx("mt-3", !abiertaMovil && "hidden lg:block")}>
        {!eventos.length ? <p className="text-sm text-tinta-3">Sin actividad todavía.</p> : (
          <div className="space-y-4">
            {[...grupos.entries()].map(([dia, evs]) => (
              <div key={dia}>
                <p className="mb-1.5 text-xs font-medium text-tinta-3">{dia}</p>
                <ol className="relative space-y-0.5 border-l border-borde pl-4">
                  {evs.map((e, i) => {
                    const c = citas.find((x) => x.id === e.cita);
                    return (
                      <li key={i} className="relative">
                        <span className={cx("absolute -left-[21px] top-2.5 size-2 rounded-full ring-2 ring-fondo", tonoEvento(e.tipo))} />
                        <button onClick={() => c && abrir(c.id)} className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-[13px] leading-snug hover:bg-stone-100/70">
                          <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-tinta-3">{horaDe(e.t)}</span>
                          <span className="min-w-0 text-tinta-2 [&_b]:font-medium [&_b]:text-tinta">{frase(e, c)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
            {eventos.length > 8 && (
              <button onClick={() => setTodo((t) => !t)} className="text-xs font-medium text-acento hover:underline">
                {todo ? "Mostrar menos" : `Ver toda la actividad (${eventos.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Detalle (hoja lateral) ───────────── */

function Detalle({ cita: c, eventos, ahora, cerrar, accion, consultorio }: { cita: Cita; eventos: Evento[]; ahora: number; cerrar: () => void; accion: Acc; consultorio: Datos["consultorio"] }) {
  const dev = pendientes(c);
  const metodo = eventos.find((e) => e.tipo === "confirmada")?.detalle;
  return (
    <>
      <div className="flex items-start gap-3 border-b border-borde p-5">
        <Avatar nombre={c.paciente} className="size-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold leading-tight">{c.paciente}</p>
          <a href={`tel:+52${c.telefono}`} className="text-sm text-tinta-2 hover:text-tinta">+52 {fmtTel(c.telefono)}</a>
        </div>
        <button onClick={cerrar} aria-label="Cerrar" className="grid size-8 place-items-center rounded-lg text-tinta-2 hover:bg-stone-100"><X className="size-4" /></button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <Insignia estado={c.estado} />
          {c.estado === "apartada" && <span className={cx("font-mono text-sm font-semibold tabular-nums", c.venceEn - ahora < URGENTE_MS ? "text-alerta" : "text-espera")}>vence en {reloj(c.venceEn - ahora)}</span>}
        </div>
        <dl className="divide-y divide-borde rounded-xl ring-1 ring-borde">
          <Dato k="Cita">{etiquetaDia(c.horario, ahora)}, {fmtHora(c.horario)} h <span className="text-tinta-3">· {falta(new Date(c.horario).getTime(), ahora)}</span></Dato>
          <Dato k="Anticipo">{fmtMonto(c.monto)}{c.pagada ? ` · pagado ${cuandoFue(c.pagada, ahora)}` : " · sin pagar"}</Dato>
          {metodo && <Dato k="Método">CoDi · {metodo === "celular" ? "cobro al celular" : "QR"}</Dato>}
          <Dato k="Referencia">{c.numRef}</Dato>
          {c.transactionId && <Dato k="Transacción"><span className="font-mono text-xs">{c.transactionId}</span></Dato>}
          {c.asistencia && <Dato k="Asistencia">{c.asistencia === "asistio" ? "Asistió" : "No asistió"}</Dato>}
        </dl>
        {dev.length > 0 && (
          <div className="rounded-xl bg-alerta-suave p-3 text-sm text-alerta ring-1 ring-inset ring-alerta/20">
            <p className="font-medium">Por devolver {fmtMonto(dev.reduce((s, r) => s + r.monto, 0))}</p>
            {dev.map((r) => <p key={r.tx} className="text-xs opacity-80">{r.motivo} · {cuandoFue(r.creado, ahora)}</p>)}
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-tinta-3">Historial</p>
          <ol className="relative space-y-2 border-l border-borde pl-4">
            {eventos.map((e, i) => (
              <li key={i} className="relative text-[13px]">
                <span className={cx("absolute -left-[21px] top-1.5 size-2 rounded-full ring-2 ring-superficie", tonoEvento(e.tipo))} />
                <span className="mr-2 font-mono text-[11px] text-tinta-3">{cuandoFue(e.t, ahora)}</span>
                <span className="text-tinta-2 [&_b]:font-medium [&_b]:text-tinta">{frase(e, c)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-borde p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <a href={whatsapp(c, consultorio)} target="_blank" rel="noreferrer" onClick={() => accion(c, "recordatorio", "Recordatorio registrado")}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-medium text-white transition hover:brightness-95">
          <MessageCircle className="size-4" />{c.estado === "apartada" ? "Mandar enlace de pago" : "Recordar por WhatsApp"}
        </a>
        {c.estado === "apartada" && <BotonHoja onClick={() => accion(c, "cobro_celular", "Cobro enviado al celular")} icono={<Smartphone className="size-4" />}>Cobrar al celular</BotonHoja>}
        {(c.estado === "apartada" || c.estado === "expirada") && <BotonHoja onClick={() => accion(c, "renovar_qr", "Nuevo cobro generado")} icono={<QrCode className="size-4" />}>Nuevo QR</BotonHoja>}
        {c.estado === "confirmada" && (
          <>
            <BotonHoja onClick={() => accion(c, "asistio", "Marcada como asistió")} icono={<UserCheck className="size-4" />} activo={c.asistencia === "asistio"}>Asistió</BotonHoja>
            <BotonHoja onClick={() => accion(c, "no_asistio", "Marcada como no asistió")} icono={<UserX className="size-4" />} activo={c.asistencia === "no_asistio"}>No asistió</BotonHoja>
          </>
        )}
        {dev.length > 0 && <BotonHoja onClick={() => accion(c, "reembolso_hecho", "Devolución registrada")} icono={<Undo2 className="size-4" />}>Ya lo devolví</BotonHoja>}
        {(c.estado === "apartada" || c.estado === "confirmada") && (
          <BotonHoja ancho peligro onClick={() => { if (confirm(`¿Cancelar la cita de ${c.paciente}?`)) accion(c, "cancelar", "Cita cancelada"); }} icono={<XCircle className="size-4" />}>Cancelar</BotonHoja>
        )}
      </div>
    </>
  );
}

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex gap-4 px-3.5 py-2.5 text-sm"><dt className="w-24 shrink-0 text-tinta-3">{k}</dt><dd className="min-w-0 flex-1 break-words">{children}</dd></div>;
}

function BotonHoja({ children, icono, onClick, peligro, activo, ancho }: { children: React.ReactNode; icono: React.ReactNode; onClick: () => void; peligro?: boolean; activo?: boolean; ancho?: boolean }) {
  return (
    <button onClick={onClick} className={cx(ancho && "col-span-2", "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium ring-1 transition active:scale-[0.98]",
      peligro ? "text-alerta ring-alerta/30 hover:bg-alerta-suave" : activo ? "bg-acento-suave text-acento ring-acento-borde" : "ring-borde hover:bg-stone-50")}>
      {icono}{children}
    </button>
  );
}

/* ───────────── Compartir enlace de reserva ───────────── */

function Compartir() {
  const avisar = useAviso();
  const [svg, setSvg] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = location.origin + "/";
    setUrl(u);
    QRCode.toString(u, { type: "svg", margin: 0 }).then(setSvg);
  }, []);
  return (
    <Menu boton={(abrir) => (
      <button onClick={abrir} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-tinta-2 ring-1 ring-borde transition hover:bg-stone-50 hover:text-tinta sm:px-2.5">
        <Share2 className="size-4" /><span className="hidden sm:inline">Compartir</span>
      </button>
    )}>
      {(cerrar) => (
        <div className="w-64 p-2">
          <p className="text-sm font-semibold">Enlace de reserva</p>
          <p className="mt-0.5 text-xs text-tinta-3">Imprímelo en recepción o mándalo por WhatsApp.</p>
          <div className="mx-auto my-3 w-36 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="flex items-center gap-1 rounded-lg bg-stone-50 p-1 ring-1 ring-inset ring-borde">
            <span className="min-w-0 flex-1 truncate px-1.5 text-xs text-tinta-2">{url}</span>
            <button onClick={() => navigator.clipboard?.writeText(url).then(() => { avisar("Enlace copiado", "ok"); cerrar(); })} className="inline-flex h-7 items-center gap-1 rounded-md bg-superficie px-2 text-xs font-medium ring-1 ring-borde hover:bg-stone-50">
              <Copy className="size-3" />Copiar
            </button>
          </div>
          <a href="/" target="_blank" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-acento hover:bg-acento-suave"><ExternalLink className="size-3" />Abrir página de reserva</a>
        </div>
      )}
    </Menu>
  );
}

/* ───────────── Paleta de comandos (⌘K) ───────────── */

function Comandos({ citas, cerrar, abrir, ejecutar }: { citas: Cita[]; cerrar: () => void; abrir: (id: string) => void; ejecutar: (k: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const comandos = [
    { k: "nueva", t: "Nueva cita", i: <Plus className="size-4" /> },
    { k: "copiar", t: "Copiar enlace de reserva", i: <Copy className="size-4" /> },
    { k: "hoy", t: "Ir a hoy", i: <CalendarDays className="size-4" /> },
    { k: "proximas", t: "Ver todas las próximas", i: <List className="size-4" /> },
    { k: "pendientes", t: "Ver pendientes de pago", i: <Clock className="size-4" /> },
    { k: "devolver", t: "Ver anticipos por devolver", i: <Undo2 className="size-4" /> },
    { k: "calendario", t: "Cambiar a calendario", i: <CalendarDays className="size-4" /> },
    { k: "lista", t: "Cambiar a lista", i: <List className="size-4" /> },
  ];
  const nq = norm(q.trim());
  const pac = (nq ? citas.filter((c) => norm(c.paciente).includes(nq) || c.telefono.includes(nq.replace(/\D/g, "") || "~") || c.numRef === nq) : [...citas].sort((a, b) => b.creada - a.creada))
    .slice(0, 6);
  const cmds = comandos.filter((c) => !nq || norm(c.t).includes(nq));
  const items = [...pac.map((c) => ({ tipo: "cita" as const, c })), ...cmds.map((c) => ({ tipo: "cmd" as const, c }))];
  const elegir = (i: number) => { const it = items[i]; if (!it) return; if (it.tipo === "cita") abrir(it.c.id); else ejecutar(it.c.k); };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-tinta/20 px-4 pt-[12vh]" onClick={cerrar}>
      <div className="w-full max-w-lg animate-entra overflow-hidden rounded-2xl bg-superficie shadow-flota ring-1 ring-borde" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-borde px-4">
          <Search className="size-4 text-tinta-3" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Busca un paciente, teléfono o referencia…"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === "Enter") elegir(sel);
              if (e.key === "Escape") cerrar();
            }}
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-tinta-3" />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {pac.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-tinta-3">{nq ? "Pacientes" : "Recientes"}</p>}
          {pac.map((c, i) => (
            <button key={c.id} onMouseEnter={() => setSel(i)} onClick={() => elegir(i)}
              className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", sel === i && "bg-stone-100")}>
              <Avatar nombre={c.paciente} className="size-7 text-[11px]" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.paciente}</span><span className="block text-xs text-tinta-3">{etiquetaDia(c.horario)} · {fmtHora(c.horario)} h</span></span>
              <Insignia estado={c.estado} />
            </button>
          ))}
          {cmds.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-tinta-3">Acciones</p>}
          {cmds.map((c, j) => {
            const i = pac.length + j;
            return (
              <button key={c.k} onMouseEnter={() => setSel(i)} onClick={() => elegir(i)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm", sel === i && "bg-stone-100")}>
                <span className="text-tinta-3">{c.i}</span>{c.t}
              </button>
            );
          })}
          {!items.length && <p className="px-3 py-8 text-center text-sm text-tinta-3">Sin resultados para “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}

function Cargando() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]"><Esqueleto className="h-28" /><Esqueleto className="h-28" /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-24" />)}</div>
      <Esqueleto className="h-72" />
    </div>
  );
}
