# Proyecto de Compañía - Ingeniería de IA — Plantilla para estudiantes

[![4Geeks Academy](https://img.shields.io/badge/4Geeks-Academy-blue)](https://4geeksacademy.com)
[![AI Engineering](https://img.shields.io/badge/track-AI%20Engineering-green)](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)

_Plantilla base para proyectos transversales del Programa de Carrera en Ingeniería de IA — 4Geeks Academy._

_These instructions are also available in [English](./README.md)._

---

## Propósito

Este repositorio es la **plantilla de inicio** para los proyectos transversales. Trabajarás con escenarios de empresas reales (Brasaland, TrackFlow, Nexova) construyendo entregables que se corresponden con los hitos del curso (Web, Programación, Backend, Telemetría, RAG, Agentes, Workflows, Tiempo real).

- Crea una plantilla a partir de este repositorio.
- Usa `contexts/` para encontrar el brief de cada hito del proyecto.
- Usa `skills/` y los `README.md` por carpeta como guía de trabajo.

---

## Cómo empezar

1. **Usa este repositorio como plantilla** y crea tu propio repo de proyecto.
2. **Clona** tu repositorio (o ábrelo en Codespaces).
3. **Abre** el brief correspondiente dentro de `contexts/` antes de empezar un hito.
4. **Lee esta guía de carpetas** y abre el `README.md` de la carpeta en la que estés trabajando.
5. **Empieza a implementar** en la carpeta correcta — no tires todo en la raíz.
6. **Documenta** lo que añadas: cada app, servicio, agente o pipeline nuevo lleva subcarpeta + README.

---

## Cómo entender este monorepo

Estás construyendo **una sola empresa** a lo largo de muchos hitos y proyectos. Cada carpeta de primer nivel tiene **una responsabilidad clara** — como en un repositorio real de un equipo de ingeniería.

| Capa                    | Carpetas                          | Qué vive aquí                                                               |
| ----------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| **Briefs por hito**     | `contexts/`                       | Requisitos y detalles del dominio, organizados por hito del proyecto        |
| **Cara al usuario**     | `uis/`, `services/`               | Frontends y backends con los que interactúan usuarios u operadores          |
| **Datos**               | `data/`                           | Archivos crudos, pipelines, datasets procesados y conjuntos de evaluación   |
| **IA**                  | `agents/`, `skills/`, `mcps/`     | Agentes, capacidades reutilizables para agentes y servidores MCP            |
| **Automatización**      | `workflows/`                      | Flujos n8n y orquestación entre sistemas                                    |
| **Reutilización**       | `packages/`, `shared/`            | Tipos compartidos, SDKs, esquemas, plantillas                               |
| **Operaciones**         | `infra/`, `scripts/`, `internal/` | Docker, despliegue, scripts puntuales, CLIs internas                        |
| **Documentación**       | `docs/`                           | Arquitectura, decisiones y convenciones de todo el repo                     |

**Regla rápida:** si tiene interfaz visual → `uis/`. Si expone una API o corre en segundo plano → `services/`. Si mueve o transforma datos → `data/`. Si el trabajo lo hace un modelo de IA → `agents/` (+ `skills/` o `mcps/` según haga falta).

---

## Estado actual de la plantilla

> El repositorio ahora incluye aplicaciones Nexova ejecutables y documentación de workflow para agentes.
>
> - `uis/website/` es la aplicación pública con React, TypeScript y Next.js.
> - `uis/backoffice/` es la aplicación interna con React, TypeScript y Next.js; incluye Talent Pipeline y Business Model.
> - `services/talent-pipeline-api/` documenta la integración con una API externa; no es un servicio local ni un proxy.
> - El `AGENTS.md` raíz dirige al contributor a las convenciones correspondientes de `.agents/`.
> - `contexts/` sigue siendo la fuente de briefs por hito; sus archivos no se modifican durante esta migración.
> - [Contexto del proyecto](./docs/project-context.md) resume Nexova y la propiedad de carpetas; los briefs siguen siendo canónicos para los requisitos de cada hito.
> - Existe metadata del paquete compartido en `packages/shared/package.json` (`@repo/shared-types`), pero aún no hay runner de workspace en raíz.

---

## Guía de carpetas — qué va en cada una

Lee el `README.md` enlazado dentro de cada carpeta antes de empezar a programar ahí.

### Archivos en la raíz

| Ruta                         | Propósito                                                            | Qué haces aquí                                                                                               |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`contexts/`](./contexts/) | Briefs específicos de cada hito | **Primer paso:** lee el brief del hito que estás construyendo |
| `docker-compose.yml`         | Orquestación local de todo el stack                                  | Mantener en la raíz del repo — conecta `services/`, bases de datos y otros contenedores desde un solo lugar  |
| `README.md` / `README.es.md` | Esta guía                                                            | Orientación — estás aquí                                                                                     |

### `uis/` — interfaces de usuario

**Propósito:** Todas las aplicaciones frontend — todo lo que un humano ve y en lo que hace clic.

**Pon aquí:**

- Sitio web público (`website/`)
- Admin interno / backoffice (`backoffice/`)
- Portales de clientes, apps de fidelización, herramientas Streamlit/Gradio, dashboards con UI

**Ejemplos:** landing corporativa, backoffice de operaciones, portal de fidelización, UI de dashboard de telemetría

→ Ver [`uis/README.md`](./uis/README.md)

### `services/` — APIs y servicios backend

**Propósito:** APIs backend y servicios en segundo plano para los casos de uso de la empresa. Esta carpeta también puede documentar integraciones con APIs externas; documentar una API externa no significa que exista una implementación local.

**Pon aquí:**

- Implementaciones de APIs locales cuando lo solicite un hito activo, cada una con README y configuración de ejecución documentados.
- Workers en segundo plano cuando deban ejecutarse de forma independiente.
- Documentación de integraciones externas, indicando claramente que son externas y si existe una implementación local.

**Integración actual:** `services/talent-pipeline-api/` documenta una API externa a la que `uis/backoffice/` llama directamente; este repositorio no implementa actualmente una API local ni un proxy.

**Recomendación:** Mantén los servicios enfocados y no añadas un proxy local ni un árbol de APIs paralelo salvo que la tarea activa lo requiera.

→ Ver [`services/README.md`](./services/README.md)

### `data/` — datasets, pipelines y evaluación

**Propósito:** Todo lo relacionado con datos, desde archivos crudos hasta tablas listas para producción.

| Subcarpeta                                      | Propósito                     | Qué haces aquí                                                                  |
| ----------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| [`data/raw/`](./data/raw/README.md)             | Datos fuente sin tocar        | Guardar dumps, exports, CSV/JSON de ejemplo — documentar origen y reglas de PII |
| [`data/pipelines/`](./data/pipelines/README.md) | Jobs ETL/ELT                  | Escribir scripts de ingesta, limpieza y transformación                          |
| [`data/process/`](./data/process/README.md)     | Salidas limpias / intermedias | Guardar artefactos de pipelines (features, agregados, tablas limpias)           |
| [`data/eval/`](./data/eval/README.md)           | Medición de calidad           | Golden sets, datasets de evaluación RAG/agentes, métricas de experimentos       |

**Flujo:** `raw` → `pipelines` → `process` → consumido por `services/`, `uis/` o `agents/`. Usa `eval` para demostrar calidad.

### `agents/` — agentes de IA

**Propósito:** Asistentes de IA autónomos o semi-autónomos para la empresa.

**Pon aquí:**

- Una subcarpeta por agente (p. ej. `support-agent/`, `onboarding-agent/`)
- Config del agente, prompts, herramientas, tests
- Empieza desde [`agents/_template/`](./agents/_template/README.md) al crear un agente nuevo

**Ejemplos:** bot de soporte al cliente, copiloto de onboarding, asistente de formación

→ Ver [`agents/README.md`](./agents/README.md)

### `skills/` — capacidades reutilizables para agentes

**Propósito:** Instrucciones empaquetadas + scripts que agentes (o tú en Cursor) reutilizan en todo el repo.

**Pon aquí:**

- Skills de análisis de datos, code review, scraping, investigación, etc.
- Cada skill = carpeta con `SKILL.md`, scripts y recursos opcionales

**Ejemplo incluido:** `skills/data-analysis/` (script de limpieza pandas + referencia de métricas)

→ Ver [`skills/README.md`](./skills/README.md)

### `mcps/` — servidores Model Context Protocol

**Propósito:** Conectar modelos de IA con tus sistemas — bases de datos, APIs, GitHub, herramientas propias.

**Pon aquí:**

- Una subcarpeta por servidor MCP (p. ej. `database-mcp/`, `github-mcp/`)
- Definiciones de tools, resources y config del servidor

**Cuándo usarlo:** cuando un agente necesita acceso en vivo a datos o acciones que el código solo no puede dar

→ Ver [`mcps/README.md`](./mcps/README.md)

### `workflows/` — automatización y orquestación

**Propósito:** Conectar sistemas sin escribir apps completas — jobs programados, webhooks, notificaciones.

**Pon aquí:**

- Exports de workflows n8n, configs de Make/Zapier u orquestación documentada
- Flujos que enlazan `services/`, `data/pipelines/` y `agents/`

**Ejemplos:** nuevo pedido → alerta Slack, trigger ETL nocturno, lead → sync CRM

→ Ver [`workflows/README.md`](./workflows/README.md)

### `packages/` — librerías compartidas

**Propósito:** Código versionable reutilizado por varias apps, agentes o pipelines.

**Pon aquí:**

- Tipos TypeScript compartidos (`packages/shared/` → `@repo/shared-types`)
- Librerías de componentes UI, clientes API, SDKs de analytics

**Regla:** si `uis/` y `services/` comparten la misma interfaz → extráela aquí

→ Ver [`packages/README.md`](./packages/README.md)

### `shared/` — recursos sueltos compartidos

**Propósito:** Recursos que no son un paquete completo — esquemas, plantillas, assets estáticos, docs cortas.

**Pon aquí:**

- Esquemas JSON, plantillas de email, specs OpenAPI, design tokens
- Cualquier cosa reutilizada pero demasiado pequeña o no-código para `packages/`

→ Ver [`shared/README.md`](./shared/README.md)

### `docs/` — documentación transversal

**Propósito:** Arquitectura y decisiones que abarcan todo el proyecto de la empresa.

**Pon aquí:**

- Diagramas de arquitectura, ADRs, guías de seguridad/observabilidad
- Convenciones no atadas a una sola app o agente

→ Ver [`docs/README.md`](./docs/README.md)

### `infra/` — infraestructura y despliegue

**Propósito:** Cómo corre el proyecto en Docker, cloud o CI.

**Pon aquí:**

- Dockerfiles, Terraform, manifiestos K8s, configs Nginx, pipelines CI/CD

**Mantener en la raíz del repo:** `docker-compose.yml` — orquesta el entorno local de `services/`, bases de datos y otros contenedores desde un solo lugar.

→ Ver [`infra/README.md`](./infra/README.md)

### `scripts/` — scripts de ayuda

**Propósito:** Automatización pequeña y repetible — no apps completas.

**Pon aquí:**

- Scripts de setup, generadores de seed data, wrappers de lint, migraciones puntuales
- Documenta cada script: qué hace, argumentos y cómo ejecutarlo

**Diferencia con `internal/`:** los scripts suelen ser archivos sueltos; las tools de `internal/` son proyectos estructurados con deps y tests propios.

→ Ver [`scripts/README.md`](./scripts/README.md)

### `internal/` — herramientas internas para desarrolladores

**Propósito:** Utilidades robustas para el equipo de ingeniería.

**Pon aquí:**

- CLIs, herramientas de migración empaquetadas, evaluadores de prompts
- Tools con su propio `package.json`, tests y pasos de instalación

→ Ver [`internal/README.md`](./internal/README.md)

---

## ¿Dónde pongo esto?

Guía rápida de decisión:

```text
¿Tiene botones y pantallas?                → uis/
¿Corre en servidor / API / cola?           → services/
¿Es dato crudo o transformado?             → data/raw/ o data/process/
¿Mueve datos entre sistemas?               → data/pipelines/
¿Mides calidad de IA/pipelines?            → data/eval/
¿Es un asistente de IA con un objetivo?    → agents/
¿Es una capacidad/instrucción reutilizable?→ skills/
¿La IA necesita llamar tools/APIs externas?→ mcps/
¿Es n8n / automatización programada?       → workflows/
¿2+ carpetas importan el mismo código?     → packages/
¿Es esquema/plantilla/asset, no librería?  → shared/
¿Es arquitectura o docs de todo el equipo? → docs/
¿Es docker-compose para dev local?         → raíz del repo
¿Es Docker / deploy / config cloud?        → infra/
¿Es un script puntual?                     → scripts/
¿Es una CLI con su propio paquete?         → internal/
```

---

## Estructura del repositorio (árbol)

```text
ai-engineering-company-project-monorepo/
├── README.md / README.es.md   # Esta guía
├── contexts/                  # ← Briefs organizados por hito
│   ├── 01-public-website/
│   └── 02-programming-fundamentals/
├── docker-compose.yml         # ← Orquestación local (raíz del repo)
├── uis/                       # Frontends (website, backoffice, dashboards)
├── services/                  # Servicios backend y documentación de APIs externas
├── .agents/                   # Instrucciones de agentes y reglas por ámbito
├── memory-bank/               # Contexto de negocio, técnico y progreso
├── data/
│   ├── raw/                   # Datasets fuente
│   ├── pipelines/             # Jobs ETL/ELT
│   ├── process/               # Salidas limpias / intermedias
│   └── eval/                  # Conjuntos de evaluación y métricas
├── agents/                    # Agentes de IA (+ plantilla _template/)
├── skills/                    # Skills reutilizables para agentes
├── mcps/                      # Servidores MCP para acceso a tools
├── workflows/                 # Flujos n8n y automatizaciones
├── packages/                  # Librerías compartidas (@repo/shared-types, …)
├── shared/                    # Esquemas, plantillas, assets sueltos
├── docs/                      # Arquitectura y docs transversales
├── infra/                     # Docker, Terraform, despliegue
├── scripts/                   # Scripts de ayuda
└── internal/                  # CLIs y herramientas internas de desarrollo
```

---

## Enlaces

- [4Geeks Academy — Ingeniería de IA](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)
- [Cómo empezar un proyecto de código](https://4geeks.com/lesson/how-to-start-a-project)

---

## Contribuidores

Esta plantilla fue creada como parte del Programa de Carrera de Ingeniería de IA de 4Geeks Academy por [@marcogonzalo](https://www.linkedin.com/in/marcogonzalo) y [@alezanchezr](https://x.com/alesanchezr), junto a otros muchos colaboradores. Descubre más sobre nuestro [Curso de Ingeniería de IA](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia) y sobre [otros cursos](https://4geeksacademy.com/es/comparar-programas).

Puedes encontrar otras plantillas y recursos similares en la [página de GitHub de 4Geeks Academy](https://github.com/4geeksacademy).

_Esta plantilla la mantiene 4Geeks Academy para el track de Ingeniería de IA. Uso exclusivo del programa._
