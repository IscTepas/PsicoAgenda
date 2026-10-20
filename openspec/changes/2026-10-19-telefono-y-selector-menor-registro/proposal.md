# Proposal

## Why

El formulario de registro acepta teléfonos en cualquier formato (`+52 55 1234 5678`, con espacios, paréntesis o sin separadores) y valida por **longitud del texto**, no por dígitos: un número incompleto como `555-123-456` (9 dígitos, 11 caracteres) pasa la validación. Además, la única forma de saber que harán falta los datos del tutor es escribir una fecha de nacimiento de menor, así que quien registra a un menor lo descubre al final del formulario.

## What Changes

- Teléfono local de **10 dígitos con máscara `555-123-4567`** en los tres campos del registro (personal, contacto de emergencia y tutor): solo dígitos, máximo 10, agrupados automáticamente; si se pega con lada se toman los últimos 10.
- La validación compartida (`packages/shared`) pasa a contar **10 dígitos exactos** en lugar de longitud del texto, para que la web y la API validen igual.
- Selector **"¿Para quién es la cuenta?"** (`Para mí` / `Para un menor a mi cargo`) al principio del formulario: muestra el bloque del tutor de inmediato y valida que la elección coincida con la fecha de nacimiento. **La fecha sigue siendo la fuente de verdad**: el servidor deriva `is_minor` de ella.

## Capabilities

### Modified Capabilities

- `user-management`: el registro SHALL validar los teléfonos como números locales de 10 dígitos y SHALL ofrecer la declaración de minoría, coherente con la fecha de nacimiento.

### New Capabilities

(None)

## Impact

- `packages/shared/src/schemas/index.ts`: nuevo `telefonoSchema`; `phone` y `emergencyContactSchema.phone` lo usan.
- `apps/web/src/services/registro.service.ts`: `formatearTelefono` y `formatearTelefonoPegado`.
- `apps/web/src/app/registro/register-form.tsx`: máscara en los tres teléfonos, selector de minoría y validación cruzada; se elimina el `isMinor` local que se sincronizaba con un efecto.
- No se modifica el esquema de base de datos ni los contratos de la API: el payload mantiene la misma forma y el servidor sigue derivando `is_minor` de `birth_date`.
