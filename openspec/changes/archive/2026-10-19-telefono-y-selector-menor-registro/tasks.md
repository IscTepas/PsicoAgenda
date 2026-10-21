# Tasks

## 1. Validación compartida del teléfono

- [x] 1.1 Agregar `telefonoSchema` en `packages/shared` (exactamente 10 dígitos, tolerante a separadores) y usarlo en `phone` y en `emergencyContactSchema.phone`, y reconstruir el paquete (`npm run build`)

## 2. Máscara y selector en el formulario

- [x] 2.1 Implementar `formatearTelefono` (solo dígitos, máximo 10, grupos 3-3-4) y `formatearTelefonoPegado` (últimos 10 al pegar con lada) en `registro.service.ts`
- [x] 2.2 Aplicar la máscara en los tres teléfonos del formulario con un `TelefonoInput` común (`inputMode="tel"`, `maxLength` del formato, `onPaste` normalizado)
- [x] 2.3 Agregar el selector "¿Para quién es la cuenta?" con `paraMenor`, derivar `esMenor` desde la fecha (o el selector mientras no haya fecha) y validar la coherencia en el `superRefine`; eliminar el `isMinor` sincronizado por efecto
- [x] 2.4 Mover la sección "Datos del tutor legal" antes de "Datos de acceso" y dejarla como una sección normal del formulario (sin caja, icono ni fondo destacado)
- [x] 2.5 Deshabilitar el teléfono de "Datos de acceso" cuando la cuenta es de un menor, mostrar en él el teléfono del tutor y enviarlo como `phone` del payload (también en el reenvío y la verificación)
- [x] 2.6 Bajar el consentimiento del tutor para que quede junto al aviso de privacidad

## 3. Verificación

- [x] 3.1 Tests unitarios del formateo en `apps/web` (progresivo, descarte de separadores, tope de 10, vacío y pegado con lada)
- [x] 3.2 `npm run typecheck` en `apps/web` y `apps/api` sin errores
- [x] 3.3 `npm run lint` de los archivos tocados sin errores
- [x] 3.4 Suites completas: `apps/web` **40/40** y `apps/api` **105/105**
- [x] 3.5 Verificación de UI con Playwright: 10 dígitos → `551-234-5678`; 12 dígitos se recortan; pegar `+52 55 1234 5678` → `551-234-5678`; el selector "menor" muestra el tutor sin fecha; ambas contradicciones fecha/selector muestran su error; el payload envía los teléfonos formateados y sin tutor en una cuenta de adulto
- [x] 3.6 Verificación de UI del reordenamiento: la sección del tutor aparece antes de "Datos de acceso" y sin fondo destacado; el teléfono personal queda deshabilitado mostrando el del tutor (con su nota); el consentimiento queda junto al aviso de privacidad; y el payload de un menor lleva `phone` igual al teléfono del tutor

## Workflow follow-up

- Archivar el cambio tras la revisión y `openspec validate` en verde.
