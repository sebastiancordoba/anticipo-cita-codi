import { promises as fs } from "fs";
import path from "path";
import { config } from "./config";

export type EstadoCita =
  | "apartada" // horario retenido esperando el anticipo
  | "confirmada" // anticipo recibido y verificado
  | "expirada" // venció sin pago; el horario se liberó
  | "pago_tardio"; // llegó el pago después de vencer y el horario ya estaba ocupado: hay que devolverlo

export type Cita = {
  id: string;
  horario: string; // ISO del inicio
  paciente: string;
  telefono: string;
  monto: number;
  numRef: string; // referencia numérica de CoDi (≤ 7 dígitos)
  codiQrId?: string;
  qrString?: string;
  estado: EstadoCita;
  creada: number; // ms
  venceEn: number; // ms
  pagada?: number; // ms
  transactionId?: string;
};

type Db = { secuencia: number; citas: Cita[]; eventos: string[] };

// Almacén: Upstash Redis (REST) si hay credenciales (Vercel → Storage → Upstash), si no un archivo JSON local.
// Con Redis se usa control de concurrencia optimista (versión + script Lua) porque en serverless
// varias instancias pueden escribir a la vez (p. ej. el webhook de pey y el sondeo de la pantalla).
const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const CLAVE = "anticipo:db";
const CLAVE_VER = "anticipo:ver";
const ARCHIVO = process.env.VERCEL
  ? path.join("/tmp", "citas.json")
  : path.join(process.cwd(), "data", "citas.json");

const vacia = (): Db => ({ secuencia: 0, citas: [], eventos: [] });

async function redis(cmd: unknown[]): Promise<unknown> {
  const r = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const d = (await r.json()) as { result?: unknown; error?: string };
  if (d.error) throw new Error("redis: " + d.error);
  return d.result;
}

const CAS = `if (redis.call('GET', KEYS[2]) or '0') == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2]); redis.call('INCR', KEYS[2]); return 1 else return 0 end`;

let cola: Promise<unknown> = Promise.resolve();

/** Ejecuta fn sobre la base y guarda el resultado. fn debe poder re-ejecutarse (sin efectos externos). */
export function conDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const siguiente = cola.then(() => (REDIS_URL && REDIS_TOKEN ? conRedis(fn) : conArchivo(fn)));
  cola = siguiente.catch(() => undefined);
  return siguiente;
}

async function conRedis<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  for (let intento = 0; intento < 8; intento++) {
    const [raw, ver] = (await Promise.all([redis(["GET", CLAVE]), redis(["GET", CLAVE_VER])])) as [string | null, string | null];
    const db: Db = raw ? JSON.parse(raw) : vacia();
    const antes = JSON.stringify(db);
    vencerApartadas(db);
    const r = await fn(db);
    const despues = JSON.stringify(db);
    if (despues === antes) return r;
    if ((await redis(["EVAL", CAS, 2, CLAVE, CLAVE_VER, ver ?? "0", despues])) === 1) return r;
    await new Promise((ok) => setTimeout(ok, 30 + Math.random() * 70));
  }
  throw new Error("No se pudo guardar por concurrencia");
}

async function conArchivo<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  let db: Db;
  try {
    db = JSON.parse(await fs.readFile(ARCHIVO, "utf8")) as Db;
  } catch {
    db = vacia();
  }
  vencerApartadas(db);
  const r = await fn(db);
  await fs.mkdir(path.dirname(ARCHIVO), { recursive: true });
  await fs.writeFile(ARCHIVO + ".tmp", JSON.stringify(db, null, 2));
  await fs.rename(ARCHIVO + ".tmp", ARCHIVO);
  return r;
}

function vencerApartadas(db: Db) {
  const ahora = Date.now();
  for (const c of db.citas) {
    if (c.estado === "apartada" && c.venceEn < ahora) {
      c.estado = "expirada";
      db.eventos.push(`${new Date().toISOString()} cita ${c.id} expiró sin pago`);
    }
  }
}

/** Horarios del consultorio: los próximos 5 días con lugares (lun–sáb), de 9 a 14 h cada 30 min (hora CDMX). */
export function horariosDisponibles(): string[] {
  const res: string[] = [];
  const hoyCdmx = new Date(Date.now() - 6 * 3600_000); // CDMX es UTC−6 todo el año
  let dias = 0;
  for (let d = 0; dias < 5 && d < 14; d++) {
    const dia = new Date(Date.UTC(hoyCdmx.getUTCFullYear(), hoyCdmx.getUTCMonth(), hoyCdmx.getUTCDate() + d));
    if (dia.getUTCDay() === 0) continue; // domingo cerrado
    let alguno = false;
    for (let m = 9 * 60; m < 14 * 60; m += 30) {
      const inicio = new Date(dia.getTime() + (m + 6 * 60) * 60_000); // a UTC
      if (inicio.getTime() > Date.now() + 30 * 60_000) { res.push(inicio.toISOString()); alguno = true; }
    }
    if (alguno) dias++;
  }
  return res;
}

export function ocupa(c: Cita) {
  return c.estado === "apartada" || c.estado === "confirmada";
}

export function nuevaCita(db: Db, datos: { horario: string; paciente: string; telefono: string }): Cita {
  db.secuencia += 1;
  const ahora = Date.now();
  const cita: Cita = {
    id: `c${db.secuencia.toString().padStart(4, "0")}`,
    horario: datos.horario,
    paciente: datos.paciente,
    telefono: datos.telefono,
    monto: config.anticipoMXN,
    numRef: String(db.secuencia % 10_000_000),
    estado: "apartada",
    creada: ahora,
    venceEn: ahora + config.minutosApartado * 60_000,
  };
  db.citas.push(cita);
  return cita;
}
