# Changelog

Cambios al contrato y al acuerdo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); las versiones del
contrato siguen [SemVer](https://semver.org/lang/es/): un cambio que rompe a un
cliente existente es una versión mayor.

## [1.0.0] — 2026-10-16

El contrato del curso llegó, y **reemplaza al provisional**. El cambio es mayor en
el sentido de SemVer sin ambigüedad: rompe a cualquier cliente del provisional, que
éramos los dos.

### Añadido

- **El contrato base del curso**, byte por byte, en
  `openapi/course-base/interbank-contract-v1.openapi.yaml` (OpenAPI 3.0.3, v1.0.0),
  con su SHA-256 `4888b951aa48…` en `SHA256SUMS`. El CI falla si el archivo se edita:
  el enunciado dice que los grupos no lo modifican.
- `AGREEMENT.md` §13, **divergencias declaradas**: lo que cada banco no cumple del
  contrato, dicho antes de que lo encuentre el otro.
- Ejemplos de los once esquemas del contrato, 47 en total, con los `invalid/` que
  prueban que el esquema es estricto donde dice serlo.
- Dos ejemplos que fijan lo contrario: `CancelRequest/with-extra-field.json` y
  `ReversalRequest/with-extra-field.json` son **válidos**, porque el contrato no
  declara `additionalProperties: false` en esos esquemas.

### Cambiado

- `npm run lint`, `npm run mock` y la validación de ejemplos apuntan al contrato del
  curso. El validador quita las anotaciones de OpenAPI (`example`) antes de pasar los
  esquemas por Ajv, porque 3.0.3 no es JSON Schema 2020-12 exacto.
- `AGREEMENT.md` reescrito contra el contrato oficial. Lo que cambió de fondo:
  - el código de banco pasa de la propuesta `BANK-B2` a **`BANK02`** — el patrón
    oficial es `^BANK[0-9]{2}$` y la propuesta anterior no lo cumplía;
  - de dos operaciones a **siete**, con los dos roles de cada banco;
  - el callback **no se configura, se deriva** de la URL base del emisor;
  - los tiempos son los del contrato: `expiresAt` a 180 s, margen de 300 s antes de
    liberar una reserva, reintentos del callback hasta 24 h;
  - `Idempotency-Key` **debe ser igual** a `interbankTransferId`;
  - los siete motivos de rechazo del contrato, con `AMOUNT_LIMIT_EXCEEDED` en vez de
    `AMOUNT_EXCEEDS_LIMIT` y tres de los nuestros que resultaron ser códigos HTTP;
  - el formato de número de cuenta propio, `02-NNNNNNNNN`, porque **un UUID no cabe**
    en los 34 caracteres que el contrato permite.

### Quitado

- El contrato provisional `openapi/interbank.provisional.yaml` y sus ejemplos. Se
  **elimina** en vez de ajustarse: era nuestro, ya no cuenta, y dejarlo era invitar a
  que alguien implementara el que no manda.

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
