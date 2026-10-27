# Tasks

## 1. Sonda y alerta

- [ ] 1.1 Configurar el chequeo periódico de `GET /api/health` cada 5 minutos con alerta por correo; y verificar que una respuesta 503 dispara la alerta usando una URL de prueba que devuelva ese estado
- [ ] 1.2 Definir el umbral de fallos consecutivos (dos) y verificarlo provocando un fallo de un solo ciclo, que no debe generar alerta
- [ ] 1.3 Incluir en el mensaje de alerta el componente que falló según el campo `database` del cuerpo; y verificar que el aviso distingue «API caída» de «base caída»

## 2. Medición

- [ ] 2.1 Registrar disponibilidad y latencia durante una semana completa; y verificar que el informe permite comparar el percentil alto contra el umbral de 3 segundos del requisito de rendimiento
- [ ] 2.2 Documentar la cifra obtenida y su diferencia con el requisito; y verificar que la conclusión es explícita (cumple o no cumple)

## 3. Operación

- [ ] 3.1 Escribir el runbook de incidentes: qué revisar primero para cada tipo de alerta, a quién avisar y cómo silenciar una ventana de mantenimiento; y verificar que otra persona del equipo puede seguirlo ante una alerta simulada
- [ ] 3.2 Verificar el ciclo completo de recuperación: provocar una caída sostenida, recibir la alerta, restaurar el servicio y confirmar que llega el aviso de recuperación

## Workflow follow-up

- Archivar el cambio cuando exista al menos una caída real o simulada documentada con su alerta y recuperación.
