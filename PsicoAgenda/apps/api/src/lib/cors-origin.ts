/**
 * Orígenes permitidos por CORS.
 *
 * `CORS_ORIGIN` admite una lista separada por comas y `*` como comodín dentro de
 * cada entrada. El caso que motiva el comodín son los preview deployments de
 * Vercel: cada rama recibe un subdominio distinto
 * (`psicoagenda-web-git-rama.vercel.app`), así que una lista exacta obligaría a
 * editar variables en cada PR.
 *
 *   CORS_ORIGIN=https://psicoagenda.vercel.app,https://psicoagenda-web-*.vercel.app
 *
 * Una petición sin `origin` se permite: el navegador siempre lo envía, así que
 * solo llega vacío en llamadas de servidor a servidor (curl, pruebas, el propio
 * cron). El navegador no puede falsificarlo, de modo que no abre ningún hueco.
 */

const escaparRegex = (valor: string): string => valor.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

const aPatron = (origen: string): RegExp => {
  const escapado = escaparRegex(origen);
  return new RegExp(`^${escapado.replace(/\*/g, ".*")}$`);
};

export function origenPermitido(
  origin: string | undefined,
  patrones: readonly string[],
): boolean {
  if (!origin) return true;

  return patrones.some((patron) => {
    if (patron === "*") return true;
    if (!patron.includes("*")) return patron === origin;
    return aPatron(patron).test(origin);
  });
}
