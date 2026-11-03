# Tasks

## 1. Entorno aislado

- [ ] 1.1 Crear el proyecto de base de datos del entorno aislado y aplicar las migraciones versionadas; y verificar que `prisma migrate status` queda al día y que el historial coincide con producción en número de migraciones
- [ ] 1.2 Aplicar permisos y disparadores de identidad en el proyecto aislado; y verificar que un alta de usuario crea el perfil y el paciente correspondientes
- [ ] 1.3 Cargar datos sintéticos suficientes para login, agenda, expediente y reportes; y verificar que los flujos principales funcionan sin datos de pacientes reales

## 2. Configuración por entorno

- [ ] 2.1 Acotar las variables de producción al entorno de producción y definir las de vista previa apuntando al proyecto aislado; y verificar en un preview que `GET /api/health` responde 200 contra la base aislada
- [ ] 2.2 Verificar que un preview sin variables falla al arrancar con un mensaje explícito en lugar de arrancar contra producción; y verificar el log de arranque del deployment sin configuración

## 3. Verificación del aislamiento

- [ ] 3.1 Crear un registro desde un preview y comprobar que no aparece en producción; y verificar el mismo registro en el entorno aislado
- [ ] 3.2 Ejecutar los flujos de login, agenda y expediente en un preview; y verificar que no se modifica ningún conteo de tablas en producción antes y después

## 4. Documentación

- [x] 4.1 Documentar en el README el mapa de entornos (qué entorno usa qué base y qué credenciales), cómo se promueve un cambio y qué se hace al cambiar los disparadores de identidad; y verificar que una persona nueva puede deducir la configuración sin preguntar

## Workflow follow-up

- Archivar el cambio cuando un preview haya operado de extremo a extremo sin tocar producción.

## Runbook de las tareas pendientes

Las tareas 1.x, 2.x y 3.x requieren credenciales y consolas externas. La
automatización está en `PsicoAgenda/scripts/` y el detalle operativo en el README
(«Entornos»).

1. **Proyecto aislado (1.1–1.3).** Crear un proyecto Supabase distinto al de
   producción. Ejecutar `preparar-proyecto-aislado.mjs --solo-bootstrap` para
   crear el rol `prisma` y guardar la contraseña que aparece en el notice; después
   ejecutar el script completo con `PREVIEW_PRISMA_DATABASE_URL`. El script aplica
   las 15 migraciones, `grants.sql`, los cuatro triggers y los datos sintéticos
   (`demo_accounts.sql` + `demo_data.sql`), y verifica conteos y paridad.
2. **Vercel (2.1).** Definir las variables de producción solo con alcance
   Production y las de Preview apuntando al proyecto aislado, con
   `ENTORNO_BD=preview`. En el frontend, `NEXT_PUBLIC_SUPABASE_*` y
   `NEXT_PUBLIC_API_URL` de Preview también deben apuntar al entorno aislado.
3. **Preview sin configuración (2.2).** Desplegar una rama sin `ENTORNO_BD` ni
   variables de Preview y comprobar que el arranque falla con el mensaje que
   menciona `ENTORNO_BD=preview`. El candado ya está cubierto por
   `apps/api/tests/config.preview.test.ts`.
4. **Aislamiento (3.1–3.2).** Ejecutar `verificar-aislamiento.mjs` (deja una marca
   en la base aislada y confirma que no existe en producción), recorrer login,
   agenda y expediente en el preview y volver a ejecutarlo para comparar los
   conteos de producción antes y después.
