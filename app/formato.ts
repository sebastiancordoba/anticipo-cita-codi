const tz = "America/Mexico_City";
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtDia = (iso: string) =>
  cap(new Date(iso).toLocaleDateString("es-MX", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }));
export const fmtDiaCorto = (iso: string) => {
  const d = new Date(iso);
  return {
    semana: cap(d.toLocaleDateString("es-MX", { timeZone: tz, weekday: "short" }).replace(".", "")),
    num: d.toLocaleDateString("es-MX", { timeZone: tz, day: "numeric" }),
    mes: d.toLocaleDateString("es-MX", { timeZone: tz, month: "short" }).replace(".", ""),
  };
};
export const claveDia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
export const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false });
export const fmtMonto = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
export const fmtTel = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join(" ");
};
export const hace = (ms: number, ahora = Date.now()) => {
  const s = Math.max(0, Math.round((ahora - ms) / 1000));
  if (s < 45) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
};

export type Estado = "apartada" | "confirmada" | "expirada" | "cancelada" | "pago_tardio";
export const ESTADOS: Record<Estado, { etiqueta: string; clase: string; punto: string }> = {
  confirmada: { etiqueta: "Confirmada", clase: "bg-ok-suave text-ok ring-ok/20", punto: "bg-ok" },
  apartada: { etiqueta: "Esperando anticipo", clase: "bg-espera-suave text-espera ring-espera/20", punto: "bg-espera" },
  expirada: { etiqueta: "Expirada", clase: "bg-stone-100 text-tinta-2 ring-stone-300/50", punto: "bg-tinta-3" },
  cancelada: { etiqueta: "Cancelada", clase: "bg-stone-100 text-tinta-2 ring-stone-300/50", punto: "bg-tinta-3" },
  pago_tardio: { etiqueta: "Pago tardío", clase: "bg-alerta-suave text-alerta ring-alerta/20", punto: "bg-alerta" },
};

/** "21:12" a partir de ms. */
export const horaDe = (ms: number) => fmtHora(new Date(ms).toISOString());
/** Cuenta regresiva "7:43" (o "0:00"). */
export const reloj = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
/** "Hoy", "Mañana", "Ayer" o "Lun 16 nov". */
export const etiquetaDia = (iso: string, ahora = Date.now()) => {
  const k = claveDia(iso);
  const hoy = claveDia(new Date(ahora).toISOString());
  const man = claveDia(new Date(ahora + 86400_000).toISOString());
  const ayer = claveDia(new Date(ahora - 86400_000).toISOString());
  if (k === hoy) return "Hoy";
  if (k === man) return "Mañana";
  if (k === ayer) return "Ayer";
  const d = fmtDiaCorto(iso);
  return `${d.semana} ${d.num} ${d.mes}`;
};
/** Momento con día: "hoy 21:12", "ayer 18:03", "lun 16 nov 9:30". */
export const cuandoFue = (ms: number, ahora = Date.now()) => {
  const iso = new Date(ms).toISOString();
  const e = etiquetaDia(iso, ahora);
  return `${e === "Hoy" || e === "Mañana" || e === "Ayer" ? e.toLowerCase() : e} ${fmtHora(iso)}`;
};
/** "en 25 min", "en 3 h", "en 2 d" para horarios futuros; "hace …" si ya pasó. */
export const falta = (ms: number, ahora = Date.now()) => {
  const s = Math.round((ms - ahora) / 1000);
  if (s < 0) return hace(ms, ahora);
  if (s < 3600) return `en ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return `en ${h} h${m ? ` ${m} min` : ""}`; }
  return `en ${Math.round(s / 86400)} d`;
};
export const iniciales = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
const TONOS = ["bg-teal-100 text-teal-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-lime-100 text-lime-800", "bg-indigo-100 text-indigo-800"];
export const tonoAvatar = (n: string) => TONOS[[...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % TONOS.length];

/** Archivo .ics para "Agregar al calendario". */
export function ics(p: { inicio: string; minutos: number; titulo: string; lugar: string; detalle: string; uid: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ini = new Date(p.inicio);
  const fin = new Date(ini.getTime() + p.minutos * 60_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//anticipo-cita-codi//ES", "BEGIN:VEVENT",
    `UID:${p.uid}@anticipo-cita-codi`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(ini)}`, `DTEND:${f(fin)}`,
    `SUMMARY:${p.titulo}`, `LOCATION:${p.lugar}`, `DESCRIPTION:${p.detalle}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de cita", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
export function googleCal(p: { inicio: string; minutos: number; titulo: string; lugar: string; detalle: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ini = new Date(p.inicio);
  const fin = new Date(ini.getTime() + p.minutos * 60_000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: p.titulo, dates: `${f(ini)}/${f(fin)}`, location: p.lugar, details: p.detalle });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Prefijo cuando la app vive bajo una ruta (p. ej. /anticipo detrás de un proxy). */
export const B = process.env.NEXT_PUBLIC_BASE ?? "";
