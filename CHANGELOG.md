# Changelog

Cambios al contrato y al acuerdo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); las versiones del
contrato siguen [SemVer](https://semver.org/lang/es/): un cambio que rompe a un
cliente existente es una versión mayor.

## [0.1.0] — 2026-10-11

### Añadido

- Contrato **provisional** OpenAPI 3.1 (`openapi/interbank.provisional.yaml`): recibir un
  depósito (`POST /deposits` → `202`), consultar su estado (`GET /deposits/{id}`), el
  callback de resultado (`POST /deposits/{id}/result`) y `GET /ping`. Autenticación por
  `X-Api-Key`, `traceparent` obligatorio, idempotencia por `idempotencyKey`, montos como
  texto decimal y solo `GTQ`.
- Borrador del acuerdo de integración (`AGREEMENT.md`), con los puntos pendientes marcados.
- Ejemplos válidos e inválidos de cada mensaje, y el CI que los valida contra el esquema.
- La verificación de integridad del contrato del curso, para cuando se publique.
