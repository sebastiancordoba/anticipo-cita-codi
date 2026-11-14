const tz = "America/Mexico_City";
export const fmtDia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
export const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
export const fmtMonto = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
export const ETIQUETA: Record<string, string> = {
  apartada: "Esperando anticipo",
  confirmada: "Confirmada",
  expirada: "Expiró sin pago",
  pago_tardio: "Pago tardío: devolver",
};
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
