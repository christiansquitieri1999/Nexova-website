# Architecture Proposal — Nexova Solutions

> **Type:** Technical architecture proposal · **Project:** Nexova Platform · **Status:** Draft · **Updated:** 2026-11-18

## 1. Executive Summary

Nexova (120 empleados, 3 líneas de negocio) opera con un mosaico de herramientas inconexas — ATS legacy, HubSpot, Zendesk, Google Workspace, hojas de cálculo — sin visibilidad en tiempo real ni automatización. Se propone un **Monolito Modular con Domain-Driven Design (DDD)** como patrón arquitectónico principal, con capacidad de evolución a microservicios cuando la escala lo justifique.

**Alcance del hito:** la entrega es una propuesta de arquitectura, no una implementación. Se elige **Python con FastAPI** y se usa **Talent Pipeline** como primer caso para diseñar y validar el backend: listado, filtros, detalle, registro, cambios de estado o etapa y notas internas. Los demás dominios, el scoring de CV y la infraestructura de IA son evolución prevista, no requisitos del hito. Para la evaluación se toma como base lo visto en el curso; ninguna herramienta adicional es obligatoria.

---

## 2. Análisis de Patrones Arquitectónicos

| Patrón | Idoneidad para Nexova | Razón principal |
|---|---|---|
| **Capas horizontales globales (3-tier)** | Baja como estructura principal | Separan responsabilidades técnicas, pero dispersan las reglas de selección y soporte entre carpetas globales. Son útiles dentro de cada módulo. |
| **MVC** | Útil en la interfaz HTTP | Separa la entrada de la lógica, pero no define por sí solo quién controla una transición de candidatura ni cómo se comparte un KPI sin leer tablas ajenas. |
| **Serverless (FaaS)** | Útil para tareas aisladas | Puede servir para un informe programado, pero adoptar funciones para todo el backend añade coordinación de despliegues y diagnóstico para un equipo de seis personas. |
| **Arquitectura Hexagonal** | ✅ Alta (como complemento interno) | Aísla lógica de negocio de infraestructura. Ideal como estructura _dentro_ de cada módulo. |
| **Arquitectura Orientada a Eventos** | ✅ Media-alta (como complemento) | Adecuada para eventos cross-domain, pero la consistencia eventual añade complejidad innecesaria a dominios CRUD como RRHH. |
| **Monolito Modular + DDD** | ✅ **Máxima idoneidad** | Separa por bounded contexts con un solo deploy. Balancea autonomía de dominio con simplicidad operativa. |

### Por qué se descartan los demás

**Microservicios puros** son sobreingeniería en esta etapa: el equipo es pequeño, el código no está escrito, y los dominios comparten datos y flujos. El coste operativo (service discovery, transacciones distribuidas, observabilidad) supera el beneficio.

---

## 3. Patrón Recomendado: Monolito Modular con DDD

### 3.1 Justificación vinculada a Nexova

| Característica de Nexova | Implicación arquitectónica | Cómo lo resuelve el patrón |
|---|---|---|
| **Equipo de 6 ingenieros** | No puede sostener sobrecarga multi-servicio. | Un solo deployable: un CI/CD, un stack de observabilidad. |
| **Selección, formación, soporte y áreas internas** | Una etapa de candidatura, una inscripción y un SLA cambian por reglas distintas. | Cada contexto es dueño de sus reglas y datos; publica contratos para colaborar con los demás. |
| **IA aplicada al negocio** | El scoring de CV y el asistente de soporte evolucionan a ritmos distintos. | Cada módulo conserva sus reglas y puede incorporar un proveedor por un adaptador cuando lo necesite. |
| **Dashboards con datos actualizados** | Dirección necesita KPIs agregados sin acceder a expedientes de candidatos o empleados. | El módulo ejecutivo puede consumir consultas agregadas o proyecciones de eventos, sin imponer un bus en el hito inicial. |
| **Datos en sistemas desconectados** (HubSpot, Zendesk, legacy ATS) | La lógica de integración debe ser centralizada y testeable. | Adaptadores encapsulan APIs externas; la migración no afecta la capa de dominio. |
| **Dashboard ejecutivo unificado (Laura)** | Vista cross-domain que agrega datos de todos los módulos. | Módulo `ExecutiveDashboard` consume datos vía servicios de dominio internos o proyecciones de eventos. |
| **El sistema debe evolucionar** | Una tarea como el scoring puede llegar a necesitar recursos propios. | Los límites permiten evaluar una extracción futura; separar un módulo requiere migrar sus datos, adaptar sus contratos y asumir operación adicional. |

### 3.2 Diagrama conceptual

```
Backoffice Next.js --> API FastAPI --> Router del dominio --> Caso de uso
                                                                  |
                                         Reglas del dominio <-----+
                                         Puerto de datos    <-----+
                                                ^
                                     Adaptador de persistencia
```

---

## 4. Estructura de Carpetas del Backend

### 4.1 Ubicación y estructura propuesta

El backend se ubicaría en `services/nexova-api/`. Es un servicio **propuesto**, distinto de [la documentación de la API externa actual](../services/talent-pipeline-api/README.md). La estructura muestra el destino de cada responsabilidad; no exige crear módulos ni carpetas vacías.

```
services/nexova-api/
├── app/
│   ├── main.py                    # Compone FastAPI y registra los routers
│   ├── dependencies.py            # Dependencias HTTP comunes
│   ├── health.py                  # Router operativo
│   ├── config/
│   │   └── settings.py            # Configuración del backend por entorno
│   └── modules/
│       ├── talent_pipeline/       # Primer módulo del backend
│       ├── training_catalog/      # Hoja de ruta
│       ├── support_desk/
│       ├── sales_pipeline/
│       ├── hr_internal/
│       ├── marketing_comms/
│       └── executive_dashboard/
├── tests/                         # Pruebas de API, casos de uso y adaptadores
└── README.md                      # Contrato, configuración y ejecución del servicio
```

### 4.2 Anatomía interna de cada módulo (ej: `talent_pipeline/`)

```
app/modules/talent_pipeline/
├── domain/                        # Entidades y reglas: candidatura, etapa, estado
├── application/
│   ├── use_cases/                 # Registrar, consultar y actualizar candidaturas
│   └── ports.py                   # Contratos para dependencias como la persistencia
├── infrastructure/
│   └── persistence/               # Repositorio y modelos de almacenamiento si aplican
└── interfaces/
    └── rest/
        ├── router.py              # Endpoints HTTP del módulo
        └── schemas.py             # Modelos Pydantic de entrada y salida
```

### 4.3 Reglas de interacción entre módulos

| Regla | Razón |
|---|---|
| Solo se comunican por contratos públicos de aplicación o eventos. No consultan tablas, repositorios ni modelos de persistencia ajenos. | Una instancia de base de datos puede alojar esquemas separados sin perder la propiedad de los datos. |
| Un módulo puede llamar al **application service de otro** (síncrono), pero no a sus internos. | Ej: `SalesPipeline` consulta a `TalentPipeline` "colocaciones este trimestre". |
| **Eventos de dominio** para efectos secundarios cross-module (asíncrono). | Ej: `PlacementConfirmed` → `SalesPipeline` actualiza deal → `ExecutiveDashboard` refresca KPI. |
| El código compartido se limita a convenciones técnicas o conceptos realmente comunes; no contiene reglas de negocio de los módulos. | Evita que una carpeta común se convierta en un punto de acoplamiento. |
| `main.py` y las dependencias de composición conectan los puertos con los adaptadores. El dominio y la aplicación no importan FastAPI ni la persistencia concreta. | Permite probar las reglas sin servidor ni base de datos. |

---

## 5. Criterios de Separación por Dominio

### 5.1 Bounded Contexts

Cada contexto tiene: responsable de negocio claro, lenguaje ubicuo propio, datos que ningún otro contexto modifica, y ciclo de vida independiente.

| Contexto | Responsable | Datos clave | Usuarios | Funcionalidades IA clave |
|---|---|---|---|---|
| **TalentPipeline** | Javier Almeida | Candidatos, vacantes, colocaciones, entrevistas | 40 consultores | Scoring/ranking de CVs, búsqueda RAG, agente de comunicación |
| **TrainingCatalog** | Elena Vargas | Programas, inscripciones, alumnos, certificados | 12 formadores | Recomendador, planes personalizados, chatbot asesor |
| **SupportDesk** | Roberto Díaz | Tickets, KB, SLAs, agentes | 30 agentes | Chatbot 1ª línea (RAG), análisis de sentimiento, búsqueda semántica |
| **SalesPipeline** | Marcos Ibáñez | Leads, deals, cuentas, secuencias | 18 ventas + SDRs | Scoring de prospectos, sugerencia de enfoque, automatización de secuencias |
| **HRInternal** | Patricia Solís | Empleados, ausencias, onboarding, evaluaciones | 4 RRHH + 120 empleados | Agente FAQ interno, automatización de onboarding |
| **MarketingComms** | Carmen Ruiz | Campañas, contenido, analíticas, SEO | Equipo pequeño | Pipeline de contenido asistido por IA, optimización SEO/GEO |
| **ExecutiveDashboard** | Laura Mendoza | KPIs cross-domain, alertas, informes | CEO | Asistente NL para KPIs, informe semanal automático |

### 5.2 Clasificación DDD Estratégica

| Clasificación | Contextos | Estrategia |
|---|---|---|
| **Core Domain** (ventaja competitiva) | TalentPipeline, SupportDesk (chatbot), SalesPipeline (AI scoring) | Inversión fuerte. La IA es el foso competitivo. |
| **Supporting Domain** (necesario, no único) | TrainingCatalog, MarketingComms | Soluciones suficientemente buenas; reutilizar IA de core domains. |
| **Generic Subdomain** (comprar vs construir) | HRInternal (gestión de ausencias, nóminas) | Considerar integración con SaaS existente vía adaptadores. |

### 5.3 Principios de separación de responsabilidades

1. **Cada módulo es dueño de sus datos.** Si usa persistencia relacional compartida, separa sus tablas por esquema. Los otros módulos acceden por contratos, no por consultas directas.
2. **Cada módulo publica eventos cuando existen consumidores.** No dicta cómo se consumen.
3. **Los adaptadores de IA pertenecen al módulo que los usa.** Si varios módulos necesitan un cliente común, se comparte como infraestructura, sin compartir reglas de negocio.
4. **Las UIs son periferia.** Las aplicaciones frontend consumen la API — no dictan los boundaries de los módulos.
5. **El procesamiento en segundo plano es opcional.** Si una operación larga requiere un worker, este invoca los mismos casos de uso que el router.

---

## 6. Aspectos Transversales

**Operación inicial:** registrar errores sin incluir datos personales y separar el estado del proceso (`GET /health`) de la disponibilidad de sus dependencias necesarias (`GET /health/ready`).

**Acceso:** las dependencias HTTP identifican al usuario en rutas protegidas. Los casos de uso comprueban si puede ver o modificar la candidatura concreta. Las notas internas no se exponen al sitio público.

**Evolución opcional:** evaluar colas y workers (p. ej., Celery) si el scoring necesita reintentos o procesamiento durable; almacenamiento vectorial cuando se implemente búsqueda semántica; caché (p. ej., Redis) solo si la carga medida lo justifica. La telemetría avanzada, las proyecciones de KPIs y los proveedores de IA pertenecen a hitos posteriores.

---

## 7. Organización de Endpoints y Routers de FastAPI

### 7.1 Criterio de agrupación

Los routers se agrupan por **dominio responsable**, no por pantalla ni por operación CRUD. Cada dominio define su `APIRouter` en `app/modules/<dominio>/interfaces/rest/router.py`, con un prefijo propio y una etiqueta de dominio en OpenAPI. Las dependencias compartidas verifican la identidad en las rutas protegidas; el caso de uso verifica los permisos de la operación y el acceso al registro concreto.

### 7.2 Jerarquía de routers

`app/main.py` registra los routers de negocio mediante `include_router` y añade el prefijo común `/api/v1` una sola vez. Cada módulo añade solo su segmento, por ejemplo `/talent`. El router operativo de `app/health.py` queda fuera del versionado funcional.

### 7.3 Mapa de endpoints por dominio

Los ejemplos son contratos **propuestos**, no rutas disponibles hoy. Los endpoints de la tabla son relativos al prefijo indicado.

| Router | Prefijo | Endpoints principales | Propósito |
|---|---|---|---|
| **Talent Pipeline** | `/api/v1/talent` | `GET /candidates`, `POST /candidates`, `GET /candidates/{id}`, `PATCH /candidates/{id}`, `GET /candidates/{id}/notes`, `POST /candidates/{id}/notes`, `DELETE /candidates/{id}/notes/{note_id}` | **Primer alcance:** listado paginado con búsqueda por nombre o email y filtros de estado y etapa; registro, detalle, cambios y notas internas. |
| **Talent Pipeline (evolución)** | `/api/v1/talent` | `GET /vacancies`, `POST /candidates/{id}/score`, `POST /candidates/search` | Vacantes, scoring y búsqueda semántica en hitos posteriores. |
| **Formación** | `/api/v1/training` | `GET /programs`, `POST /enrollments`, `GET /enrollments/{id}/progress` | Evolución: catálogo, inscripción y progreso. |
| **Soporte** | `/api/v1/support` | `POST /tickets`, `GET /tickets/{id}`, `POST /tickets/{id}/resolve` | Evolución: gestionar la incidencia y su resolución. |
| **Ventas** | `/api/v1/sales` | `GET /leads`, `GET /deals`, `PATCH /deals/{id}` | Evolución: consultar oportunidades y avanzar etapas. |
| **RRHH interno** | `/api/v1/hr` | `GET /employees`, `POST /absences`, `GET /onboarding/{id}/progress` | Evolución: plantilla, ausencias e incorporación. |
| **Marketing** | `/api/v1/marketing` | `GET /campaigns`, `GET /analytics/conversions`, `POST /content/generate` | Evolución: campañas, conversión y contenido asistido. |
| **Dirección** | `/api/v1/executive` | `GET /dashboard`, `GET /reports/weekly` | Evolución: consultas de KPIs agregados e informes. |

Las rutas operativas son `GET /health` y `GET /health/ready`. Devuelven estado operativo sin detalles sensibles.

### 7.4 Convenciones de diseño de endpoints

- **Versionado por prefijo de ruta** (`/api/v1/...`). Cuando un breaking change sea inevitable, se crea `/api/v2/...` y se mantiene el anterior durante un período de transición.
- **Contrato HTTP explícito.** Documentar paginación, campos y errores en OpenAPI: una búsqueda sin coincidencias devuelve una lista vacía, un identificador inexistente devuelve `404` y los datos inválidos reciben el error de validación de FastAPI (`422`). No se requiere un envoltorio JSON global.
- **Reglas fuera de HTTP.** `PATCH /candidates/{id}` modifica los campos enviados; el caso de uso decide qué cambios de estado o etapa se permiten.

### 7.5 Relación entre routers y módulos DDD

El router valida los datos HTTP con Pydantic, invoca el caso de uso y convierte su resultado en el modelo de respuesta. Las dependencias HTTP identifican al usuario; la aplicación decide si puede realizar la operación sobre ese recurso. Las reglas de negocio y las consultas de persistencia no viven en el router.

---

## 8. Influencia de la Estructura Estándar de FastAPI

### 8.1 Convenciones estándar investigadas

FastAPI no impone un árbol de carpetas. Nexova parte de las convenciones de la documentación oficial y las adapta a sus módulos de negocio:

| Convención | Descripción | Cómo influye en Nexova |
|---|---|---|
| **Entry point, routers y dependencias** | [Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) muestra `app/main.py`, `dependencies.py` y routers separados, con prefijos, etiquetas y dependencias reutilizables. | `app/main.py` compone la API; `app/dependencies.py` reúne dependencias HTTP comunes. Cada router vive junto al dominio que lo mantiene, en vez de compartir una carpeta global de rutas. |
| **Modelos HTTP explícitos** | [Response Model](https://fastapi.tiangolo.com/tutorial/response-model/) explica cómo FastAPI valida, documenta y filtra los campos de salida. | `interfaces/rest/schemas.py` define el contrato Pydantic. Las entidades de negocio quedan en `domain/` y los modelos de almacenamiento, si existen, en `infrastructure/persistence/`. |
| **Configuración por entorno** | [Settings and Environment Variables](https://fastapi.tiangolo.com/advanced/settings/) describe la lectura y validación de configuración externa. | `app/config/settings.py` centraliza y valida los valores necesarios al arrancar (por ejemplo, los orígenes permitidos); los routers no leen variables por su cuenta. |

### 8.2 Adaptaciones para Nexova

Los routers llaman a casos de uso independientes de FastAPI. Los DTOs de aplicación se añaden cuando el caso de uso necesita un contrato propio o lo reutilizan otros adaptadores. Esa simplificación no elimina los modelos HTTP ni convierte el modelo de base de datos en una respuesta pública.

---

## 9. Separación Frontend / Backend

### 9.1 Estrategia de repositorio: Monorepo con separación lógica

El [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) muestra cómo frontend y backend pueden convivir en un repositorio sin ser la misma aplicación. Nexova conserva su [monorepo actual](./project-context.md) y su stack Next.js: `uis/website/` y `uis/backoffice/` mantienen dependencias, configuración y builds propios; `services/nexova-api/` sería el backend propuesto, con ejecución y despliegue independientes. No se adoptan las herramientas del template por el hecho de usarlo como referencia.

Para un equipo de seis personas, el monorepo permite revisar en una sola PR los cambios al contrato y a sus consumidores. Repositorios separados podrían convenir si distintos equipos necesitan permisos de acceso o ciclos de entrega propios, pero requieren coordinar cambios y versiones entre repositorios. En ambos casos, un cambio conjunto de código no garantiza un despliegue simultáneo.

### 9.2 Comunicación API

- **Hoy:** el backoffice consume la [API externa de Talent Pipeline](../services/talent-pipeline-api/README.md) bajo `/tracker/api/v1`, con operaciones sobre `/records`. No existe una API FastAPI local ni se cambia la integración en este hito.
- **Propuesta:** FastAPI expone REST/JSON bajo `/api/v1`. El backoffice consume las rutas protegidas de selección; el sitio público no llama a rutas internas y solo consumiría contratos públicos cuando se definan. El backend verifica identidad y permisos: no confía en los controles de la UI.
- **Contrato y migración:** OpenAPI describe rutas, esquemas y errores de la API propuesta. Si se autoriza el cambio, primero se adapta y verifica el cliente del backoffice: `/records` y `/talent/candidates` no son compatibles cambiando solo la URL base.

### 9.3 Variables de entorno

| Variable | Dónde se configura | Finalidad |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Entorno del backoffice Next.js | URL base pública que usa hoy el cliente. No contiene credenciales. |
| `CORS_ALLOWED_ORIGINS` | Entorno del backend propuesto | Lista de orígenes de navegador permitidos, validada al arrancar. |
| `DATABASE_URL` (si aplica) | Solo entorno del backend | Configuración privada de persistencia; nunca se incluye en el frontend ni en el repositorio. |

Según la [guía de variables de Next.js](https://nextjs.org/docs/app/guides/environment-variables), los valores `NEXT_PUBLIC_*` referenciados en el código del navegador se incorporan al build. Nunca deben contener secretos. Cada aplicación recibe solo la configuración que necesita para su entorno.

### 9.4 CORS

La [guía de CORS de FastAPI](https://fastapi.tiangolo.com/tutorial/cors/) define el origen por protocolo, host y puerto. CORS aplica a llamadas del navegador entre orígenes distintos, no a llamadas servidor a servidor ni a peticiones del mismo origen.

| Entorno | Frontend origin | Configuración CORS |
|---|---|---|
| **Desarrollo local** | `http://localhost:3000` por defecto en ambas UI; si se ejecutan juntas, configurar una explícitamente en otro puerto (p. ej., `http://localhost:3001`). | Permitir solo los orígenes de las UI que hagan llamadas desde el navegador. |
| **Staging / producción** | Orígenes HTTPS reales de cada entorno, por confirmar en el despliegue. | Configurar una lista exacta por entorno; producción no permite orígenes locales ni de staging. |

Para llamadas entre orígenes, `CORSMiddleware` permite los orígenes, métodos y encabezados necesarios. No se usa un comodín ni se habilitan cookies entre orígenes por defecto. CORS no reemplaza la autorización. Si el despliegue futuro sirve la UI y `/api` bajo el mismo origen, no necesita CORS para ese tráfico.

---

## 10. Riesgos y Puntos de Atención

| Riesgo | Qué puede fallar | Cómo reducirlo |
|---|---|---|
| **Erosión de los límites entre módulos** | Si Dirección consulta tablas de Talent Pipeline, un cambio en el esquema de selección puede romper sus KPIs. | Revisar en cada PR imports y accesos que cruzan módulos. Consumir contratos públicos o proyecciones, según la §4.3. |
| **Sobrecarga de abstracción** | Crear capas vacías ralentiza al equipo; para evitarlas, se corre el riesgo de trasladar las reglas al router y duplicarlas en otros puntos de entrada. | Añadir puertos y DTOs cuando hagan falta. Mantener los casos de uso independientes de HTTP y no devolver modelos de persistencia. |
| **Ruptura del contrato con el backoffice** | Cambiar solo la URL hacia la API nueva rompería listados, actualizaciones o notas que aún dependen de `/records`. | Mantener la integración externa hasta verificar rutas, paginación, errores y permisos con el cliente adaptado. |

---

## 11. Próximos Pasos

1. **Validar con Selección** el primer alcance, las transiciones permitidas y quién puede consultar o modificar candidaturas y notas.
2. **Revisar el contrato FastAPI** antes de implementar: colección vacía, filtros inválidos, candidatura inexistente y acceso a notas sin permiso.
3. **Cuando se autorice la implementación**, construir primero el módulo Talent Pipeline y mantener la API externa hasta validar la migración del backoffice.
4. **Revisar los demás dominios con sus responsables** e incorporar infraestructura adicional solo cuando un hito y una necesidad concreta lo justifiquen.

---

*Borrador de trabajo — debe evolucionar conforme el equipo valide supuestos con stakeholders.*