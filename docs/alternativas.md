# Alternativas a la idea n.º 4 («Anticipo que confirma una cita»)

Base elegida: consultorio ficticio donde el paciente paga un anticipo por CoDi (pey) y la cita pasa de «apartada» a «confirmada» al llegar el webhook. Ronda CDMX: dom 15-nov 13:00. Final nacional: 12-dic.

## a) Alternativas más relevantes

| Idea | Pros | Contras | Horas | ¿Cambiar o sumar a la n.º 4 para el 12-dic? |
|---|---|---|---|---|
| **#1 Del QR a la solicitud de pago**: QR en recepción abre una página, el paciente pone su celular y le llega la notificación CoDi | Usa los dos endpoints (`/codi/qr` y `/codi/pn`) y sus dos webhooks, lo que sube el 30 % de uso de CoDi. Reutiliza todo el backend de la n.º 4 | Por sí sola es genérica. Hay que probar la notificación push en el banco del teléfono de la demo | 4–6 | **Sumar.** Es el flujo de «pago en mostrador» del consultorio |
| **#18 Taller con lugares pagados**: sesiones grupales (p. ej., charla de nutrición) con cupo | El mismo modelo que la n.º 4 (reserva más cobro), solo que de 1 a N lugares. El cupo que baja en pantalla luce bien en el video | Se parece demasiado a la n.º 4 para contar como proyecto aparte. Hay que manejar dos pagos simultáneos por el último lugar | 4–6 | **Sumar** como tipo de cita «grupal» |
| **#19 Facturas que se concilian solas**: saldo por paciente (tratamientos en varios pagos) | Impacto real para consultorios. Encaja con los consejos de la hoja (idempotencia y pagos tardíos) | Se ve poco en la demo. Hay que modelar saldos y recordatorios | 6–8 | **Sumar solo una parte**: el saldo restante tras el anticipo y que los recordatorios se detengan al pagar |
| **#15 Fábrica de encargos con IA**: el pago arranca un encargo y la pantalla muestra el avance | Demo vistosa. Original | Nada que ver con la n.º 4. Gasto en API de LLM. Impacto social difuso | 8–12 | **No cambiar.** Es demasiado arriesgado hacerlo solo |
| **Propia A: Predicción de inasistencias (no-show)**: un modelo simple (regresión logística) estima el riesgo de falta y fija el anticipo dinámico según ese riesgo | Aprovecha tu perfil de ciencia de datos. Es original y defendible ante el jurado («el anticipo baja las faltas X %»). Panel con métricas | Sin datos reales: hay que usar datos sintéticos o un dataset público de no-shows (p. ej., el de Kaggle de Brasil) y decirlo con claridad | 6–10 | **Sumar.** Es el diferenciador más fuerte |
| **Propia B: Lista de espera que se cobra sola**: si el anticipo no llega antes del plazo (p. ej., 15 min), la cita se libera y se manda `/codi/pn` al siguiente en la lista | Resuelve los «pagos tardíos» que pide la hoja. Más uso de CoDi push. Muy demostrable en vivo con un temporizador | Más lógica de estados (vencida, reasignada, pago tardío que hay que reembolsar o rechazar) | 5–8 | **Sumar** |
| **Propia C: Funciones de cineclub o foro cultural CDMX con apartado CoDi**: aparta tu lugar en una función independiente desde la agenda cultural | Conecta con tus proyectos de agenda y cartelera. Toque cultural y local | Es cambiar de vertical a 4 semanas de la final. Se traslapa con la #18 | 10–15 | **No cambiar.** A lo más, una diapositiva de «el mismo motor sirve para foros y cineclubs» |

## b) Recomendación: qué sumar a la n.º 4 para el 12-dic

1. **Flujo QR → push (#1)**: en recepción, el paciente escanea, pone su celular y paga, así la demo usa `/codi/qr` y `/codi/pn` con sus dos webhooks y la confirmación con `GET /transaction`.
2. **Lista de espera con plazo (propia B)**: un anticipo que no llega a tiempo libera la cita y cobra al siguiente; así quedan resueltos los pagos tardíos y el doble procesamiento (idempotencia por `id` de transacción).
3. **Panel de inasistencias (propia A)**: el riesgo estimado define el monto del anticipo y el panel muestra la tasa de faltas con anticipo y sin él. Es lo que distingue el proyecto en impacto y originalidad.

## c) Descartar

Las que requieren hardware (#6, #8, #9, #14) y las experiencias de puro espectáculo o lejanas al consultorio (#7, #11, #12, #13, #17, #20): no suman a la n.º 4 y no caben en el tiempo de una persona sola.
