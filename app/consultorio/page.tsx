"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CircleDollarSign, Clock, Inbox, List, RotateCcw, Stethoscope, Undo2, CheckCircle2 } from "lucide-react";
import { ESTADOS, claveDia, fmtDia, fmtDiaCorto, fmtHora, fmtMonto, hace, type Estado } from "../formato";
import { Esqueleto, Insignia, Tarjeta, cx } from "../ui";

type Cita = {
  id: string; horario: string; paciente: string; monto: number; estado: Estado; creada: number; venceEn: number;
  pagada?: number; transactionId?: string; numRef: string;
};
type Datos = { citas: Cita[]; eventos: string[]; modo: string; consultorio: { nombre: string; medica: string } };
type Filtro = "todas" | Estado;

const FILTROS: { k: Filtro; etiqueta: string }[] = [
  { k: "todas", etiqueta: "Todas" },
  { k: "confirmada", etiqueta: "Confirmadas" },
  { k: "apartada", etiqueta: "Pendientes" },
  { k: "pago_tardio", etiqueta: "Por devolver" },
  { k: "expirada", etiqueta: "Expiradas" },
];

export default function Consultorio() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [ahora, setAhora] = useState(Date.now());
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let previo: Map<string, Estado> | null = null;
    const cargar = async () => {
      try {
        const r = await fetch("/api/citas", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = (await r.json()) as Datos;
        // Resalta un momento las citas que acaban de cambiar de estado.
        if (previo) {
          const cambio = new Set(d.citas.filter((c) => previo!.get(c.id) !== c.estado).map((c) => c.id));
          if (cambio.size) { setNuevas(cambio); setTimeout(() => setNuevas(new Set()), 2500); }
        }
        previo = new Map(d.citas.map((c) => [c.id, c.estado]));
        setDatos(d);
        setError(false);
        setAhora(Date.now());
      } catch {
        setError(true);
      }
    };
    cargar();
    const t = setInterval(cargar, 2000);
    return () => clearInterval(t);
  }, []);

  const citas = datos?.citas ?? [];
  const cuenta = (e: Estado) => citas.filter((c) => c.estado === e).length;
  const cobrado = citas.filter((c) => c.transactionId).reduce((s, c) => s + c.monto, 0);
  const porDevolver = citas.filter((c) => c.estado === "pago_tardio");
  const visibles = useMemo(
    () => [...citas].filter((c) => filtro === "todas" || c.estado === filtro).sort((a, b) => a.horario.localeCompare(b.horario)),
    [citas, filtro],
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-acento text-white"><Stethoscope className="size-3.5" /></span>
            <span className="truncate text-sm font-semibold">{datos?.consultorio.nombre ?? "Consultorio Roble"}</span>
            <span className="text-tinta-3">/</span>
            <span className="text-sm text-tinta-2">Agenda</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-tinta-2">
            {datos?.modo === "simulado" && <span className="hidden rounded-full bg-espera-suave px-2 py-0.5 font-medium text-espera ring-1 ring-inset ring-espera/20 sm:inline">Modo demo</span>}
            <span className="inline-flex items-center gap-1.5">
              <span className={cx("size-2 rounded-full", error ? "bg-alerta" : "bg-ok animate-pulso")} />
              {error ? "Sin conexión" : "En vivo"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
            <p className="text-sm text-tinta-2">Cada cita se confirma sola cuando llega su anticipo por CoDi.</p>
          </div>
        </div>

        {/* Métricas */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica titulo="Cobrado" valor={datos ? fmtMonto(cobrado) : null} icono={<CircleDollarSign className="size-4" />} nota={`${citas.filter((c) => c.transactionId).length} anticipos`} />
          <Metrica titulo="Confirmadas" valor={datos ? String(cuenta("confirmada")) : null} icono={<CheckCircle2 className="size-4" />} tono="ok" />
          <Metrica titulo="Pendientes" valor={datos ? String(cuenta("apartada")) : null} icono={<Clock className="size-4" />} tono="espera" nota="esperando pago" />
          <Metrica titulo="Por devolver" valor={datos ? String(porDevolver.length) : null} icono={<Undo2 className="size-4" />} tono={porDevolver.length ? "alerta" : undefined}
            nota={porDevolver.length ? fmtMonto(porDevolver.reduce((s, c) => s + c.monto, 0)) : "nada pendiente"} />
        </div>

        {porDevolver.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-alerta-suave px-4 py-3 text-sm text-alerta ring-1 ring-inset ring-alerta/20">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{porDevolver.length === 1 ? "Un pago llegó" : `${porDevolver.length} pagos llegaron`} después de que el horario se ocupó. Devuelve el anticipo a la cuenta de origen.</p>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            {/* Filtros + vista */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="sin-barra -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                {FILTROS.map((f) => {
                  const n = f.k === "todas" ? citas.length : cuenta(f.k);
                  return (
                    <button key={f.k} onClick={() => setFiltro(f.k)}
                      className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors",
                        filtro === f.k ? "bg-tinta text-white" : "text-tinta-2 hover:bg-stone-100 hover:text-tinta")}>
                      {f.etiqueta}
                      <span className={cx("rounded px-1 text-xs tabular-nums", filtro === f.k ? "bg-white/20" : "bg-stone-100 text-tinta-3")}>{n}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex rounded-lg bg-stone-100 p-0.5">
                {(["lista", "calendario"] as const).map((v) => (
                  <button key={v} onClick={() => setVista(v)} aria-label={v}
                    className={cx("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
                      vista === v ? "bg-superficie text-tinta shadow-suave" : "text-tinta-2 hover:text-tinta")}>
                    {v === "lista" ? <List className="size-3.5" /> : <CalendarDays className="size-3.5" />}
                    {v === "lista" ? "Lista" : "Calendario"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              {!datos && !error ? (
                <Tarjeta className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-10" />)}</Tarjeta>
              ) : visibles.length === 0 ? (
                <Tarjeta className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <Inbox className="size-6 text-tinta-3" />
                  <p className="font-medium">{citas.length ? "Nada con este filtro" : "Aún no hay citas"}</p>
                  <p className="max-w-xs text-sm text-tinta-2">
                    {citas.length ? "Prueba con otro estado." : "Cuando un paciente aparte un horario aparecerá aquí, y se confirmará solo al pagar."}
                  </p>
                  {citas.length > 0 && <button onClick={() => setFiltro("todas")} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-acento"><RotateCcw className="size-3.5" />Ver todas</button>}
                </Tarjeta>
              ) : vista === "lista" ? (
                <Lista citas={visibles} ahora={ahora} nuevas={nuevas} />
              ) : (
                <Calendario citas={visibles} nuevas={nuevas} />
              )}
            </div>
          </section>

          <aside>
            <h2 className="text-sm font-semibold">Actividad</h2>
            <Tarjeta className="mt-3 p-1">
              <Bitacora eventos={datos?.eventos ?? []} citas={citas} ahora={ahora} cargando={!datos} />
            </Tarjeta>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metrica({ titulo, valor, icono, nota, tono }: { titulo: string; valor: string | null; icono: React.ReactNode; nota?: string; tono?: "ok" | "espera" | "alerta" }) {
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between text-tinta-2">
        <span className="text-[13px] font-medium">{titulo}</span>
        <span className={cx(tono === "ok" && "text-ok", tono === "espera" && "text-espera", tono === "alerta" && "text-alerta", !tono && "text-tinta-3")}>{icono}</span>
      </div>
      {valor === null ? <Esqueleto className="mt-2 h-7 w-20" /> : <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{valor}</p>}
      {nota && <p className="mt-0.5 text-xs text-tinta-3">{nota}</p>}
    </Tarjeta>
  );
}

function Lista({ citas, ahora, nuevas }: { citas: Cita[]; ahora: number; nuevas: Set<string> }) {
  const grupos = new Map<string, Cita[]>();
  for (const c of citas) grupos.set(claveDia(c.horario), [...(grupos.get(claveDia(c.horario)) ?? []), c]);
  return (
    <Tarjeta className="overflow-hidden">
      {[...grupos.values()].map((g) => (
        <div key={g[0].horario}>
          <div className="border-b border-borde bg-stone-50/80 px-4 py-2 text-xs font-medium text-tinta-2">{fmtDia(g[0].horario)}</div>
          <ul className="divide-y divide-borde">
            {g.map((c) => (
              <li key={c.id} className={cx("flex items-center gap-3 px-4 py-3 transition-colors duration-700 sm:gap-4", nuevas.has(c.id) ? "bg-acento-suave" : "hover:bg-stone-50/60")}>
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{fmtHora(c.horario)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.paciente}</p>
                  <p className="truncate text-xs text-tinta-3">
                    {c.transactionId ? `Pagó ${fmtMonto(c.monto)} ${c.pagada ? hace(c.pagada, ahora) : ""}` :
                      c.estado === "apartada" ? `Vence en ${Math.max(0, Math.ceil((c.venceEn - ahora) / 60000))} min` : `Apartó ${hace(c.creada, ahora)}`}
                    <span className="hidden sm:inline"> · Ref. {c.numRef}</span>
                  </p>
                </div>
                <Insignia estado={c.estado} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Tarjeta>
  );
}

function Calendario({ citas, nuevas }: { citas: Cita[]; nuevas: Set<string> }) {
  const dias = [...new Set(citas.map((c) => claveDia(c.horario)))].sort();
  const horas = [...new Set(citas.map((c) => fmtHora(c.horario)))].sort();
  return (
    <Tarjeta className="overflow-x-auto">
      <div className="grid min-w-[480px]" style={{ gridTemplateColumns: `56px repeat(${dias.length}, minmax(140px, 1fr))` }}>
        <div className="border-b border-borde" />
        {dias.map((d) => {
          const c = citas.find((x) => claveDia(x.horario) === d)!;
          const f = fmtDiaCorto(c.horario);
          return (
            <div key={d} className="border-b border-l border-borde px-3 py-2 text-xs">
              <span className="text-tinta-2">{f.semana}</span> <span className="font-semibold">{f.num} {f.mes}</span>
            </div>
          );
        })}
        {horas.map((h) => (
          <div key={h} className="contents">
            <div className="border-b border-borde px-2 py-2 text-right text-xs tabular-nums text-tinta-3">{h}</div>
            {dias.map((d) => {
              const enCelda = citas.filter((c) => claveDia(c.horario) === d && fmtHora(c.horario) === h);
              return (
                <div key={d} className="min-h-12 space-y-1 border-b border-l border-borde p-1.5">
                  {enCelda.map((c) => (
                    <div key={c.id} className={cx("rounded-md px-2 py-1 text-xs ring-1 ring-inset transition-colors", ESTADOS[c.estado].clase, nuevas.has(c.id) && "ring-2")}>
                      <p className="truncate font-medium">{c.paciente}</p>
                      <p className="truncate opacity-80">{ESTADOS[c.estado].etiqueta}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function Bitacora({ eventos, citas, ahora, cargando }: { eventos: string[]; citas: Cita[]; ahora: number; cargando: boolean }) {
  if (cargando) return <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-8" />)}</div>;
  if (!eventos.length) return <p className="px-3 py-6 text-center text-sm text-tinta-3">Sin actividad todavía.</p>;
  return (
    <ul className="max-h-[480px] overflow-y-auto">
      {eventos.map((e, i) => {
        const [iso, ...resto] = e.split(" ");
        const texto = resto.join(" ");
        const tono = /devolver/.test(texto) ? "bg-alerta" : /confirmada/.test(texto) ? "bg-ok" : /apartada/.test(texto) ? "bg-espera" : "bg-tinta-3";
        return (
          <li key={i} className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-stone-50">
            <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", tono)} />
            <div className="min-w-0">
              <p className="text-sm leading-snug">{humano(texto, citas)}</p>
              <p className="text-xs text-tinta-3">{hace(Date.parse(iso), ahora)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Convierte la bitácora técnica ("cita c0002 confirmada con pago SIMTX…") en frases para la recepción.
function humano(t: string, citas: Cita[]) {
  const id = t.match(/^cita (c\d+)/)?.[1];
  const c = citas.find((x) => x.id === id);
  const quien = c?.paciente ?? (id ? `La cita ${id}` : "");
  const cuando = c ? `${fmtDiaCorto(c.horario).semana} ${fmtDiaCorto(c.horario).num}, ${fmtHora(c.horario)}` : "";
  if (/devolver/.test(t)) return `${quien} pagó tarde y el horario ya estaba ocupado: devolver anticipo`;
  if (/confirmada con pago tardío/.test(t)) return `${quien} pagó tarde; el horario seguía libre y se confirmó`;
  if (/confirmada con pago/.test(t)) return `${quien} pagó el anticipo · cita confirmada`;
  if (/apartada/.test(t)) return `${quien} apartó ${cuando}`;
  if (/expiró/.test(t)) return `Venció el apartado de ${quien}; horario liberado`;
  if (/cancelada/.test(t)) return `${quien} canceló antes de pagar`;
  if (/falló/.test(t)) return `No se pudo crear el cobro de ${quien}`;
  return t;
}
