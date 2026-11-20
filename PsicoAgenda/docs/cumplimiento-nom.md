# Cumplimiento del expediente clínico: NOM-004-SSA3-2012 y NOM-024-SSA3-2012

Qué pide cada norma, dónde lo cumple PsicoAgenda y qué le toca a la psicóloga.

- **NOM-004-SSA3-2012** (expediente clínico): qué debe contener el expediente, que no se altere, quién lo firma y cuánto tiempo se guarda.
- **NOM-024-SSA3-2012** (sistemas de registro electrónico para la salud): integridad, confidencialidad, auditoría y control de acceso del sistema.

## 1. Parte clínica (lo que llena la psicóloga)

| Requisito | Dónde se cumple |
|---|---|
| **Carátula:** nombre del consultorio, tipo de establecimiento y domicilio | Configuración → «Datos del consultorio». Se muestra en la carátula de cada expediente y al imprimirlo. |
| **Carátula:** nombre completo y cédula de la psicóloga | Perfil de la psicóloga (`psicologos.cedula_profesional`). |
| **Paciente:** número de expediente único | Se genera solo, consecutivo (`expedientes_clinicos.folio`), y se muestra como `EXP-000123`. |
| **Paciente:** nombre, edad, sexo y domicilio | Ficha del paciente, en la carátula del expediente. |
| **Conservación:** nunca borrar | No existe forma de borrar un paciente. «Dar de baja» solo lo oculta de la lista (`pacientes.eliminado_en`) y fija `conservar_hasta` a 5 años. |
| **Consentimiento informado** antes de iniciar la terapia | Expediente → «Consentimiento informado»: firma en pantalla o PDF firmado, más la aceptación del aviso de privacidad. Sin él no se pueden escribir notas de evolución. |
| **Aviso de privacidad** | Se acepta al crear la cuenta (queda la fecha en `usuarios.aviso_privacidad_aceptado_en`) y otra vez en cada consentimiento. |
| **Historia clínica, interrogatorio:** motivo de consulta, problema actual, antecedentes heredofamiliares, no patológicos y patológicos | Expediente → «Historia clínica psicológica», sección 1. |
| **Historia clínica, exploración:** examen del estado mental (apariencia, conducta, ánimo, lenguaje, pensamiento, memoria, orientación y juicio) | Sección 2. |
| **Historia clínica, evaluación:** pruebas psicométricas o escalas aplicadas | Sección 3. |
| **Historia clínica, conclusión:** impresión diagnóstica, pronóstico y plan terapéutico | Sección 4. El código diagnóstico se busca en el capítulo F de la CIE-10 y también acepta CIE-11. |
| **Notas de evolución:** fecha y hora del servidor, evolución, intervenciones y plan | Bitácora: una hoja por sesión. La fecha la pone el servidor o la toma de la cita. |
| **Nota de interconsulta o referencia** | Bitácora → «Interconsulta». |
| **Nota de egreso o alta terapéutica** | Bitácora → «Egreso». Al cerrarla, el expediente pasa a inactivo y se conserva 5 años. |
| **Impresión del expediente** | Expediente → «Imprimir expediente»: carátula, consentimientos, historia y notas con su sello. |

## 2. Parte técnica (candados automáticos)

| Requisito | Cómo se cumple |
|---|---|
| **Notas que no se alteran** | Cada nota y la historia clínica tienen dos estados: `BORRADOR` y `CERRADA`. Una vez cerrada, la base de datos rechaza cualquier `UPDATE` o `DELETE` (triggers `trg_nota_cerrada_inmutable` y `trg_historia_cerrada_inmutable`), aunque alguien entre directo por SQL. |
| **Historial de borradores** | Al editar un borrador, la versión anterior se guarda en `revisiones_bitacora`. |
| **Notas aclaratorias** | Para corregir una nota cerrada se agrega una nota aclaratoria ligada a la original (`nota_padre_id`). La original no cambia. |
| **Sello de integridad** | Cerrar una nota o la historia pide la contraseña y guarda un SHA-256 de `contenido + cédula + paciente_id + hora del servidor` (`apps/api/src/lib/sello.ts`). `GET /api/log-entries/:id/verificar` recalcula el sello y detecta cualquier cambio. |
| **Bitácora de auditoría** | `registros_auditoria` guarda quién consultó el expediente o la bitácora, qué nota creó, editó, cerró o aclaró, qué consentimiento registró o descargó, cuándo imprimió y cuándo dio de baja; con IP y hora del servidor. Es de solo inserción (trigger `trg_auditoria_solo_insercion`). Se consulta en Expediente → «Accesos». |
| **Regla de flujo** | No se pueden crear notas de evolución sin consentimiento vigente y con la historia clínica en borrador. Lo revisa la API (409) y también se explica en pantalla: en la libreta, en «Atender» y en la bitácora. |
| **Control de acceso** | Solo la psicóloga dueña del paciente (o un administrador) ve el expediente. El paciente no tiene acceso (`requirePatientAccess`). |
| **Confidencialidad** | Conexión cifrada (HTTPS en Vercel), datos cifrados en reposo (Supabase). Los PDF de consentimiento van en un bucket privado y se abren con un enlace que dura 5 minutos. |
| **Conservación** | Los datos clínicos nunca entran a la limpieza automática (`mantenimiento.service.ts`). |

## 3. Lo que le toca a la psicóloga (no lo puede hacer el sistema)

- Guardar los originales en papel de los consentimientos firmados.
- Escribir con claridad y sin abreviaturas.
- Cerrar cada nota el mismo día de la sesión: una nota en borrador todavía no cuenta como firmada.
- Llenar los datos del consultorio en Configuración.
- Revisar con el proveedor que Supabase tenga respaldos automáticos según el plan contratado.

## 4. Puesta en marcha

1. Aplicar la migración `20261120000000_nom004_expediente` desde `PsicoAgenda/apps/api`:
   ```bash
   npx prisma migrate deploy
   ```
   La migración cierra y sella todas las notas que ya existían, tal como están, y crea los candados.
2. El bucket privado `consentimientos` se crea solo con el primer PDF que se suba.
