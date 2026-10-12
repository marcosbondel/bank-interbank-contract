# Acuerdo de integración interbancaria

> **Estado: BORRADOR v0.1** — propuesto por el Grupo B-2. No es vigente hasta que
> ambos grupos lo aprueben en un pull request (ver [§12](#12-aprobación)).
> Todo lo marcado **⏳ POR ACORDAR** se cierra en la reunión inicial.

El entregable que pide el enunciado de la Fase 3 (§4.1 y §4.4): "documento breve
entre ambos grupos con URLs, mecanismo de autenticación, cuentas de prueba y ventana
de pruebas conjuntas". El **formato** de los mensajes no se negocia aquí: lo fija el
contrato OpenAPI ([`openapi/`](openapi/)). Este documento fija lo que el contrato no
puede fijar: direcciones, credenciales, tiempos, cuentas y personas.

**Una regla de diseño atraviesa todo el documento.** Si el banco pareja no está
disponible el día de la calificación, el auxiliar asigna otro banco, y como último
recurso se evalúa contra el mock (§4.1, *Reglas para la evaluación en parejas*). Por
eso nada de lo acordado aquí puede ser un formato privado entre los dos grupos: todo
es **configuración**, de modo que cambiar de banco pareja signifique cambiar valores y
no código.

---

## 1. Partes

| | Banco A | Banco B |
| --- | --- | --- |
| Grupo | Sección B, Grupo 2 (`Proyecto-SA-B-2`) | ⏳ POR ACORDAR |
| Código de banco (`BankCode`) | `BANK-B2` (propuesto) | ⏳ POR ACORDAR |
| Integrantes | Enner Mendizabal, David Barrios, Marcos Bonifasi | ⏳ |
| Responsable técnico de la integración | Marcos Bonifasi | ⏳ |

El `BankCode` cumple `^[A-Z0-9][A-Z0-9-]{1,19}$` y viaja en `originBank` /
`destinationBank`. Un depósito cuyo `destinationBank` no es el código propio se
rechaza con `WRONG_DESTINATION_BANK`.

## 2. Contrato

| | |
| --- | --- |
| Contrato vigente | [`openapi/interbank.provisional.yaml`](openapi/interbank.provisional.yaml) **v0.1.0 (provisional)** |
| Contrato del curso | Pendiente de publicación. Cuando llegue va **sin modificar** a [`openapi/course-base/`](openapi/course-base/) y **reemplaza** al provisional donde difieran |
| Ruta base | `/interbank/v1` en el API Gateway de cada banco |

Los dos sentidos de la comunicación, en una frase cada uno (§4.2):

- **Envío.** El Payment Service del banco origen llama `POST /deposits` en el Gateway
  del banco destino y recibe `202 Accepted`.
- **Resultado.** El banco destino llama de vuelta `POST /deposits/{id}/result` en el
  Gateway del banco origen con `ACCEPTED` o `REJECTED`.

Entre los microservicios de un mismo banco todo sigue yendo por el broker. La
llamada HTTP sale siempre del Payment Service y entra siempre por el Gateway.

## 3. Entornos y direcciones

| Entorno | Banco A (`BANK-B2`) | Banco B |
| --- | --- | --- |
| Desarrollo (`dev`) | ⏳ `https://<ip-o-dns>/interbank/v1` — pendiente de la IP estática del Gateway (T-53) | ⏳ |
| Producción (`prod`) | ⏳ | ⏳ |
| Mock propio | `npm run mock` en este repositorio → `http://localhost:4010` | el mismo |

- Las URLs son **estables**: una IP estática o un DNS, nunca la IP efímera de un
  `LoadBalancer` que cambia en cada reinstalación.
- HTTPS cuando el entorno lo permita. Si un entorno solo tiene HTTP, se dice aquí
  explícitamente y la API key se rota al terminar las pruebas.

## 4. Autenticación

| | |
| --- | --- |
| Mecanismo | API key en el header `X-Api-Key` (alternativa del enunciado: JWT de cliente) |
| Cuántas llaves | **Dos**: cada banco emite una para que el otro lo llame. La llave del callback es la que emitió el banco **origen** |
| Formato | ≥ 32 caracteres aleatorios (`openssl rand -hex 32`) |
| Intercambio | Fuera de este repositorio, por un canal privado y de un solo uso (por ejemplo un enlace de Bitwarden Send o 1Password que caduque). **Nunca** en un issue, un PR, un chat grupal ni este documento |
| Almacenamiento | Secret de Kubernetes en cada banco |
| Rotación | Al terminar la ventana de pruebas conjuntas, y de inmediato si se filtra |

Una petición sin llave o con una llave incorrecta recibe `401` y no revela si el
recurso existe.

## 5. Tiempos y reintentos

| Tema | Propuesta | Estado |
| --- | --- | --- |
| Respuesta al `POST /deposits` | ≤ 5 s; el `202` no espera la decisión | ⏳ |
| Espera del callback antes de `TIMEOUT` | 120 s. Antes de declararlo, el origen consulta `GET /deposits/{id}` | ⏳ |
| Reintentos del envío (red, `5xx`, `503`) | 1 s, 5 s, 30 s, con el **mismo** `idempotencyKey` | ⏳ |
| Reintentos del callback hasta recibir `2xx` | 1 s, 5 s, 30 s y luego cada 60 s durante 15 min | ⏳ |
| `Retry-After` en `503` | Se respeta si viene | ⏳ |
| Tasa máxima | 10 peticiones/s por banco | ⏳ |

Un `TIMEOUT` en el origen **compensa** el débito (estado `REVERSED`). Si después
llega un `ACCEPTED` tardío para un depósito ya revertido, se responde `409` y se
reporta en la conciliación (§10), nunca se acredita a ciegas.

## 6. Idempotencia

- `idempotencyKey` lo elige el origen: 8–128 caracteres `[A-Za-z0-9._:-]`.
  Propuesta: `<BankCode>:<interbankTransferId>`.
- El destino lo recuerda **7 días**. Dentro de ese plazo:
  - la misma llave con el mismo cuerpo responde el mismo `202`, con el header
    `Idempotent-Replayed: true`, y **nunca acredita dos veces**;
  - la misma llave con otro cuerpo responde `409 IDEMPOTENCY_CONFLICT`.
- El callback también es idempotente: el mismo resultado repetido es `204`; un
  resultado distinto del ya registrado es `409 RESULT_CONFLICT`.

Un depósito duplicado o un monto perdido sin compensar penalizan con un 50 %
(§8.3). Por eso esta sección es la que más se prueba en la ventana conjunta (§9).

## 7. Datos del mensaje

| Campo | Regla |
| --- | --- |
| `amount.value` | Texto decimal con exactamente dos decimales (`"250.00"`), **nunca** un número JSON |
| `amount.currency` | Solo `GTQ` |
| Monto máximo | Lo configura y aplica cada banco **destino**. Propuesta: Q10,000.00. Lo excedido es `REJECTED` con `AMOUNT_EXCEEDS_LIMIT` |
| `timestamp`, `*At` | RFC 3339 con zona horaria (`2026-10-15T20:32:08Z` o `-06:00`) |
| `destinationAccount` | El identificador de cuenta del banco destino, tal como lo muestran las cuentas de prueba (§9) |
| Campos desconocidos | Se rechazan (`400`): el contrato no admite campos de más |
| Datos personales | Ninguno. No viaja nombre, documento ni correo del cliente |

Los motivos de rechazo forman una lista cerrada: `ACCOUNT_NOT_FOUND`,
`ACCOUNT_INACTIVE`, `AMOUNT_EXCEEDS_LIMIT`, `UNSUPPORTED_CURRENCY`,
`WRONG_DESTINATION_BANK` e `INTERNAL_ERROR`.

Un rechazo de negocio **no** es un error HTTP: el `POST` responde `202` y el rechazo
llega por el callback. Los `4xx` quedan para peticiones que no se entienden o no
están autorizadas.

## 8. Trazabilidad

- Toda petición, en ambos sentidos, lleva el header W3C `traceparent`.
- El destino **continúa** esa traza: el depósito tiene el mismo `traceId` en los dos
  bancos (§4.1, *Observabilidad requerida*), y el callback se emite dentro de ella.
- Cada banco registra cada cambio de estado del depósito con `interbankTransferId`
  y `traceId`, sin datos sensibles.
- En la ventana conjunta, cada grupo comparte el `traceId` de sus pruebas, para que
  el otro encuentre la misma traza en su Grafana.

## 9. Cuentas y ventana de pruebas

**Cuentas de prueba** (identificadores públicos, sin saldo real):

| Banco | Cuenta | Estado | Para probar |
| --- | --- | --- | --- |
| `BANK-B2` | ⏳ | activa | depósito aceptado |
| `BANK-B2` | ⏳ | inactiva | `ACCOUNT_INACTIVE` |
| Banco B | ⏳ | activa | depósito aceptado |
| Banco B | ⏳ | inactiva | `ACCOUNT_INACTIVE` |

**Ventana de pruebas conjuntas**: ⏳ fecha y hora (zona `America/Guatemala`). La
calificación es el 24 de octubre, así que la ventana tiene que ser **antes del 22**,
para dejar un día de margen.

**Lista mínima de casos**, que ambos ejecutan en los dos sentidos:

1. `GET /ping` con la llave correcta da `200`, y con una incorrecta da `401`.
2. Un depósito a una cuenta activa termina `ACCEPTED`: el saldo sube en el destino
   y el débito queda confirmado en el origen.
3. Un depósito a una cuenta inactiva termina `REJECTED`: el origen compensa y el
   saldo vuelve a su valor inicial.
4. El mismo depósito enviado dos veces se acredita **una sola vez**.
5. La misma llave con un cuerpo distinto da `409`.
6. Un callback repetido no confirma ni compensa dos veces.
7. Un `traceId` compartido aparece en el Grafana de los dos bancos.

Los fallos (timeouts, respuestas lentas, rechazos forzados) se inyectan **solo con el
mock propio**, nunca apagando ni alterando el sistema del otro grupo (§4.1).

## 10. Conciliación (opcional)

⏳ Si se implementa: un reporte diario de los depósitos registrados por cada banco,
comparados por `interbankTransferId`, `amount` y estado final.

## 11. Contactos y cambios

| Rol | Banco A | Banco B |
| --- | --- | --- |
| Responsable técnico | Marcos Bonifasi | ⏳ |
| Respaldo | ⏳ | ⏳ |
| Canal para incidentes durante la ventana | ⏳ (un grupo de chat creado para esto) | |

**Cambios a este acuerdo o al contrato provisional**: solo por pull request, con la
aprobación de un integrante de cada grupo, y con su entrada en
[`CHANGELOG.md`](CHANGELOG.md). Un cambio que rompe compatibilidad sube la versión
mayor del contrato y se anuncia en el canal con al menos 48 horas de anticipación.

## 12. Aprobación

Este acuerdo es vigente cuando el pull request que lo cambia a **v1.0** está aprobado
por un integrante de cada grupo y se etiqueta `v1.0.0`. Cada grupo enlaza esa etiqueta
desde la documentación de su monorepo como su "acuerdo de integración" (§4.4).

| Banco | Aprobado por | Fecha | PR |
| --- | --- | --- | --- |
| `BANK-B2` | ⏳ | ⏳ | ⏳ |
| Banco B | ⏳ | ⏳ | ⏳ |
