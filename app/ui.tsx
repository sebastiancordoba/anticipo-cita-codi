"use client";
import { useEffect, useRef, useState, createContext, useContext, useCallback } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ESTADOS, iniciales, tonoAvatar, type Estado } from "./formato";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "fantasma";
export function Boton({ variante = "primario", cargando, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || cargando}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento/40 focus-visible:ring-offset-2 focus-visible:ring-offset-fondo",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variante === "primario" && "h-12 px-5 bg-acento text-white shadow-suave hover:bg-acento-hover",
        variante === "secundario" && "h-11 px-4 bg-superficie text-tinta ring-1 ring-borde hover:ring-borde-fuerte hover:bg-stone-50",
        variante === "fantasma" && "h-10 px-3 text-tinta-2 hover:text-tinta hover:bg-stone-100",
        className,
      )}
    >
      {cargando && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl bg-superficie ring-1 ring-borde shadow-suave", className)}>{children}</div>;
}

export function Insignia({ estado, className }: { estado: Estado; className?: string }) {
  const e = ESTADOS[estado];
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", e.clase, className)}>
      <span className={cx("size-1.5 rounded-full", e.punto, estado === "apartada" && "animate-pulso")} />
      {e.etiqueta}
    </span>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-stone-200/70", className)} />;
}


export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold", tonoAvatar(nombre), className)} aria-hidden>
      {iniciales(nombre)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-borde bg-stone-50 px-1.5 py-px font-sans text-[11px] text-tinta-3">{children}</kbd>;
}

/** Menú desplegable simple: se cierra al hacer clic fuera o con Esc. */
export function Menu({ boton, children, alinear = "derecha" }: { boton: (abrir: () => void, abierto: boolean) => ReactNode; children: (cerrar: () => void) => ReactNode; alinear?: "derecha" | "izquierda" }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {boton(() => setAbierto((a) => !a), abierto)}
      {abierto && (
        <div className={cx("absolute top-full z-40 mt-1 min-w-52 origin-top animate-entra rounded-xl bg-superficie p-1 shadow-flota ring-1 ring-borde", alinear === "derecha" ? "right-0" : "left-0")}>
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  );
}

export function OpcionMenu({ icono, children, onClick, peligro, href }: { icono?: ReactNode; children: ReactNode; onClick?: () => void; peligro?: boolean; href?: string }) {
  const clase = cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", peligro ? "text-alerta hover:bg-alerta-suave" : "text-tinta hover:bg-stone-100");
  const cont = <><span className={cx("shrink-0", peligro ? "text-alerta" : "text-tinta-3")}>{icono}</span>{children}</>;
  return href ? <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={clase}>{cont}</a> : <button onClick={onClick} className={clase}>{cont}</button>;
}

/** Panel lateral (escritorio) / hoja inferior (móvil). */
export function Hoja({ abierta, onCerrar, children, titulo }: { abierta: boolean; onCerrar: () => void; children: ReactNode; titulo: string }) {
  useEffect(() => {
    if (!abierta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [abierta, onCerrar]);
  return (
    <div className={cx("fixed inset-0 z-50", !abierta && "pointer-events-none")} aria-hidden={!abierta}>
      <div onClick={onCerrar} className={cx("absolute inset-0 bg-tinta/20 transition-opacity duration-200", abierta ? "opacity-100" : "opacity-0")} />
      <section role="dialog" aria-label={titulo}
        className={cx(
          "absolute flex flex-col bg-superficie shadow-flota ring-1 ring-borde transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl sm:inset-y-2 sm:right-2 sm:left-auto sm:bottom-2 sm:max-h-none sm:w-[420px] sm:rounded-2xl",
          abierta ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-[110%]",
        )}>
        {children}
      </section>
    </div>
  );
}

type Aviso = { id: number; texto: string; tono?: "ok" | "error" };
const AvisosCtx = createContext<(texto: string, tono?: "ok" | "error") => void>(() => {});
export const useAviso = () => useContext(AvisosCtx);
export function Avisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tono?: "ok" | "error") => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, tono }]);
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 3200);
  }, []);
  return (
    <AvisosCtx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {lista.map((a) => (
          <div key={a.id} className={cx("pointer-events-auto animate-entra rounded-xl px-4 py-2.5 text-sm font-medium shadow-flota", a.tono === "error" ? "bg-alerta text-white" : "bg-tinta text-white")}>
            {a.texto}
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  );
}
