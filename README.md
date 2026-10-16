# Contrato interbancario — Bank USAC

El contrato y el acuerdo de integración para los **depósitos entre dos bancos** del
proyecto de Software Avanzado (2S2026, Fase 3, §4.1 *Integración interbancaria*).
Lo mantienen los dos grupos que se integran: ninguno de los dos lo cambia solo.

| Qué | Dónde |
| --- | --- |
| El acuerdo: URLs, autenticación, tiempos, cuentas de prueba, contactos | [`AGREEMENT.md`](AGREEMENT.md) |
| **El contrato del curso** (OpenAPI 3.0.3, v1.0.0) | [`openapi/course-base/interbank-contract-v1.openapi.yaml`](openapi/course-base/interbank-contract-v1.openapi.yaml) |
| Ejemplos de cada mensaje, válidos e inválidos | [`examples/`](examples/) |
| Historial de cambios | [`CHANGELOG.md`](CHANGELOG.md) |

> **Sin secretos.** En este repositorio no va ninguna API key, contraseña ni token:
> se intercambian por un canal privado (ver `AGREEMENT.md` §4). Una credencial que
> llegue aquí por error se considera filtrada y se rota, aunque se borre después.

## Por qué un repositorio y no un documento

El contrato es código: se valida, cada banco genera su mock y sus pruebas desde el
mismo archivo, y cada cambio queda en un pull request que el otro grupo aprobó. Un
documento de texto no se puede probar, y dos implementaciones de un mismo texto
suelen ser dos contratos distintos.

## Uso

Requiere Node.js 24.

```bash
npm ci
npm run check    # integridad del contrato del curso + lint del OpenAPI + ejemplos
npm run mock     # un banco falso que cumple el contrato, en http://localhost:4010
```

El mock (Prism) valida cada petición contra el contrato. Sirve para desarrollar sin
depender del otro grupo:

```bash
curl -i -X POST http://localhost:4010/transfers \
  -H 'X-Api-Key: cualquier-valor' \
  -H 'Idempotency-Key: 8f14e45f-ceea-467a-9b36-4b1c2d6a7e01' \
  -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' \
  -H 'Content-Type: application/json' \
  -d @examples/TransferRequest/basic.json         # → 202

# Sin X-Api-Key → 401. Con el monto como número → 400. Vencido → 422.
```

**Prism devuelve el `200` y no el `202`.** Cuando una operación declara varias
respuestas de éxito elige la de código más bajo, y `POST /transfers` declara las dos:
`202` para un depósito nuevo y `200` para una solicitud repetida. Para ver el acuse
de recibo hay que pedirlo:

```bash
curl -i -X POST http://localhost:4010/transfers \
  -H 'Prefer: code=202' \
  -H 'X-Api-Key: cualquier-valor' \
  -H 'Idempotency-Key: 8f14e45f-ceea-467a-9b36-4b1c2d6a7e01' \
  -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' \
  -H 'Content-Type: application/json' \
  -d @examples/TransferRequest/basic.json
```

Es del mock y no del contrato, pero cuesta una hora averiguarlo el día de la
integración.

Para inyectar fallos controlados (rechazos, timeouts, respuestas lentas), cada banco
usa **su propio** simulador del banco pareja. Nunca se altera el sistema del otro
grupo (enunciado §4.1).

## Qué valida el CI

En cada push y en cada pull request ([`.github/workflows/validate.yml`](.github/workflows/validate.yml)):

1. **Lint del OpenAPI** con Redocly: el documento es válido, cada operación tiene
   `operationId` y documenta sus respuestas `4xx`.
2. **Ejemplos.** Cada archivo en `examples/<Esquema>/` debe cumplir su esquema, y cada
   archivo en `examples/<Esquema>/invalid/` debe ser **rechazado**. La segunda mitad es
   la que importa: prueba que el esquema es estricto, no solo que acepta lo correcto.
3. **Contrato del curso intacto.** Su SHA-256 debe coincidir con `SHA256SUMS`. El
   enunciado dice que los grupos no lo modifican, y esto lo hace cumplir: cualquier
   edición del archivo rompe el CI.

## El contrato del curso ya llegó (2026-10-16)

Los cinco pasos que esta sección describía están hechos: el contrato está en
`openapi/course-base/` byte por byte, su hash en `SHA256SUMS`, el provisional
**retirado**, los ejemplos rehechos para los esquemas oficiales, y `lint`, `mock` y
la validación de ejemplos apuntando al del curso.

**Qué encontró el cambio**, que es la razón de que este repositorio exista:

- El `BankCode` que el acuerdo proponía (`BANK-B2`) **no cumple** el patrón oficial
  `^BANK[0-9]{2}$`. Ahora es `BANK02`.
- Las rutas no eran `/deposits` sino `/transfers`, y no eran dos operaciones sino
  **siete**.
- La espera del callback que el borrador proponía (120 s) no es la del contrato
  (`expiresAt` = 180 s, más un margen de 300 s antes de liberar la reserva).
- `AMOUNT_EXCEEDS_LIMIT` se llama `AMOUNT_LIMIT_EXCEEDED`, y tres de los motivos que
  el borrador daba por buenos **no son motivos en el contrato: son códigos HTTP**.
- El contrato declara `additionalProperties: false` en **sólo dos** esquemas. Un
  ejemplo marcado como inválido que el esquema aceptaba lo descubrió, y de ahí salió
  §7 del acuerdo — ser más estricto que el contrato rompe la interoperabilidad igual
  que ser más laxo.

Si el contrato deja algo sin definir, se le pregunta al auxiliar. No se extiende
entre los dos grupos: el día de la calificación puede tocar otro banco pareja, y
cualquier dialecto privado se rompe con él.

## Cómo se cambia

- Todo por pull request; nadie empuja directo a `main`.
- Cada PR necesita la aprobación de **un integrante de cada grupo**.
- Cada PR deja su entrada en `CHANGELOG.md` y sube `info.version` del contrato
  siguiendo semver: un cambio que rompe a un cliente existente es versión mayor.
- La versión que vale para la entrega se etiqueta (`v1.0.0`), y cada grupo la enlaza
  desde su monorepo.
