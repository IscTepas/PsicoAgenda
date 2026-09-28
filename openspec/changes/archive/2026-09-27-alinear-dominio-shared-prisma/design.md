# Design: Alinear dominio compartido con Prisma 7

## Decisions

1. **Prisma es la fuente primaria de verdad para el modelo de datos.**
   - `packages/shared` replica enums y shape básico de las entidades para consumo del frontend y del backend sin importar `@prisma/client` en la web.
2. **Las relaciones faltantes se cierran ahora**, aprovechando que aún no hay migraciones aplicadas.
3. **Los campos `createdAt`/`updatedAt` siguen a Prisma.**
   - `ClinicalRecord` no tiene `createdAt` en Prisma, solo `openedAt` + `updatedAt`.
4. **Notificaciones pasan de `recipientId` a `patientId` + `appointmentId`** para coincidir con Prisma y permitir notificaciones tanto a pacientes como contextuales a citas.
5. **No se cambian funciones existentes ni se agregan endpoints.**

## Schema changes

### Prisma

- `InformedConsent`:
  - `legalGuardian LegalGuardian? @relation("GuardianConsents", fields: [legalGuardianId], references: [id], onDelete: SetNull)`
  - `@@index([legalGuardianId])`
- `LegalGuardian`:
  - `consents InformedConsent[] @relation("GuardianConsents")`
- `Report`:
  - `generatedBy User? @relation(fields: [generatedById], references: [id], onDelete: SetNull)`
  - `@@index([generatedById])`
- `LogEntry`:
  - `psychologist Psychologist @relation(fields: [psychologistId], references: [id], onDelete: Cascade)`
  - Nota: `psychologistId` pasa a requerido si se cierra la relación. Revisar si el negocio permite logs sin psicólogo asignado.

### Shared types

- Enums añadidos/actualizados:
  - `UserRole` + `ADMIN`
  - `AppointmentStatus`: `PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW`
  - `AppointmentModality`: `IN_PERSON | VIRTUAL`
  - `AttendanceStatus`: `ATTENDED | NO_SHOW`
  - `RecordStatus`: `ACTIVE | INACTIVE`
  - `NotificationStatus`: `PENDING | SENT | FAILED | CANCELLED`
  - `ConsentStatus`: `SIGNED | WITHDRAWN | EXPIRED`
- Interfaces ajustadas:
  - `Appointment`: modality como enum, + `attendanceStatus?`
  - `ClinicalRecord`: `createdAt` → `updatedAt`
  - `Notification`: `recipientId` → `patientId?` + `appointmentId?`, + `scheduledFor?`, `error?`, `attempts`
  - `LegalGuardian`: + `id`, `documentId?`, `relationship?`, `createdAt`
  - `EmergencyContact`: + `id`, `isPrimary`, `createdAt`
  - `Patient`: + `isMinor`, `psychologistId?`
  - `LogEntry`: + `updatedAt`
  - + `InformedConsent` interface

## Validation

- `prisma format && prisma validate && prisma generate`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm test`
- `openspec validate 2026-09-27-alinear-dominio-shared-prisma`
