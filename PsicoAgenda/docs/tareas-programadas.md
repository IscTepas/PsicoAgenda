# Tareas programadas (cron) — lo que hay que configurar

Este documento es para quien administre los cron jobs (cron-job.org u otro
programador). La API **no** corre nada sola en Vercel: cada tarea de abajo
necesita un job externo que llame a su URL.

## ¿Qué es esto y por qué hace falta?

La API vive en Vercel, que solo trabaja cuando alguien le hace una petición
(abrir una página, guardar una cita). Entre una petición y otra no corre nada.

Pero hay cosas que deben pasar solas: mandar el recordatorio de una cita,
enviar los correos y WhatsApp que se quedaron en cola (confirmaciones,
cancelaciones, tareas de la bitácora), el resumen de las 8 p.m. para la
psicóloga y quitar a los tutores cuando un paciente cumple 18. La app no las
envía en el momento: las anota en una lista de "pendientes por enviar".

El **workflow de despachar notificaciones** es un despertador: le dice a GitHub
que cada 5 minutos le dé un "toque" a la API en una dirección especial. Con cada
toque la API revisa esa lista y manda lo que ya toca. Una vez al día también da
el toque del resumen de las 8 p.m. y el de los tutores. De paso revisa que la
API esté funcionando y, si no responde dos veces seguidas, GitHub manda un correo
de alerta.

**Sin este workflow (o un cron que haga lo mismo), las notificaciones se quedan
guardadas y nunca salen.**

## Lo que falta para que funcione

- [ ] Subir el workflow al repositorio (`.github/workflows/despachar-notificaciones.yml`,
      ya está en el código; falta el commit y el push).
- [ ] Confirmar con Jose Tadeo por qué lo borró el 10 de noviembre (commit
      "Delete .github/workflows/despachar-notificaciones.yml"), para que no se
      vuelva a borrar.
- [ ] En GitHub, *Settings → Secrets and variables → Actions*: crear el secret
      `CRON_SECRET` y la variable `API_URL` (ver "Quién dispara cada tarea").
- [ ] Correrlo una vez a mano (*Actions → Despachar notificaciones → Run workflow*)
      y revisar que salga en verde.

## Lo que necesitas

- La URL de la API en producción. En los ejemplos: `https://psicoagenda-api.vercel.app`
  (cámbiala si el dominio es otro).
- El valor de `CRON_SECRET`, la misma variable de entorno configurada en Vercel
  para la API. Pídesela a quien administra Vercel; no se comparte por chat.

Todas las tareas usan lo mismo:

| Campo | Valor |
|---|---|
| Método | `POST` |
| Cabecera | `Authorization: Bearer <CRON_SECRET>` |
| Cuerpo | vacío |
| Zona horaria | `America/Mazatlan` |
| Timeout | 30 s |
| Reintentos | activados, con aviso por correo si falla |

Respuestas: `200` = funcionó. `401` = el secreto está mal. `503` = falta
`CRON_SECRET` en Vercel.

## Las tareas

| # | Qué hace | URL (después del dominio) | Cuándo |
|---|---|---|---|
| 1 | **Envía los avisos** encolados (correo y WhatsApp: confirmaciones, recordatorios, tareas, el resumen de las 8 p.m.). Sin esta, no sale ningún correo. | `/api/internal/despachar` | **Cada 5 minutos** |
| 2 | **Resumen de bitácora (nuevo):** a las 8 p.m. le manda a la psicóloga un correo si le quedaron sesiones sin cerrar o sin bitácora. | `/api/internal/resumen-bitacora` | Diario **20:00** |
| 3 | **Fin de tutela:** cuando un paciente menor cumple 18, quita a sus tutores y les avisa. | `/api/internal/finalizar-tutelas` | Diario **07:00** |
| 4 | **Mantenimiento:** borra las notificaciones 24 horas después de enviarse (las pendientes nunca) y limpia solicitudes viejas. No toca datos clínicos. | `/api/internal/mantenimiento` | **Cada hora** |

> La tarea 2 depende de la 1: el resumen se encola a las 20:00 y sale en la
> siguiente pasada de "despachar" (a más tardar 5 minutos después).

## Quién dispara cada tarea

**Las cuatro tareas: GitHub Actions** (ya está en el repositorio:
`.github/workflows/despachar-notificaciones.yml`). Para que funcione, alguien con
permisos de administrador en el repositorio de GitHub debe configurar, en
*Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `CRON_SECRET` | el mismo valor que en Vercel |
| Variable | `API_URL` | la URL de la API, sin `/` al final (p. ej. `https://psicoagenda-api.vercel.app`) |

El mismo workflow revisa cada 5 minutos que la API esté arriba (`/api/health`).
Si falla dos veces seguidas, la ejecución sale en rojo y GitHub avisa por correo.
Para silenciarlo durante un mantenimiento: variable `MONITOR_PAUSADO` = `1` (y borrarla al terminar).

Se puede correr a mano desde *Actions → Despachar notificaciones → Run workflow*
(ejecuta las cuatro partes de una vez).


> GitHub puede atrasar los disparos programados varios minutos en horas pico. Si
> los avisos tardan demasiado, se puede mover la tarea 1 a cron-job.org con la
> misma URL y cabecera.

## Probar que quedó bien

Desde una terminal (sustituye el secreto):

```bash
curl -X POST https://psicoagenda-api.vercel.app/api/internal/despachar -H "Authorization: Bearer <CRON_SECRET>"
```

Debe responder `200` con algo como `{"ok":true,"procesadas":0,...}`. Lo mismo con
las otras tres URL. Todas se pueden correr de más sin problema: no repiten envíos
ni borran de más.

## Si algo falla

- Un job que falla un día no pierde nada: la siguiente ejecución correcta se pone al día.
- Si se cambia `CRON_SECRET` en Vercel, hay que actualizarlo también en cada job.
- Detalle técnico de cada tarea: sección "Despliegue" y "Mantenimiento" del `README.md`.
