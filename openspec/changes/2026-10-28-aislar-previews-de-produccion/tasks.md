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

- [ ] 4.1 Documentar en el README el mapa de entornos (qué entorno usa qué base y qué credenciales), cómo se promueve un cambio y qué se hace al cambiar los disparadores de identidad; y verificar que una persona nueva puede deducir la configuración sin preguntar

## Workflow follow-up

- Archivar el cambio cuando un preview haya operado de extremo a extremo sin tocar producción.
