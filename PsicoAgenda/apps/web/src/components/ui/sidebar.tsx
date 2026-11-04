"use client";
// Sidebar de Aceternity (registro @aceternity/sidebar-demo), adaptado: enlaces de
// Next, tokens del tema en lugar de neutral-*, elemento activo, nombres accesibles
// con la barra contraída y medidas de DESIGN.md (240 px / 72 px).
import { cn } from "@/lib/utils";
import Link from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn(
        "sticky top-0 hidden h-svh w-[240px] shrink-0 overflow-hidden border-r border-border/40 bg-card/70 px-3 py-4 backdrop-blur-xl backdrop-saturate-150 md:flex md:flex-col",
        className
      )}
      // Contraída mide 73 px: 1 px es el borde, así el área visible es de 72 y su centro
      // cae en 36 px, donde se alinean el logo, los iconos y la foto (posiciones fijas).
      animate={{
        width: animate ? (open ? "240px" : "73px") : "240px",
      }}
      transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // El teclado también la abre: quien navega con Tab ve las etiquetas.
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-card w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <button type="button" aria-label="Abrir menú" onClick={() => setOpen(!open)}>
            <IconMenu2 className="text-foreground" />
          </button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-background p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <button
                type="button"
                aria-label="Cerrar menú"
                className="absolute right-10 top-10 z-50 text-foreground"
                onClick={() => setOpen(!open)}
              >
                <IconX />
              </button>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  active = false,
  badge = 0,
  ...props
}: {
  link: Links;
  className?: string;
  /** Sección actual: relleno teal y `aria-current`. */
  active?: boolean;
  /** Pendientes por atender (ámbar). Contraída se ve como punto sobre el icono. */
  badge?: number;
} & Omit<React.ComponentProps<typeof Link>, "href">) => {
  const { open, animate } = useSidebar();
  return (
    // El icono nunca se mueve: relleno fijo de 15 px (12 del riel + 15 + 9 = 36, el centro del
    // riel contraído). Solo cambia el ancho del riel, y la etiqueta entra y sale con opacidad.
    <Link
      href={link.href}
      // Contraída solo se ve el icono: la etiqueta sigue siendo el nombre del enlace.
      aria-label={badge > 0 ? `${link.label}, ${badge} por responder` : link.label}
      title={!open ? link.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/sidebar flex min-h-10 items-center justify-start gap-3 rounded-[14px] px-[15px] text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        className
      )}
      {...props}
    >
      <span className="relative flex shrink-0">
        {link.icon}
        {badge > 0 && !open && animate && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-500 ring-2 ring-card"
          />
        )}
      </span>

      <motion.span
        initial={false}
        animate={{ opacity: animate ? (open ? 1 : 0) : 1 }}
        // Al abrir entra cuando el riel ya hizo sitio; al cerrar se va antes de que se encoja.
        transition={{ duration: open ? 0.18 : 0.08, delay: open ? 0.06 : 0 }}
        className="whitespace-nowrap transition-transform duration-150 group-hover/sidebar:translate-x-1"
      >
        {link.label}
      </motion.span>
      {badge > 0 && (open || !animate) && (
        <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
          {badge}
        </span>
      )}
    </Link>
  );
};
