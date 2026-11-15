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

export type Estado = "apartada" | "confirmada" | "expirada" | "pago_tardio";
export const ESTADOS: Record<Estado, { etiqueta: string; clase: string; punto: string }> = {
  confirmada: { etiqueta: "Confirmada", clase: "bg-ok-suave text-ok ring-ok/20", punto: "bg-ok" },
  apartada: { etiqueta: "Esperando anticipo", clase: "bg-espera-suave text-espera ring-espera/20", punto: "bg-espera" },
  expirada: { etiqueta: "Expirada", clase: "bg-stone-100 text-tinta-2 ring-stone-300/50", punto: "bg-tinta-3" },
  pago_tardio: { etiqueta: "Por devolver", clase: "bg-alerta-suave text-alerta ring-alerta/20", punto: "bg-alerta" },
};

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
