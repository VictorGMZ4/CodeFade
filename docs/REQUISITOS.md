# Turno · Requisitos, métricas y estado

Verificado el 4 de noviembre de 2026 sobre la versión de producción (`next build` + `next start`), con Lighthouse 12 en móvil simulado (4G lento) y pruebas contra la base de datos local.

Leyenda: ✅ cumple · ⚠️ parcial · ❌ pendiente

## 1. Requisitos funcionales

### Cuenta y barbería

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RF-01 | Registrar una barbería: cuenta, nombre, país (zona horaria, moneda, prefijo) | ✅ | Probado: crea usuario, barbería, barbero con horario L–S |
| RF-02 | Iniciar y cerrar sesión | ✅ | Sesión firmada (JWT) en cookie de 30 días |
| RF-03 | Recuperar contraseña | ❌ | No existe; hoy una contraseña olvidada deja la cuenta inaccesible |
| RF-04 | Verificar el correo al registrarse | ❌ | |
| RF-05 | Varias barberías por usuario e invitar personal | ⚠️ | El modelo de datos lo admite (rol `STAFF`), pero no hay pantallas |

### Panel de la barbería

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RF-06 | Crear, editar y ocultar servicios con duración y precio | ✅ | |
| RF-07 | Dar de alta barberos y activarlos o desactivarlos | ✅ | |
| RF-08 | Horario semanal por barbero con varias franjas por día | ✅ | Probado: domingo activado y pausa de almuerzo guardados |
| RF-09 | Bloquear ausencias (días enteros u horas) | ✅ | |
| RF-10 | Ajustes: enlace, intervalo de turnos, antelación mínima, ventana de reserva, horas del recordatorio | ✅ | |
| RF-11 | Agenda del día filtrable por barbero, con total previsto | ✅ | |
| RF-12 | Marcar cita atendida, no vino, cancelada, y deshacer | ✅ | Reactivar una cita cuyo hueco se ocupó devuelve un error claro |
| RF-13 | Escribir al cliente por WhatsApp desde la agenda | ✅ | Enlace `wa.me` con el mensaje ya escrito |
| RF-14 | Crear una cita a mano (cliente que llama o llega sin cita) | ❌ | Imprescindible en una barbería; hoy solo reserva el cliente |
| RF-15 | Aviso al barbero cuando entra una reserva | ❌ | |
| RF-16 | Lista e historial de clientes | ❌ | Los datos existen (`Customer`), falta la pantalla |
| RF-17 | Informes (reservas, ingresos, no-shows por periodo) | ❌ | Ver métricas, sección 3 |

### Reserva del cliente

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RF-18 | Página pública por enlace (`/b/<barbería>`), sin cuenta | ✅ | |
| RF-19 | Elegir servicio, barbero o "el primero libre", día y hora | ✅ | "El primero libre" asigna al barbero con menos citas ese día |
| RF-20 | Mostrar solo huecos reales: horario, citas, ausencias, antelación, ventana | ✅ | Probado con la barbería de ejemplo |
| RF-21 | Impedir dobles reservas, también si dos clientes confirman a la vez | ✅ | Restricción de exclusión `Appointment_no_overlap` en Postgres; probado |
| RF-22 | Confirmación con enlace privado para ver o cancelar | ✅ | Token aleatorio de 144 bits; página `noindex` |
| RF-23 | Cancelar la cita desde el enlace | ✅ | Solo citas activas y futuras |
| RF-24 | Reprogramar la cita desde el enlace | ❌ | Hoy hay que cancelar y reservar de nuevo |
| RF-25 | Límite anti-acaparamiento (máx. 3 citas futuras por teléfono) y trampa anti-bots | ✅ | |
| RF-26 | Añadir la cita a Google Calendar | ✅ | |

### Recordatorios

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RF-27 | Recordatorio automático por WhatsApp y correo, X horas antes | ⚠️ | El código funciona y no duplica envíos (probado). Falta: claves de Resend y de WhatsApp Cloud API, plantilla aprobada por Meta y programar el cron cada 10–15 min |
| RF-28 | Guardar el resultado de cada envío (entregado / fallido) | ❌ | Solo se guarda la hora de envío |

Fuera del alcance de la primera versión, por decisión del 3 de noviembre: pagos online.

## 2. Requisitos no funcionales

### Rendimiento (Lighthouse, móvil)

| ID | Requisito | Meta | Portada | Reserva | Ingreso | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| RNF-01 | Puntuación de rendimiento | ≥ 90 | 97 | 95 | 98 | ✅ |
| RNF-02 | LCP (carga del contenido principal) | ≤ 2,5 s | 2,6 s | 2,6 s | 2,3 s | ⚠️ portada y reserva, por poco |
| RNF-03 | CLS (estabilidad visual) | ≤ 0,1 | 0 | 0 | 0 | ✅ |
| RNF-04 | TBT (bloqueo del hilo principal) | ≤ 200 ms | — | — | — | Pendiente de volver a medir |
| RNF-05 | Disponibilidad calculada con pocas consultas | — | 3 consultas por rango de días, sin importar cuántos | | | ✅ |

Medido de nuevo el 4 de noviembre tras pasar al estilo tipo Calendly. Antes, la portada tenía rendimiento 91 y LCP 3,5 s porque cargaba primero una foto grande.

### Seguridad y privacidad

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RNF-06 | Contraseñas con hash bcrypt (coste 12) y tiempo constante si el correo no existe | ✅ | |
| RNF-07 | Cookie de sesión `httpOnly`, `secure` en producción, `SameSite=Lax` | ✅ | |
| RNF-08 | Aislamiento entre barberías: ninguna acción toca datos de otra | ✅ | Probado: un barbero ajeno da "no encontrado" |
| RNF-09 | Endpoint de recordatorios protegido con clave y comparación en tiempo constante | ✅ | 401 sin clave, 200 con clave |
| RNF-10 | Cabeceras de seguridad (nosniff, anti-iframe, Referrer, Permissions, HSTS) y sin `X-Powered-By` | ✅ | Añadidas el 4 de noviembre |
| RNF-11 | Content-Security-Policy | ❌ | Con streaming necesita nonces por petición |
| RNF-12 | Límite de intentos en el login y en las reservas | ❌ | Riesgo de fuerza bruta y de spam de reservas |
| RNF-13 | Dependencias de producción sin vulnerabilidades conocidas | ✅ | `npm audit --omit=dev`: 0 (16 moderadas solo en herramientas de desarrollo) |
| RNF-14 | Aviso de privacidad y consentimiento al reservar (Ley 1581 de 2012, habeas data) | ❌ | Se guardan nombre, teléfono y correo sin aviso |
| RNF-15 | Que el cliente pueda pedir el borrado de sus datos | ❌ | |

### Accesibilidad, SEO y uso en móvil

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RNF-16 | Accesibilidad Lighthouse 100 en las páginas públicas | ✅ | La portada estaba en 96 por un `aria-label` sin rol; corregido |
| RNF-17 | Uso completo con teclado y lector de pantalla | ⚠️ | Hay foco visible y etiquetas, pero no se ha probado con NVDA ni VoiceOver |
| RNF-18 | SEO Lighthouse ≥ 90 | ✅ | Portada 100, reserva 90, ingreso 100 |
| RNF-19 | Páginas inexistentes con 404 real y en español | ❌ | Devuelven 200 con el texto por defecto en inglés |
| RNF-20 | Diseño mobile-first: textos de 16 px en formularios, áreas seguras, objetivos táctiles ≥ 44 px | ✅ | |
| RNF-21 | Probado en un teléfono real (iOS y Android) | ❌ | Solo en emulación |
| RNF-22 | Hora, moneda y prefijo según el país de cada barbería | ✅ | Fechas en UTC, mostradas en la zona de la barbería |

### Operación y mantenimiento

| ID | Requisito | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| RNF-23 | TypeScript sin errores y lint limpio | ✅ | |
| RNF-24 | Pruebas automatizadas de disponibilidad, reservas y permisos | ❌ | Hoy hay 0 tests |
| RNF-25 | Registro de errores en producción (p. ej. Sentry) | ❌ | |
| RNF-26 | Copias de seguridad de la base de datos | ❌ | Depende del proveedor de Postgres que se elija |
| RNF-27 | Despliegue en producción | ❌ | Aún solo local |

## 3. Métricas

### De producto

| Métrica | Fórmula | ¿Hay datos? |
| --- | --- | --- |
| Reservas online por semana | Citas creadas por el cliente / semana | ✅ en la base de datos, sin pantalla |
| Tasa de no-show | `NO_SHOW` / (`COMPLETED` + `NO_SHOW`) | ✅ si el barbero marca las citas en la agenda |
| Tasa de cancelación | `CANCELLED` / citas totales | ✅ |
| Ocupación | Minutos reservados / minutos de trabajo | ✅ calculable a partir de horarios y citas |
| Ingresos previstos y realizados | Suma de precios de citas reservadas y atendidas | ✅ (el precio se guarda en cada cita) |
| Conversión de la página de reserva | Reservas / visitas a `/b/<barbería>` | ❌ falta analítica |
| Abandono por paso | Visitas que llegan a servicio → barbero → hora → datos → confirmar | ❌ falta analítica |
| Activación de barberías | Registro → primer servicio → primera reserva recibida | ⚠️ se infiere de fechas, sin eventos |
| Entrega de recordatorios | Enviados con éxito / intentados, por canal | ❌ ver RF-28 |

### Técnicas

| Métrica | Meta | Hoy |
| --- | --- | --- |
| Core Web Vitals de usuarios reales (LCP, INP, CLS) | Percentil 75 en "bueno" | ❌ sin medición real (falta RUM) |
| Tiempo de respuesta de la disponibilidad | ≤ 300 ms | Sin medir en producción |
| Errores del servidor | < 0,5 % de peticiones | ❌ sin registro de errores |

## 4. Prioridades

**Antes de lanzar (P1)**
1. Límite de intentos en el login y en las reservas (RNF-12).
2. Aviso de privacidad y consentimiento al reservar (RNF-14).
3. Crear citas a mano desde el panel (RF-14).
4. Recuperar contraseña (RF-03).
5. 404 real en español (RNF-19).
6. Configurar WhatsApp y Resend y programar el cron (RF-27).
7. Pruebas automatizadas de disponibilidad, reservas y aislamiento (RNF-24).
8. Desplegar con base de datos gestionada y copias de seguridad (RNF-26, RNF-27).

**Después (P2)**: LCP de la portada (RNF-02), CSP con nonces (RNF-11), aviso al barbero (RF-15), reprogramar (RF-24), lista de clientes (RF-16), analítica de conversión y registro de errores.

**Más adelante (P3)**: informes (RF-17), varias barberías y personal (RF-05), verificación de correo (RF-04).

### Reparto sugerido Claude / Codex

- **Codex** (tareas acotadas): tests de `availability.ts` y `booking.ts`, límite de intentos, página 404 en español, flujo de recuperar contraseña.
- **Claude** (diseño e integración): aviso de privacidad y consentimiento, cita manual en la agenda, elección de analítica y métricas, revisión de lo que entregue Codex.
