export const APP_NAME = "PsicoAgenda";

export const DEFAULT_APPOINTMENT_DURATION = 50; // minutos
export const MIN_APPOINTMENT_DURATION = 45;
export const MAX_APPOINTMENT_DURATION = 60;

export const REMINDER_HOURS_BEFORE = 24;

/**
 * Intentos de verificación permitidos por cada código de registro. La API es
 * quien los cuenta; la web solo los muestra para no dejar a la persona a
 * ciegas, por eso el límite vive aquí y no duplicado en cada lado.
 */
export const MAX_INTENTOS_CODIGO = 5;

/**
 * Vigencia de la credencial de acceso que emite el proveedor de identidad (1 hora).
 * Sustituye a la constante de expiración del JWT propio: la API ya no emite tokens.
 * La sesión vive mientras el proveedor la mantenga; el acceso se renueva de forma
 * transparente en cada petición.
 */
export const ACCESS_TOKEN_LIFETIME_SECONDS = 3600;

export const DEFAULT_API_PORT = 4000;
export const DEFAULT_WEB_PORT = 3000;
