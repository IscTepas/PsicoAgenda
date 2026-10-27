# Design

## Context

`tutores` es una tabla de contacto (`nombre_completo`, `telefono`, `parentesco`) sin identidad. `pacientes.tutor_legal_id` es una clave foránea única: un tutor por paciente. `consentimientos_informados.tutor_legal_id` también apunta a `tutores`, y el registro de menores exige los datos del tutor.

La autorización actual se resuelve por rol (`PACIENTE`, `PSICOLOGO`, `ADMINISTRADOR`) y por pertenencia del recurso al usuario autenticado. Un tutor no encaja en ninguna de las dos: opera sobre el recurso de otra persona.

## Goals / Non-Goals

**Goals**

- Que un paciente adulto pueda ser tutor de un menor sin duplicar identidad.
- Co-tutela real (madre y padre), con un principal.
- Permisos acotados: agenda y avisos, nunca contenido clínico.

**Non-Goals**

- Credenciales del menor (quién inicia sesión por él): cambio aparte.
- Historial de cambios del vínculo (auditoría de tutela).
- Tutela de personas mayores de edad.

## Decisions

### 1. `tutores` es la persona; `pacientes_tutores` es el vínculo

`tutores` gana `usuario_id` (nullable, único cuando existe) y la relación pasa a una tabla puente con `es_principal`. Así una persona tutora de tres hermanos existe una sola vez y `consentimientos_informados` sigue apuntando a la persona que firmó.

**Alternativa descartada:** mover los datos del tutor a la tabla puente. Duplicaría a la persona por cada menor y rompería la referencia del consentimiento.

### 2. Un principal garantizado por índice parcial

`CREATE UNIQUE INDEX ... ON pacientes_tutores (paciente_id) WHERE es_principal` reutiliza el patrón que el proyecto ya usa en `contactos_emergencia`. La regla queda en la base, no solo en el servicio.

### 3. La autorización se resuelve por vínculo

Se añade una comprobación explícita: un usuario puede operar sobre un paciente si es ese paciente, si es su tutor vinculado, si es su psicólogo o si es administrador. El rol por sí solo ya no alcanza para decidir.

**Trade-off:** más consultas por petición. Se resuelve con una sola consulta que traiga paciente, vínculo y psicólogo.

### 4. El tutor no ve el expediente

La información clínica pertenece al paciente y al psicólogo. El tutor gestiona logística, no clínica. Esto además es coherente con el requisito existente de visibilidad del detalle de cita por rol: el tutor es un usuario con rol `PACIENTE`, al que ya se le ocultan los datos clínicos.

### 5. Backfill antes de eliminar la columna

La migración crea la tabla puente, copia cada `pacientes.tutor_legal_id` como vínculo principal y **solo después** elimina la columna. La verificación compara conteos antes y después: tantos vínculos como pacientes con tutor había.

**Riesgo:** es la migración más delicada del proyecto hasta ahora. Se ejecuta primero en el entorno aislado, con respaldo reciente.

## Risks / Trade-offs

- **Migración destructiva.** Se mitiga con el orden anterior, la verificación por conteo y una copia previa.
- **Permisos dispersos.** Cada endpoint debe usar la misma comprobación; se centraliza en un solo guard para no repetir lógica.
- **Confusión de roles.** Un tutor sigue viendo la aplicación como paciente; la UI debe dejar claro a quién está gestionando.
