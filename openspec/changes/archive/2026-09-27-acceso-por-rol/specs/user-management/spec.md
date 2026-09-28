## ADDED Requirements

### Requirement: Acceso de demostración por rol
El sistema SHALL proporcionar, únicamente en entornos de desarrollo, un mecanismo para iniciar sesión como paciente o psicólogo/a sin credenciales reales.

#### Scenario: Entrar como paciente
- **WHEN** un desarrollador elige "Entrar como paciente" en la pantalla de login
- **THEN** el sistema genera un token JWT con rol paciente y redirige al dashboard mostrando solo las funciones disponibles para pacientes

#### Scenario: Entrar como psicólogo/a
- **WHEN** un desarrollador elige "Entrar como psicólogo/a" en la pantalla de login
- **THEN** el sistema genera un token JWT con rol psicólogo/a y redirige al dashboard mostrando las funciones disponibles para psicólogos/as

## MODIFIED Requirements

### Requirement: Control de roles y permisos
El sistema SHALL restringir las funciones disponibles según el rol del usuario: paciente, psicólogo/a o sistema.

#### Scenario: Acceso por rol
- **WHEN** un usuario autenticado accede al sistema
- **THEN** el sistema identifica su rol y muestra solo las opciones permitidas
- **AND** el sistema redirige a usuarios sin sesión a la pantalla de login
- **NOTE** Esta implementación actual es a nivel de interfaz (`proxy.ts` + filtro de navegación). El bloqueo real de funciones en el backend se implementará en cambios posteriores.
