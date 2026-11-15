import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ESTADOS, type Estado } from "./formato";

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
