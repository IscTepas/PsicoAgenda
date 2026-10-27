# Design

## Context

El registro ya usa `mailer.service.ts` (Nodemailer + SMTP de Gmail) y un almacén temporal en la tabla `cache_registro` con `get/set/del/incr`, TTL y borrado perezoso. La recuperación no lo usa: llama a Supabase, cuyo SMTP por defecto entrega dos correos por hora y solo a correos del equipo del proyecto.

## Goals / Non-Goals

**Goals**

- Que la recuperación funcione con el mismo remitente y las mismas garantías que el registro.
- No revelar qué correos están registrados.
- Reutilizar infraestructura existente en lugar de introducir otra.

**Non-Goals**

- Cambiar el flujo de cambio de contraseña desde el perfil (ya existe y está autenticado).
- Invalidar todas las sesiones activas tras el cambio de contraseña (mejora posterior).

## Decisions

### 1. Token opaco, no JWT

Se genera un valor aleatorio de 32 bytes en base64url y se guarda **solo su SHA-256** en `cache_registro`, igual que el código de registro. El token viaja en el enlace y se consume una vez.

**Alternativa descartada:** JWT firmado con caducidad. Evita el almacenamiento, pero no permite el uso único ni la revocación sin una lista negra, que es exactamente el almacenamiento que se quería evitar.

### 2. Reutilizar `cache_registro`

Ya está en la base, tiene TTL por fila y un barrido periódico en el despacho. Crear una tabla `tokens_recuperacion` duplicaría la misma mecánica.

**Trade-off:** la tabla mezcla propósitos (códigos de registro, límites y tokens de recuperación). Se mitiga con prefijos de clave claros (`recuperacion:token:`, `recuperacion:rate:`).

### 3. Respuesta uniforme y límites

`POST /api/auth/recuperacion/solicitar` responde 202 siempre que el correo tenga formato válido, exista o no la cuenta. Los límites usan el mismo `incr` atómico del almacén.

**Alternativa descartada:** responder 404 cuando el correo no existe. Es más claro para el usuario, pero convierte el endpoint en un verificador de cuentas.

### 4. El envío lo hace la API, no el navegador

El enlace se construye en la API con la URL pública del frontend, y el token nunca se expone al cliente antes de tiempo.

## Risks / Trade-offs

- **Dependencia del SMTP de Gmail**, con su límite diario. Es el mismo riesgo que ya asume el registro; migrar a un proveedor transaccional es un cambio aparte.
- **Enlaces en el correo.** Si el correo se reenvía, el token sigue siendo de un solo uso y caduca.
- **Redirect del frontend.** La URL base debe estar configurada; una URL equivocada produce enlaces roto y hay que verificarlo en la prueba de extremo a extremo.
