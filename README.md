# Contrato interbancario — Bank USAC

El contrato y el acuerdo de integración para los **depósitos entre dos bancos** del
proyecto de Software Avanzado (2S2026, Fase 3, §4.1 *Integración interbancaria*).
Lo mantienen los dos grupos que se integran: ninguno de los dos lo cambia solo.

| Qué | Dónde |
| --- | --- |
| El acuerdo: URLs, autenticación, tiempos, cuentas de prueba, contactos | [`AGREEMENT.md`](AGREEMENT.md) |
| El contrato provisional (OpenAPI 3.1) | [`openapi/interbank.provisional.yaml`](openapi/interbank.provisional.yaml) |
| El contrato del curso, cuando se publique | [`openapi/course-base/`](openapi/course-base/) |
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
npm run check    # lint del OpenAPI + ejemplos + integridad del contrato del curso
npm run mock     # un banco falso que cumple el contrato, en http://localhost:4010
```

El mock (Prism) valida cada petición contra el contrato. Sirve para desarrollar sin
depender del otro grupo:

```bash
curl -i -X POST http://localhost:4010/deposits \
  -H 'X-Api-Key: cualquier-valor' \
  -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' \
  -H 'Content-Type: application/json' \
  -d @examples/DepositRequest/basic.json          # → 202

# Sin X-Api-Key → 401. Con el monto como número → 400.
```

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
3. **Contrato del curso intacto.** Si hay un contrato en `openapi/course-base/`, su
   SHA-256 debe coincidir con `SHA256SUMS`.

## Cuando llegue el contrato del curso

1. Se copia **byte por byte** a `openapi/course-base/`, sin reformatear.
2. Se registra su hash:
   `cd openapi/course-base && shasum -a 256 <archivo> > SHA256SUMS`.
3. Se compara con el provisional. Donde difieran, **gana el del curso**: se ajusta el
   provisional (o se elimina) y los ejemplos.
4. Se apunta `npm run lint`, `npm run mock` y `scripts/validate-examples.mjs` al
   contrato del curso.
5. Todo en un pull request aprobado por ambos grupos, con su entrada en el CHANGELOG.

Si el contrato del curso deja algo sin definir, se le pregunta al auxiliar. No se
extiende entre los dos grupos: el día de la calificación puede tocar otro banco
pareja, y cualquier dialecto privado se rompe con él.

## Cómo se cambia

- Todo por pull request; nadie empuja directo a `main`.
- Cada PR necesita la aprobación de **un integrante de cada grupo**.
- Cada PR deja su entrada en `CHANGELOG.md` y sube `info.version` del contrato
  siguiendo semver: un cambio que rompe a un cliente existente es versión mayor.
- La versión que vale para la entrega se etiqueta (`v1.0.0`), y cada grupo la enlaza
  desde su monorepo.
