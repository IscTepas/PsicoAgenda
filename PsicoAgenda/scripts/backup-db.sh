#!/usr/bin/env bash
# Copia cifrada de la base (ticket 2026-10-28-copias-de-seguridad-de-datos-clinicos).
#
#   BACKUP_DATABASE_URL  rol postgres, conexión directa o session pooler (5432; el 6543 no admite pg_dump)
#   AGE_RECIPIENT        clave PÚBLICA de age (age1…). La privada NO vive aquí, ni en el repo, ni en
#                        el bucket: la custodia el responsable del proyecto (gestor de contraseñas +
#                        copia impresa). Sin ella las copias no se pueden abrir; con ella, cualquiera.
#   BACKUP_S3_URI        p. ej. s3://psicoagenda-copias (opcional: sin él solo deja el archivo local)
#   AWS_*                credencial S3 de SOLO ESCRITURA; AWS_ENDPOINT_URL para R2/B2
#
# Uso: scripts/backup-db.sh  →  psicoagenda-AAAA-MM-DD.tar.age
set -euo pipefail

: "${BACKUP_DATABASE_URL:?Falta BACKUP_DATABASE_URL}"
: "${AGE_RECIPIENT:?Falta AGE_RECIPIENT}"

fecha=$(date -u +%F)
dir="psicoagenda-${fecha}"
archivo="${dir}.tar.age"
mkdir -p "$dir"

# Formato custom (-Fc) ya va comprimido; sin dueños ni permisos para restaurar en otro proyecto.
# public = datos de la app. De auth solo los DATOS de las cuentas: el esquema lo crea Supabase en
# el proyecto destino, y sin estas filas los perfiles restaurados no tendrían con qué iniciar sesión.
pg_dump "$BACKUP_DATABASE_URL" -Fc --no-owner --no-privileges --schema=public -f "$dir/public.dump"
pg_dump "$BACKUP_DATABASE_URL" -Fc --no-owner --no-privileges --data-only   --table=auth.users --table=auth.identities -f "$dir/auth.dump"

# Una copia ilegible no es copia: se valida antes de cifrar.
pg_restore --list "$dir/public.dump" > /dev/null
pg_restore --list "$dir/auth.dump" > /dev/null

tar -cf - "$dir" | age -r "$AGE_RECIPIENT" -o "$archivo"
rm -rf "$dir"
echo "Copia cifrada: $archivo ($(du -h "$archivo" | cut -f1))"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  # La retención la aplica el bucket (regla de ciclo de vida): la credencial no puede borrar.
  aws s3 cp "${archivo}" "${BACKUP_S3_URI}/diaria/${archivo}"
  if [ "$(date -u +%d)" = "01" ]; then
    aws s3 cp "${archivo}" "${BACKUP_S3_URI}/mensual/${archivo}"
  fi
fi
