export const CONSULTORIO = {
  nombre: "Consultorio Roble",
  medica: "Dra. Elena Ríos",
  especialidad: "Medicina general",
  duracionMin: 30,
  direccion: "Calle Ficticia 123, Ciudad de México",
};

const modo = (process.env.PEY_MODE ?? "simulado") as "simulado" | "real";

export const config = {
  modo,
  apiKey: process.env.PEY_API_KEY ?? "",
  // En modo real no hay secreto por defecto: sin PEY_WEBHOOK_SECRET todo webhook se rechaza.
  webhookSecret: process.env.PEY_WEBHOOK_SECRET ?? (modo === "simulado" ? "whsec_c2VjcmV0by1kZS1wcnVlYmEtbG9jYWwtMTIzNDU2" : ""),
  anticipoMXN: Number(process.env.ANTICIPO_MXN ?? "0.01"),
  // CoDi pide al menos 360 s de vigencia para el QR.
  minutosApartado: Math.max(6, Number(process.env.MINUTOS_APARTADO ?? "10")),
};
