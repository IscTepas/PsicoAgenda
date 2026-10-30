# Tasks

## 1. Almacenamiento y tokens (API)

- [x] 1.1 Implementar el servicio de tokens de recuperación sobre `cache_registro` (32 bytes aleatorios, huella SHA-256, claves con prefijo `recuperacion:`, caducidad de 30 minutos) y verificar con tests que un token vencido o ya usado se rechaza
- [x] 1.2 Implementar los límites de solicitud por correo y por origen con el `incr` existente; y verificar con tests que se agota la ventana y que responde el tiempo restante

## 2. Endpoints

- [x] 2.1 Implementar `POST /api/auth/recuperacion/solicitar` con respuesta uniforme exista o no la cuenta; y verificar con tests los casos: cuenta existente (envía), cuenta inexistente (misma respuesta, no envía) y exceso de solicitudes
- [x] 2.2 Implementar `POST /api/auth/recuperacion/confirmar` validando el token y actualizando la contraseña con el proveedor de identidad; y verificar con test que el token queda inutilizado tras el cambio
- [x] 2.3 Añadir la plantilla de correo al mailer con el enlace construido desde la URL pública del frontend; y verificar con test que el cuerpo contiene el enlace y no el código de registro

## 3. Interfaz

- [x] 3.1 Cambiar la pantalla de solicitud para llamar a la API; y verificar con test que ya no invoca `resetPasswordForEmail`
- [x] 3.2 Implementar la pantalla de nueva contraseña que consume el token del enlace, valida la contraseña con las reglas compartidas y muestra el error cuando el token no sirve; y verificar con tests los casos: éxito, token vencido y contraseña inválida

## 4. Verificación de extremo a extremo

- [ ] 4.1 Ejecutar el flujo completo contra el entorno desplegado (solicitar, recibir el correo, cambiar la contraseña e iniciar sesión con la nueva) y verificar que el correo llega desde el remitente propio y no desde Supabase
- [ ] 4.2 Verificar que reutilizar el mismo enlace una segunda vez falla con un mensaje claro
- [x] 4.3 Actualizar el README y `.env.example` para retirar la nota del límite de dos correos por hora del SMTP de Supabase; y verificar que el documento ya no describe ese camino como vigente

## Workflow follow-up

- Archivar el cambio después de la verificación de extremo a extremo en el entorno desplegado.
