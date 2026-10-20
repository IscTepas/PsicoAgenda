# Design

## Context

El registro (`/registro`) se valida en el cliente con un esquema zod local y otra vez en la API con `registroPacienteSchema` de `packages/shared`. El servidor deriva la minoría de `birth_date` con `esMenorDeEdad()` y exige tutor cuando corresponde; el formulario nunca envía `isMinor`.

## Goals / Non-Goals

**Goals:**

- Teléfonos de 10 dígitos con formato visible `555-123-4567`, validados por cantidad de dígitos.
- Que la persona sepa desde el principio si necesitará los datos del tutor.

**Non-Goals:**

- Cambiar el modelo de datos o el contrato de la API.
- Hacer que el selector sustituya a la fecha: la fecha manda y el servidor la usa.
- Migrar o reformatear teléfonos ya guardados.

## Decisions

### 1. Máscara en el cliente y validación por dígitos en shared

`formatearTelefono` descarta todo lo que no sea dígito, recorta a 10 y agrupa 3-3-4; `formatearTelefonoPegado` toma los últimos 10 cuando el pegado trae lada. `telefonoSchema` en `packages/shared` valida `replace(/\D/g, "").length === 10`, así que la API revalida exactamente lo mismo. *Alternativa descartada*: exigir un regex de formato exacto — rechazaría valores legítimos pegados con paréntesis o espacios y no arreglaría el falso positivo de 9 dígitos.

### 2. Selector de minoría subordinado a la fecha

`esMenor = esMenorDeEdad(birthDate) || paraMenor === "si"`: si hay fecha, decide la fecha; mientras no la haya, decide el selector. El `superRefine` exige que coincidan cuando ambas existen. *Alternativa descartada*: selector autoritativo — permitiría declarar "adulto" con una fecha de menor y la API rechazaría el alta al final, con un error tardío.

## Risks / Trade-offs

- [Números pegados con lada de otro país] → se toman los últimos 10 dígitos; el campo es para un teléfono local de 10.
- [Teléfonos ya guardados con otro formato] → no se migran; la validación aplica solo a registros nuevos.

## Migration Plan

Sin migraciones de base de datos. Rollback: revertir el esquema compartido y los dos archivos de la web.

## Open Questions

Ninguna.
