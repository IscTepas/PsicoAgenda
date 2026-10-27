# Design

## Context

El backend se sirve como una función en un hosting que define `NODE_ENV=production` en todos los deployments, incluidos los de vista previa. La configuración de la API exige las variables obligatorias cuando ese valor está presente, de modo que un preview sin base propia arranca contra la base real. Hoy la cadena de conexión está definida para todos los entornos.

## Goals / Non-Goals

**Goals**

- Que probar un flujo nunca toque datos reales.
- Que un preview pueda ejercitar el sistema completo (login, agenda, expediente) sin pasos manuales.
- Que la configuración sea explícita y verificable, no una convención oral.

**Non-Goals**

- Alta disponibilidad del entorno aislado.
- Sincronización automática de datos entre entornos.
- Aislamiento de datos de producción frente a administradores (fuera de alcance).

## Decisions

### 1. Segundo proyecto de Supabase, no la misma base con otro esquema

Se crea un proyecto independiente para el entorno aislado.

**Alternativa descartada:** dos esquemas en la misma base. Las migraciones, los permisos por rol y los disparadores sobre identidad están atados al proyecto; separarlos por esquema obliga a duplicar configuración y multiplica el riesgo de tocar producción por error.

**Alternativa descartada:** bases efímeras por rama. Correcto a largo plazo, pero hoy no hay automatización de migraciones en CI que lo sostenga.

### 2. Variables por entorno, no por valor

La cadena de conexión y las claves del proveedor de identidad se definen solo para producción; las de vista previa apuntan al proyecto aislado. Cuando falta una, la API falla al arrancar con un mensaje explícito: es preferible un preview roto a un preview que escribe en producción.

### 3. Datos sintéticos, no copia de producción

El entorno aislado se puebla con un guion de datos de ejemplo. Copiar producción, incluso anonimizada, arrastra información clínica que no debe salir del entorno real.

**Trade-off:** los casos raros de producción no se reproducen. Se acepta: el objetivo es probar flujos, no depurar datos concretos.

## Risks / Trade-offs

- **Costo y mantenimiento de un segundo proyecto.** El plan gratuito lo cubre; el costo real es mantener migraciones y disparadores al día.
- **Configuración duplicada de identidad.** Un cambio en los disparadores debe aplicarse en ambos proyectos; se documenta en el runbook.
- **Datos sintéticos insuficientes.** Si el guion es pobre, los previews no sirven para probar; la tarea de poblado lo incluye como criterio.
