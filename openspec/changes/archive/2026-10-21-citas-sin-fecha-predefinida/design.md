# Design

## Context

`appointment-form.tsx` comparte el flujo de paciente (solicitud) y psicólogo (cita) y la edición. La fecha inicial caía en `new Date()` y la hora en `10:00`; `availableHours` solo filtraba por el día de la semana del horario del profesional y `slotAvailability` por citas ocupadas, sin comparar con la hora actual. La API (`createAppointmentRequest`) rechaza `startTime <= now`, pero no impide una solicitud para hoy.

## Goals / Non-Goals

**Goals:**

- No sugerir fecha ni hora en una cita nueva.
- Impedir que el paciente solicite para hoy y que se ofrezcan horas pasadas.
- Dar una señal visual de la disponibilidad del día elegido.
- No preseleccionar una franja ocupada.

**Non-Goals:**

- Reemplazar el input nativo por un calendario con días coloreados.
- Imponer la regla de "no hoy" en la API (requiere la zona horaria del paciente).
- Cambiar precios, duración o el flujo de aprobación.

## Decisions

### 1. Fecha vacía por defecto

`selectedDate` y la hora arrancan en `null` / `""`; solo la edición y los parámetros `?fecha=` / `?hora=` (enlaces desde la agenda) los precargan. El preview y la tarjeta de horas muestran un estado vacío hasta que se elige una fecha.

### 2. Mínimo por rol, con fecha efectiva

`fechaMinimaPara` devuelve mañana para el paciente, hoy para el psicólogo y `null` en edición. La fecha elegida se compara con el mínimo y, si es anterior, se muestra la mínima (así "hoy" se convierte en mañana). El input usa `min` solo después de hidratar, para no mezclar el reloj del servidor con el del navegador.

### 3. Filtro de horas con una excepción

`filtrarHorasDisponibles(horas, fecha, ahora, horaExenta)` solo filtra cuando la fecha es hoy: descarta las franjas cuya hora de inicio ya pasó. `horaExenta` mantiene visible la hora de la cita que se edita. `ahora` es estado y se refresca al cambiar de fecha o al usar los atajos.

### 4. Color en el preview, no en un calendario

`calcularEstadoFecha` distingue sin fecha, consultando, fecha no permitida, día sin horario, día lleno y disponible. El preview pinta borde/fondo/ícono y una etiqueta con texto ("10 horarios libres", "Día completo", "Sin horario"), además de una leyenda, para no depender solo del color. El estado espera a que carguen el horario y las citas del día.

### 5. Preselección solo de franjas libres

`selectedHourEfectivo` usa la hora elegida si sigue libre; si no, la primera franja libre; si el día está lleno, no hay selección y el costo no se muestra. Antes se preseleccionaba la primera franja del horario aunque estuviera ocupada.

### 6. Validación en el cliente

Al enviar se exige fecha, mínimo por rol y que el inicio sea futuro. La API sigue siendo la autoridad final; no se modificó.
