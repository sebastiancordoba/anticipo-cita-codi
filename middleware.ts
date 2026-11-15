import { NextResponse, type NextRequest } from "next/server";

// Contraseña simple para el panel del consultorio (solo si CONSULTORIO_CLAVE está definida).
export function middleware(req: NextRequest) {
  const clave = process.env.CONSULTORIO_CLAVE;
  if (!clave) return NextResponse.next();
  const { pathname } = req.nextUrl;
  const protegido = pathname.startsWith("/consultorio") || (pathname === "/api/citas" && req.method === "GET");
  if (!protegido) return NextResponse.next();
  const auth = req.headers.get("authorization") ?? "";
  const [tipo, valor] = auth.split(" ");
  if (tipo === "Basic" && valor) {
    const [, pass] = atob(valor).split(":");
    if (pass === clave) return NextResponse.next();
  }
  return new NextResponse("Contraseña requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Consultorio"' },
  });
}

export const config = { runtime: "nodejs", matcher: ["/consultorio/:path*", "/api/citas"] };
