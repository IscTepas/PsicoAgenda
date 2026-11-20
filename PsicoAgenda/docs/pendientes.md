# Pendientes

Cosas que funcionan pero todavía hay que cambiar.

## Cobro de citas

**Estado:** funciona, pero no convence cómo se ve ni cómo se usa. Hay que rediseñarlo.

### Cómo está hoy

- Cada cita nace con su cobro **por cobrar**, con la tarifa que calcula la app (adulto, menor, en línea, recargo del mismo día). Vive en la tabla `pagos_honorarios`.
- Hay una sola tarjeta de cobro: [`apps/web/src/components/cobro-cita.tsx`](../apps/web/src/components/cobro-cita.tsx). Permite:
  - cambiar el monto (descuento o sesión más cara);
  - **Cobrado** (guarda la fecha de pago);
  - **Sin costo** (condonada);
  - **Deshacer** (regresa a por cobrar).
- Esa tarjeta aparece en:
  1. el diálogo de **Atender** en Inicio, antes de cerrar la sesión (`dashboard/sesion-dialog.tsx`);
  2. **Detalles** de la cita en Inicio (mismo archivo);
  3. el detalle de la cita en la **Agenda** (`agenda/agenda-client.tsx`);
  4. **Reportes → Sesiones sin cobrar**: botón rápido "Cobrado" por renglón, y al tocar el nombre se abre la tarjeta (`reportes/page.tsx`).
- API: `PATCH /appointments/:id/payment` con `{ status, amount? }`. `status` puede ser `paid`, `waived` o `pending`.

### Qué falta decidir o cambiar

- [ ] Rediseñar la tarjeta de cobro: cómo se ve y en qué momento aparece.
- [ ] Decidir si el cobro se pide al cerrar la sesión o se maneja aparte, por ejemplo una sección de "Cobros".
- [ ] ¿Guardar el método de pago (efectivo, transferencia, tarjeta)? Requiere una migración: hoy no hay columna.
- [ ] ¿Pagos parciales o paquetes de varias sesiones? Hoy es un solo pago por cita.
- [ ] Si se ajusta el monto y luego se usa "Deshacer", el monto ajustado se queda. Decidir si debe volver a la tarifa.
- [ ] ¿El paciente ve su estado de pago? Hoy solo lo ve en el detalle de la cita de la Agenda.

## Expediente clínico (NOM-004 / NOM-024)

Ya implementado; el detalle está en [cumplimiento-nom.md](cumplimiento-nom.md).

- [ ] Aplicar la migración `20261120000000_nom004_expediente` (`npx prisma migrate deploy` desde `apps/api`).
- [ ] Que la psicóloga llene los datos del consultorio en Configuración.
- [ ] Confirmar con el proveedor que Supabase tenga respaldos automáticos.
