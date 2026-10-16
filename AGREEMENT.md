# Acuerdo de integración interbancaria

> **Estado: nuestro lado cerrado, el de la pareja pendiente.** Lo marcado
> **⏳ POR ACORDAR** necesita a los dos grupos; todo lo demás ya está decidido y
> es consultable sin preguntarnos nada. No es vigente hasta que ambos grupos lo
> aprueben en un pull request ([§12](#12-aprobación)).

El entregable que pide el enunciado de la Fase 3 (§4.1 y §4.4): "documento breve
entre ambos grupos con URLs, mecanismo de autenticación, cuentas de prueba y ventana
de pruebas conjuntas". El **formato** de los mensajes no se negocia aquí: lo fija el
contrato del curso ([`openapi/course-base/`](openapi/course-base/)). Este documento
fija lo que el contrato no puede fijar: direcciones, credenciales, cuentas y personas.

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
| Código de banco (`BankCode`) | **`BANK02`** | ⏳ POR ACORDAR |
| Integrantes | Enner Mendizabal, David Barrios, Marcos Bonifasi | ⏳ |
| Responsable técnico de la integración | Marcos Bonifasi | ⏳ |

**`BANK02` sale del patrón, no de una elección.** El contrato define `BankCode` como
`^BANK[0-9]{2}$` y dice que lo asigna el curso; somos el grupo 2. El borrador anterior
de este documento proponía `BANK-B2` con un patrón más laxo — **ninguno de los dos
habría pasado la validación del contrato oficial**, que es exactamente la clase de
cosa que este repositorio existe para descubrir antes del día de la integración.

Un depósito cuyo `destinationBankCode` no es el código propio se rechaza. El contrato
no tiene un motivo para eso, así que cae en `PROCESSING_ERROR` (ver §7).

## 2. Contrato

| | |
| --- | --- |
| Contrato vigente | [`openapi/course-base/interbank-contract-v1.openapi.yaml`](openapi/course-base/interbank-contract-v1.openapi.yaml) — **v1.0.0 del curso**, sin modificar |
| SHA-256 | `4888b951aa48f95d8d301098c8aa642adfaa0e45a380975b8ce42acf3506df6a`, verificado en cada CI |
| Contrato provisional | **retirado** el 2026-10-16. Era nuestro y ya no cuenta |
| Ruta base | `https://{bankHost}/interbank/v1` |

**Siete operaciones, y cada banco actúa en los dos roles:**

| Operación | La expone | Para qué |
| --- | --- | --- |
| `POST /transfers` | el receptor | recibir un depósito; responde `202` |
| `GET /transfers/{id}` | el receptor | consultar el estado cuando el emisor está en `TIMEOUT` |
| `POST /transfers/{id}/cancel` | el receptor | `CANCELLED`, `ALREADY_ACCEPTED` o `ALREADY_REJECTED` |
| `POST /transfers/{id}/result` | **el emisor** | el callback con el resultado |
| `POST /reversals` · `GET /reversals/{id}` | el receptor | devolución por un callback tardío |
| `GET /reconciliation?date=` | el receptor | el listado diario de la conciliación |
| `GET /health` | ambos | disponibilidad, **sin autenticación** |

Como los dos bancos exponen la misma API, **el callback no se configura: se deriva**.
Siempre `{URL base del emisor}/interbank/v1/transfers/{id}/result`. Un banco no le
pregunta al otro a dónde contestar.

Entre los microservicios de un mismo banco todo sigue yendo por el broker. La llamada
HTTP sale siempre del Payment Service y entra siempre por el Gateway (§4.2).

## 3. Entornos y direcciones

| Entorno | Banco A (`BANK02`) | Banco B |
| --- | --- | --- |
| Producción (calificación) | ⏳ `http://<IP del LoadBalancer>:3000/interbank/v1` — la IP la **reserva Terraform** y sobrevive a que se borre el `Service`; se publica aquí en cuanto la nube esté en pie | ⏳ |
| Local (desarrollo) | `http://localhost:3000/interbank/v1` por `port-forward`; no accesible desde fuera | ⏳ |
| Mock propio | `npm run mock` en este repositorio → `http://localhost:4010` | el mismo |

- Las URLs son **estables**: una IP estática o un DNS, nunca la IP efímera de un
  `LoadBalancer` que cambia en cada reinstalación.
- **Sobre HTTPS.** El contrato pide «solo HTTPS» y nuestra entrada es hoy un
  `LoadBalancer` de capa 4 sin terminación TLS: el certificado exigiría un dominio y
  un gestor que el proyecto no tiene. Queda como **divergencia nuestra, declarada**
  (§13). Si la pareja expone HTTPS, nosotros le hablamos por HTTPS sin problema; lo
  que hoy no podemos es ofrecerlo. La API key se rota al terminar las pruebas.

## 4. Autenticación

| | |
| --- | --- |
| Mecanismo | API key en el header `X-Api-Key`, como fija el contrato |
| Qué identifica | **al banco que llama**, no sólo que la llamada es legítima. De eso dependen dos reglas del contrato: que un banco sólo pueda consultar, cancelar o recibir callbacks de transferencias en las que participa, y que la conciliación devuelva los depósitos recibidos *del banco que consulta* |
| Cuántas llaves | **Dos**: cada banco emite una para que el otro lo llame. La del callback es la que emitió el banco **emisor** |
| Formato | ≥ 32 caracteres aleatorios (`openssl rand -hex 32`) |
| Intercambio | Fuera de este repositorio, por un canal privado y de un solo uso (un enlace de Bitwarden Send o 1Password que caduque). **Nunca** en un issue, un PR, un chat grupal ni este documento |
| Almacenamiento | `Secret` de Kubernetes en cada banco |
| Rotación | Al terminar la ventana de pruebas, y de inmediato si se filtra |

Los nombres de nuestras variables, para que no haya que adivinarlos:

```
INTERBANK_API_KEY_INBOUND     # la que exigimos a quien nos llama
INTERBANK_API_KEY_OUTBOUND    # la que mandamos al llamar a la pareja
INTERBANK_PARTNER_BASE_URL    # su URL base, con el prefijo /interbank/v1
INTERBANK_PARTNER_BANK_CODE   # su BankCode
```

Una petición sin llave o con una llave incorrecta recibe `401` y no revela si el
recurso existe. Rotar la llave **no rueda los pods por sí sola** en nuestro
despliegue, así que hace falta un `kubectl rollout restart` después.

## 5. Tiempos

Los fija el contrato y **no se negocian**. Se repiten aquí para no tener que buscarlos:

| Regla | Valor |
| --- | --- |
| Vigencia de un depósito | `expiresAt` = `createdAt` + **180 s** |
| Acreditar después de `expiresAt` | **prohibido**, aunque el mensaje llegue tarde por reintento o DLQ. Se responde `REJECTED` con `EXPIRED`; quien acredite tarde se queda con la responsabilidad y la devolución |
| Margen antes de liberar una reserva sin respuesta | `expiresAt` + **300 s**, y hay que **alertar** |
| Reintentos del callback | espera creciente (2 s, 4 s, 8 s…) hasta **24 h** |
| Relojes | UTC, ISO 8601, sincronizados por NTP |

**El protocolo de `TIMEOUT` del emisor, en cinco pasos**, porque es donde se pierde
dinero: al vencer, el monto **sigue reservado**; el emisor consulta
`GET /transfers/{id}`; si eso da `404` o `PROCESSING`, cancela; sólo si el receptor no
contesta a ninguna de las dos puede liberar la reserva, y no antes del margen de
300 s; y un `ACCEPTED` que llegue sobre una transferencia ya liberada es un incidente
que se resuelve con `POST /reversals`.

## 6. Idempotencia

| | |
| --- | --- |
| Clave | El header `Idempotency-Key` **debe ser igual a** `interbankTransferId`. Si no coinciden, `400` |
| Misma solicitud repetida | `200` con el estado actual. Nunca se acredita dos veces |
| Mismo id con contenido distinto | `409` |
| El callback y la cancelación | también son idempotentes |

## 7. Datos del mensaje

| Campo | Regla |
| --- | --- |
| `amount` | **Texto** con exactamente dos decimales (`"150.00"`), nunca un número JSON. Entre `0.01` y `10000.00` |
| `currency` | Sólo `GTQ` |
| Monto máximo | `10000.00` por operación, lo fija el contrato. Lo excedido es `REJECTED` con `AMOUNT_LIMIT_EXCEEDED` |
| `createdAt`, `expiresAt`, `processedAt`, `updatedAt` | ISO 8601 en UTC |
| `originAccount`, `destinationAccount` | El número de cuenta en el formato del banco dueño (§9) |
| `description` | Opcional, ≤ 140 caracteres |
| Datos personales | **Ninguno**. No viaja nombre, documento ni correo del cliente: sólo números de cuenta |

Los **siete** motivos de rechazo, y no otros: `ACCOUNT_NOT_FOUND`,
`ACCOUNT_INACTIVE`, `AMOUNT_LIMIT_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, `EXPIRED`,
`CANCELLED`, `PROCESSING_ERROR`.

**Campos desconocidos: depende del esquema, y conviene saberlo.** El contrato declara
`additionalProperties: false` en exactamente dos —`TransferRequest` y
`TransferResult`— y **no** en los demás. Así que un `CancelRequest` o un
`ReversalRequest` con un campo de más es **válido por contrato**, y rechazarlo sería
modificar el contrato por cuenta propia. Lo encontró la validación de ejemplos de este
repositorio, y los dos ejemplos que lo fijan están en
[`examples/CancelRequest/with-extra-field.json`](examples/CancelRequest/with-extra-field.json)
y [`examples/ReversalRequest/with-extra-field.json`](examples/ReversalRequest/with-extra-field.json).

## 8. Trazabilidad

| | |
| --- | --- |
| Header | `traceparent` (W3C Trace Context), **obligatorio en toda petición** |
| Qué consigue | El mismo `traceId` a los dos lados, así que un depósito se puede seguir entre los dos bancos en una sola traza |
| Correlación de negocio | Cada banco mantiene la suya internamente; no viaja en el contrato |

## 9. Cuentas y ventana de pruebas

**Nuestro formato de número de cuenta:**

```
02-NNNNNNNNN        p. ej.  02-000000052
```

`02` es nuestro banco y los nueve dígitos son el número. Doce caracteres, dentro del
`^[A-Za-z0-9-]{1,34}$` del contrato.

**Por qué no usamos nuestros UUID internos.** Fue lo primero que se intentó y **no
caben**: un UUID con guiones son 36 caracteres y el contrato permite 34. Es un límite
del contrato y no una preferencia.

| Banco | Cuenta | Estado | Para probar |
| --- | --- | --- | --- |
| `BANK02` | ⏳ se publica con la nube | activa | depósito aceptado |
| `BANK02` | ⏳ se publica con la nube | inactiva | `ACCOUNT_INACTIVE` |
| `BANK02` | `02-999999999` | no existe | `ACCOUNT_NOT_FOUND` |
| `BANK02` | cualquiera, con monto > `10000.00` | — | `AMOUNT_LIMIT_EXCEEDED` |
| Banco B | ⏳ | activa | depósito aceptado |
| Banco B | ⏳ | inactiva | `ACCOUNT_INACTIVE` |

Las dos primeras existen ya en nuestro entorno local, pero un número de un entorno
local no le sirve a nadie de fuera y los de la nube serán otros. La tercera se puede
publicar hoy porque **no necesita existir**: es un número con el formato correcto que
no corresponde a ninguna cuenta, que es justo lo que hace falta para provocar un
`ACCOUNT_NOT_FOUND`.

| Ventana de pruebas | |
| --- | --- |
| Propuesta | **2026-10-20 y 2026-10-21, 19:00–22:00 (UTC−6)** |
| Confirmada | ⏳ |
| Calificación | 2026-10-24 según §7 del enunciado |

Dos días y no uno a propósito: la primera sesión de una integración se gasta en
descubrir que una URL estaba mal, y conviene que eso no pase el día antes.

## 10. Conciliación

`GET /reconciliation?date=YYYY-MM-DD` devuelve los depósitos que un banco recibió del
banco que consulta, en esa fecha **UTC**, paginados (`page`, `pageSize` ≤ 500).

No es opcional y no es un adorno: es la red que detecta un descuadre que ninguno de
los dos bancos vio en el momento. Si al final de un día de pruebas las dos listas no
cuadran, el descuadre está ahí.

## 11. Contactos y cambios

| Rol | Banco A | Banco B |
| --- | --- | --- |
| Responsable técnico | Marcos Bonifasi · `mbonifasi@lomax.com.gt` | ⏳ |
| Respaldo | ⏳ | ⏳ |
| Canal para incidentes durante la ventana | ⏳ (un grupo de chat creado para esto) | |

Cualquier cambio a este documento va por pull request, con la aprobación de un
integrante de cada grupo. **Un acuerdo que no es el archivo no es un acuerdo**: si un
mensaje de chat y este documento se contradicen, manda el documento.

## 12. Aprobación

| Banco | Aprobado por | Fecha | PR |
| --- | --- | --- | --- |
| `BANK02` | ⏳ | ⏳ | ⏳ |
| Banco B | ⏳ | ⏳ | ⏳ |

## 13. Divergencias declaradas

Lo que un banco **no** cumple del contrato, dicho antes de que lo encuentre el otro.
Un acuerdo que oculta esto no es un acuerdo, es una promesa.

| Banco | Qué | Estado |
| --- | --- | --- |
| `BANK02` | **HTTPS.** La entrada es un `LoadBalancer` de capa 4 sin terminación TLS (§3) | abierto |
| `BANK02` | **El protocolo de `TIMEOUT`, del lado emisor.** Las siete operaciones están implementadas y el lado **receptor** está completo, incluido el rechazo por vencimiento. Lo que falta es lo que hacemos **nosotros** cuando el callback de la pareja no llega: hoy esperamos 30 s y compensamos, en vez de los 180 s seguidos de consulta, cancelación y el margen de 300 s | abierto |
| Banco B | ⏳ | |

**Qué significa el segundo para la pareja, sin rodeos.** Si recibís un depósito
nuestro y vuestro callback tarda más de 30 segundos, es posible que nosotros ya
hayamos devuelto el dinero al cliente mientras vosotros se lo acreditasteis al
vuestro. Hasta que esté cerrado: **que vuestro callback salga pronto**, y si no sale,
usad `GET /transfers/{id}` y `POST /transfers/{id}/cancel` —que sí están— para saber
en qué quedó. La conciliación diaria es la red de seguridad.
