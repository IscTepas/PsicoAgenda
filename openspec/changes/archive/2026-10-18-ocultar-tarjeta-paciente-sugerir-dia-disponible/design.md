# Design

## Context

El flujo de citas vive en `apps/web/src/app/(app)/agenda/`:

- `agenda-client.tsx`: calendario y diálogo de detalle. El **cuerpo** del diálogo ya bifurca por rol (`isPatient ? "Profesional tratante" : tarjeta con datos del paciente`). El **footer** no: el botón "Ver Expediente" se renderiza con `{patient?.id && …}`, así que también lo ve un paciente.
- `components/appointment-form.tsx`: formulario de solicitud/edición. Hoy sugiere el próximo día con horario definido cuando la fecha elegida no tiene franjas, con un botón para navegar. Se queda así (ver Non-Goals).

El rol se deriva de `useSession()` con fallback por correo (`isPatient`). La API ya acota los datos por rol; el problema es de interfaz.

## Goals / Non-Goals

**Goals:**

- Ocultar el botón "Ver Expediente" del footer del diálogo cuando el usuario tiene rol PACIENTE, dejando intactos "Cerrar" y "Modificar Cita".
- Dejar el lint de `apps/web` sin errores en los dos archivos que el cambio toca.

**Non-Goals:**

- No se rediseña la sugerencia de próximo día disponible: se mantiene el comportamiento actual (día con horario definido + botón "Ir al…"). Queda como follow-up mostrar sus franjas libres, descartar días llenos y mover fecha y hora al elegir una franja.
- No se modifica el esquema de base de datos, la API ni el `proxy.ts` (la ruta `/pacientes/:path*` sigue requiriendo sesión; el acotamiento de datos lo hace la API).
- No se añaden pantallas ni rutas.

## Decisions

### 1. Condicionar el botón del footer al rol (`agenda-client.tsx`)

**Decisión:** envolver el botón "Ver Expediente" en `!isPatient`, junto a la condición `patient?.id` que ya tenía.

**Razón:** es el único punto del diálogo que filtra información por rol incorrectamente. La tarjeta ya está condicionada; tocar el cuerpo sería redundante. Se conservan "Cerrar" y "Modificar Cita" porque no exponen datos clínicos (alternativa descartada: ocultar todo el footer a pacientes).

### 2. Errores de ESLint preexistentes: estado derivado en lugar de sincronización por efecto

**Decisión:** corregir los 5 errores en los dos archivos del cambio.

- `agenda-client.tsx`: los estados `paymentUpdating`/`paymentError` se declaran después del `useCallback` que los usa; se mueven antes de su primera referencia.
- `appointment-form.tsx`: las reglas `react-hooks/set-state-in-effect` marcan dos efectos que ajustan estado (`selectedHour` cuando no existe en el día, y `durationMinutes` cuando el paciente es menor). Se eliminan y se pasa a **valores derivados** en el render:
  - `horaElegida = availableHours.includes(selectedHour) ? selectedHour : availableHours[0] ?? selectedHour`, usado en la vista previa, la validación y el payload.
  - `durationMinutesEfectivos = getEffectiveDurationMinutes(isMinorPatient, durationMinutes)` (30 para menores), usado en la vista previa, el selector y los tres payloads.

**Razón:** los efectos provocaban renders en cascada y, en el caso de `durationMinutes`, el payload podía enviar la duración del estado (50) en lugar de la efectiva (30) si el efecto aún no había corrido. Con valores derivados el dato enviado siempre coincide con lo que se muestra, y el lint queda en verde. `set-state-in-render` también existe en este plugin, así que la solución no es mover `setState` al render.

## Risks / Trade-offs

- [Ocultar "Ver Expediente" a un paciente que legítimamente quiera ver su ficha] → el diálogo de agenda no es el camino diseñado para ese rol; si surge la necesidad se añadirá un acceso propio en el dashboard del paciente.
- [Derivar `selectedHour` cambia un matiz de UX] → al volver a un día anterior se conserva la última hora elegida para ese día en lugar de sobrescribirla; es el comportamiento derivado esperado y no afecta a lo que se envía.
- [Cambiar `durationMinutes` por su valor efectivo en el payload] → corrige un envío potencialmente inconsistente para menores; el backend aplica la misma regla (`getEffectiveDurationMinutes`), así que no hay incompatibilidad.

## Migration Plan

Sin migraciones ni cambios de API. Es un cambio de interfaz retrocompatible. Rollback: revertir los dos archivos.

## Open Questions

Ninguna.
