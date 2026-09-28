# Propuesta: Acceso por rol

## Motivación

Actualmente la aplicación web es un esqueleto sin sesión. Para poder validar la experiencia de cada actor necesitamos una forma rápida de entrar como paciente o psicólogo/a y que la interfaz muestre solo las opciones permitidas para ese rol.

## Incluye

- Endpoint de demostración `POST /api/auth/demo-login` que firma un JWT sin tocar base de datos.
- Botones de acceso rápido en `/login`: "Entrar como paciente" y "Entrar como psicólogo/a".
- Sesión en `localStorage` para enviar `Authorization: Bearer` y leer el rol en el cliente.
- Cookie simple `pa_session` para que `proxy.ts` pueda redirigir usuarios sin sesión a `/login`.
- Filtro de navegación en `app-shell.tsx` según `NAV_ITEMS.roles`.
- Columna `role` en el modelo `User` de Prisma y migración offline del esquema completo.
- Corrección de seguridad: `createUserSchema.role` ya no permite `ADMIN`.

## No incluye

- Autenticación real con credenciales ni bcrypt.
- Integración con base de datos para login.
- Envío de correos o 2FA.
- Protección real de API (los endpoints protegidos llegarán en cambios posteriores).
- Deploy a producción: el acceso demo está bloqueado por `ALLOW_DEMO_LOGIN`.

## Risgos / deuda

- Es protección de UI, no seguridad real: un usuario puede manipular `localStorage` o cookies.
- La migración generada offline no se ha aplicado contra PostgreSQL.
- El demo login no valida que el usuario exista en la base de datos.
