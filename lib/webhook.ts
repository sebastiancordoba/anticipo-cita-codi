import crypto from "crypto";

// Verificación según Standard Webhooks (https://www.standardwebhooks.com), que es lo que usa pey:
// firma = base64(HMAC-SHA256(secreto, `${webhook-id}.${webhook-timestamp}.${cuerpo}`)), en el header
// webhook-signature como "v1,<firma>" (puede traer varias separadas por espacio).

const TOLERANCIA_SEG = 5 * 60;

function clave(secreto: string) {
  return Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
}

export function firmar(secreto: string, id: string, timestamp: string, cuerpo: string) {
  return "v1," + crypto.createHmac("sha256", clave(secreto)).update(`${id}.${timestamp}.${cuerpo}`).digest("base64");
}

export function verificar(secreto: string, headers: Headers, cuerpo: string): boolean {
  if (!secreto) return false;
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const firmas = headers.get("webhook-signature");
  if (!id || !ts || !firmas) return false;
  const seg = Number(ts);
  if (!Number.isFinite(seg) || Math.abs(Date.now() / 1000 - seg) > TOLERANCIA_SEG) return false;
  const esperada = Buffer.from(firmar(secreto, id, ts, cuerpo));
  return firmas.split(" ").some((f) => {
    const b = Buffer.from(f);
    return b.length === esperada.length && crypto.timingSafeEqual(b, esperada);
  });
}
