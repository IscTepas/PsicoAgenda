/**
 * Compresión de avatares: el perfil guardaba la imagen original en base64
 * (hasta ~4 MB) y ahora la foto viaja en `/auth/me` para el menú. Reducirla a
 * ~512 px la deja en decenas de KB sin pérdida visible en un avatar de 32 px.
 */

const MAX_LADO = 512;
const CALIDAD = 0.85;

/** Calcula las dimensiones del avatar sin ampliar imágenes pequeñas. */
export function dimensionesAvatar(
  ancho: number,
  alto: number,
  maxLado = MAX_LADO
): { ancho: number; alto: number } {
  const escala = Math.min(1, maxLado / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const imagen = new Image();

    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    imagen.src = url;
  });
}

/**
 * Redimensiona y comprime una imagen para usarla como avatar.
 * Devuelve un data URL WebP (o JPEG si el navegador no soporta WebP en canvas).
 */
export async function comprimirAvatar(file: File): Promise<string> {
  const imagen = await cargarImagen(file);
  const { ancho, alto } = dimensionesAvatar(imagen.naturalWidth, imagen.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;

  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("No se pudo procesar la imagen.");

  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const webp = canvas.toDataURL("image/webp", CALIDAD);
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", CALIDAD);
}
