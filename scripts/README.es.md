# Carpeta `scripts`

Esta carpeta contiene **scripts auxiliares** del monorepo: automatizaciones de desarrollo, utilidades de mantenimiento, tareas repetitivas (setup, lint, migraciones, generación de datos, etc.) y tooling interno.

- **Propósito principal**: agrupar herramientas de soporte que no pertenecen a una app/agente/pipeline específico, pero facilitan el trabajo del equipo.
- **Recomendación**: documenta cada script (qué hace, parámetros, requisitos, ejemplos de uso) y procura que sean reproducibles (y seguros) en distintos entornos.

## Análisis de incidencias

- `analyze.py` valida y resume archivos CSV de tickets sin devolver direcciones de email de clientes.
- `incidents-nexova.csv` es el dataset de aceptación de 100 registros proporcionado.
- Ejecuta `python scripts/analyze.py info-nexova/incidents-nexova.csv`.
- Usa `--no-export` para omitir la pregunta de exportación o `--export output.csv` para guardar solo métricas agregadas.
- Ejecuta `python -m unittest discover -s scripts -p "test_*.py"` para verificar validación y recuentos esperados.
