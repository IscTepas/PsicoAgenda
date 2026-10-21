# Tasks

## 1. Validaciones compartidas

- [x] 1.1 Agregar la lista `TIMEZONES` en `packages/shared/src/constants` y usarla en la web (el selector arma sus etiquetas desde ahí)
- [x] 1.2 Endurecer `updatePatientProfileSchema` y `updatePsychologistProfileSchema`: nombre 2–120, `telefonoSchema` en los teléfonos, `timezoneSchema`, `photoUrlSchema` (data URL de imagen o https, tope 5 MB), contacto de emergencia con nombre 2–120 y cédula con formato; reconstruir el paquete
- [x] 1.3 Mantener la API sin cambios de contrato: los endpoints ya validaban con esos esquemas y ahora rechazan los valores sucios

## 2. Pantalla de perfil

- [x] 2.1 Quitar el badge "Rol: …" de la cabecera y la etiqueta "Expediente Activo" / "Especialista Clínico" del bloque de la foto
- [x] 2.2 Dejar el correo de solo lectura, sin validarlo ni enviarlo, con la nota de que se cambia desde la cuenta
- [x] 2.3 Usar `TelefonoInput` (máscara 3-3-4) en el teléfono y en el de emergencia, y reformatear al cargar con `formatearTelefonoPegado` (los formatos viejos `+52 …` quedan en 10 dígitos)
- [x] 2.4 Validar en el cliente antes de guardar: nombre 2–120, teléfono de 10 dígitos si viene, contacto de emergencia con nombre y teléfono juntos, cédula de 4–30 caracteres válidos y especialidad ≤ 120
- [x] 2.5 Enviar `phone` y `emergencyContactPhone` como `undefined` cuando están vacíos, y no enviar el correo

## 3. Temas de interfaz

- [x] 3.1 Separar modo y paleta en el modelo (dos claves en `localStorage`), con `resolveTheme`/`resolveIsDark` puros, `applyTheme` (clase `dark` + `data-theme`) y el script anti-destello leyendo ambas; migración del valor combinado anterior a automático + paleta
- [x] 3.2 Definir las siete paletas en `globals.css` con sus variantes clara y oscura (acento, anillo, acentos suaves, gráficos, sidebar y `--brand-*`); Sepia ajusta además fondo, tarjeta, borde y texto
- [x] 3.3 Rediseñar `ThemePicker`: modo en control segmentado con el activo en fondo primario sólido; paletas en cuadrícula 3×2 con tres muestras tomadas de las variables del propio tema; Alto contraste separado por un divisor con icono y etiqueta de accesibilidad, y botón Restablecer al lado
- [x] 3.4 Añadir hover a segmentos, tarjetas y accesibilidad (`bg-muted/50`, borde suave) y reforzar la tarjeta activa con borde, anillo, check y `bg-primary/5`
- [x] 3.5 Persistir ambas preferencias, normalizar las claves al migrar y deshabilitar Restablecer cuando ya está en automático + paleta de marca

## 4. Verificación

- [x] 4.1 Tests nuevos: `resolveThemeState`, valores de tema y validaciones de los dos esquemas (web **56/56**; API **87/87** sin las suites de integración)
- [x] 4.2 `npm run typecheck` en web y API, y ESLint de los archivos tocados, sin errores
- [x] 4.3 Prueba de UI con Playwright: sin badge de rol; correo no editable; teléfonos reformateados al cargar y enmascarados al escribir; contacto incompleto bloqueado sin PATCH; payload con teléfonos enmascarados y sin correo; Océano aplicado y persistido tras recargar; Alto contraste aplicado
- [x] 4.4 Verificación del selector visual: 3 modos y 6 paletas; el segmento activo usa `bg-primary` y las tarjetas inactivas tienen hover; elegir Océano no cambia el modo; elegir Oscuro mantiene Océano; Cereza + Oscuro persisten juntos tras recargar; Restablecer deja `system` + marca y se deshabilita; la migración de `lavanda` queda como automático + lavanda con claves normalizadas; el wordmark cambia de color

## Workflow follow-up

- Archivar el cambio tras la revisión y `openspec validate` en verde.
