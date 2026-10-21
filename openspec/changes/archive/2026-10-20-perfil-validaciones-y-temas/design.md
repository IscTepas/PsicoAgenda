# Design

## Context

El perfil (`apps/web/src/app/(app)/perfil/pantalla-perfil-usuario.tsx`) edita el nombre, el teléfono, la zona horaria, la foto y —según el rol— el contacto de emergencia o la cédula/especialidad. Guarda con `PATCH /api/patients/me` o `/api/psychologists/me`, validados por `updatePatientProfileSchema` / `updatePsychologistProfileSchema` de `packages/shared`. Hoy esos esquemas solo exigen longitud mínima en el nombre; el teléfono, la foto y la zona horaria aceptan cualquier texto. El correo se edita en la UI pero no viaja en el payload. El tema vive en `localStorage` (`light | dark | system`) y se aplica con la clase `dark` sobre variables CSS OKLCH.

## Goals / Non-Goals

**Goals:**

- Cerrar las validaciones del perfil en un solo lugar (shared) para que web y API coincidan.
- Que los teléfonos del perfil se comporten como los del registro.
- Evitar el guardado silencioso del correo y del contacto incompleto.
- Ofrecer paletas de color además de claro/oscuro/sistema, sin destello al cargar.

**Non-Goals:**

- Cambiar el correo de la cuenta (vive en Supabase Auth y requiere verificación).
- Mover la foto a Supabase Storage (se mantiene el data URL con tope).
- Rediseñar la pantalla del perfil.

## Decisions

### 1. Validación por dígitos y listas cerradas en `shared`

Se reutiliza `telefonoSchema` (10 dígitos, tolerante a separadores), se añade `timezoneSchema` con la lista `TIMEZONES` y `photoUrlSchema` (data URL de PNG/JPG/WebP o URL https, con tope de 5 MB). El contacto de emergencia exige nombre 2–120 y teléfono de 10 dígitos; la API ya rechaza el bloque incompleto con `400 CONTACTO_INCOMPLETO`. *Alternativa descartada*: validar solo en el cliente — la API seguiría aceptando datos sucios por llamadas directas.

### 2. El correo es de solo lectura

El campo se muestra con `readOnly` y una nota; deja de validarse y de incluirse en el guardado. *Alternativa descartada*: implementar el cambio con `auth.updateUser` — exige código de confirmación y un flujo que no forma parte de este cambio.

### 3. Máscara compartida con el registro

`TelefonoInput` y los helpers (`formatearTelefono`, `formatearTelefonoPegado`) se movieron a `components/telefono-input.tsx` y `lib/telefono.ts`; el registro los reutiliza sin duplicar. Al cargar el perfil se usa `formatearTelefonoPegado` (últimos 10 dígitos) para normalizar valores viejos como `+52 55 1234 5678`; al guardar se envía el valor enmascarado.

### 4. Modo y paleta independientes, con selector visual y migración

`ThemeMode` (`light | dark | system`) y `ThemePalette` (`default | oceano | bosque | atardecer | lavanda | cereza | sepia | contraste`) son preferencias separadas, con dos claves en `localStorage`: `psicoagenda-theme` (modo) y `psicoagenda-palette` (paleta). `resolveTheme` (pura) decide `{ isDark, dataTheme }`; `applyTheme` alterna la clase `dark` según el modo y `data-theme` solo si la paleta no es la de marca. El script inline lee ambas claves antes de hidratar.

**Migración**: si `psicoagenda-theme` contiene una paleta (formato anterior, un único valor combinado), se interpreta como `modo: "system" + esa paleta` y el script normaliza ambas claves. Así nadie pierde la selección previa.

El selector (`ThemePicker`) separa visualmente las dos decisiones: un **control segmentado** con los tres modos (el activo con fondo primario sólido) y una **cuadrícula 3×2** con las seis paletas estéticas, cada tarjeta con tres muestras (fondo, primario, acento suave) tomadas de las variables del propio tema (`data-theme` en la tarjeta). **Alto contraste** vive en una fila aparte tras un divisor, con icono de contraste y la etiqueta "Accesibilidad"; al lado, **Restablecer** vuelve a automático + paleta de marca y se deshabilita cuando ya es el estado actual. Las tarjetas y segmentos inactivos tienen hover (`bg-muted/50`, borde suave).

Cada paleta define también `--brand-psico`/`--brand-agenda`, así el wordmark "PsicoAgenda" del sidebar toma el matiz del tema; el **icono PNG queda fijo** por identidad de marca.

### 5. Blindaje contra el valor vacío de Radix

Radix Select emite `onValueChange("")` al montar si aún no registró sus items; eso borraba el tema guardado al recargar. `setTheme` ignora cualquier valor que no esté en `THEME_VALUES`.

## Risks / Trade-offs

- [Teléfonos guardados con formatos viejos] → se reformatean solo al mostrarlos; el valor se persiste con la máscara al editar.
- [Foto en base64 en la base de datos] → el tope de 5 MB acota el daño; mover a Storage queda como follow-up.
- [Paletas nuevas sobre componentes con colores fijos] → los componentes usan variables (`--primary`, `--border`, etc.), así que el cambio es global; se revisó visualmente Océano y Alto contraste.
- [Nombres históricos de más de 120 caracteres] → el perfil los rechazaría al editar; es un límite razonable y el usuario puede acortarlo.

## Migration Plan

Sin migraciones. Rollback: revertir los esquemas compartidos y los archivos del perfil/tema. Las preferencias guardadas con los valores nuevos caen a "system" si se revierte (por el guard de `THEME_VALUES`).

## Open Questions

Ninguna.
