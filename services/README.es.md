# Carpeta `services`

Esta carpeta contiene los servicios backend (APIs y workers en segundo plano) relacionados con el proyecto de la compañía.

Cada subcarpeta de implementación debe corresponder a un servicio e incluir su documentación técnica y funcional. También se pueden documentar aquí integraciones con APIs externas, indicando claramente si se alojan localmente o son dependencias externas.

- **Propósito principal**: centralizar la lógica backend, APIs y consumidores de colas que dan soporte a los casos de uso de la compañía.
- **Recomendación**: documenta en este archivo o en el sub-README el objetivo, la tecnología y cómo ejecutar cada servicio.

## Integraciones externas

- `talent-pipeline-api/` documenta la API externa utilizada por `uis/backoffice`. El backoffice la consume directamente; este repositorio no implementa un servicio local ni un proxy.
