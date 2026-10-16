# Tasks: Cuenta demo de paciente en la base de datos

- [x] Documentar el cambio con OpenSpec (proposal, design, tasks).
- [x] Crear `apps/api/prisma/supabase/demo_accounts.sql` (idempotente): alta/asegurado en `auth.users` + `auth.identities`.
- [x] Incluir respaldo de perfil (`public.usuarios`, `public.pacientes`) y consultas de verificación comentadas.
- [x] Validar el change con OpenSpec CLI.
- [x] Aplicar el script en Supabase SQL Editor como `postgres` (paso manual del usuario).
- [x] Verificar login demo de paciente y filas en `public.usuarios` (rol `PACIENTE`) y `public.pacientes`.
- [x] Archivar el change y crear el espejo en Obsidian.
