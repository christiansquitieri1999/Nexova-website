# Contexto de Nexova — Hito 2: Fundamentos de Programación

**Empresa:** Nexova — Consultoría de Recursos Humanos y Adquisición de Talento  
**Rol:** Ingeniero/a de IA Junior, equipo de Nexova AI  
**Responsable del proyecto:** Javier Almeida, Gerente de Operaciones

---

## Acerca de Nexova

Nexova es una firma de consultoría de recursos humanos y adquisición de talento con sede en Valencia, España, y operaciones de expansión en Miami, Florida. La empresa opera tres líneas de negocio: headhunting ejecutivo, outsourcing de equipos de soporte al cliente para empresas tecnológicas y formación corporativa. Formas parte del equipo de Ingeniería de IA, creado recientemente para modernizar las operaciones de Nexova.

## Asignación

Javier Almeida necesita la lógica central de procesamiento de datos para el sistema de gestión de candidatos. Los 40 consultores de selección procesan actualmente de forma manual los CV, la puntuación de candidatos, el matching con vacantes y el seguimiento de las etapas del proceso.

Este hito consiste en construir funciones TypeScript sólidas y bien tipadas que manejen lógica de negocio real. No se utiliza IA ni prompting.

## Alcance

Implementar utilidades TypeScript para:

1. Modelar candidatos y vacantes mediante interfaces.
2. Filtrar y buscar candidatos por habilidades, experiencia y disponibilidad.
3. Puntuar candidatos frente a los requisitos de una vacante.
4. Rankear candidatos para una posición.
5. Generar reportes de selección con métricas agregadas.
6. Validar datos antes de procesarlos.

---

## Entidades de negocio

### Candidate

```ts
interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  yearsOfExperience: number;
  skills: string[];
  englishLevel: EnglishLevel;
  seniority: SeniorityLevel;
  currentSalary: number;
  expectedSalary: number;
  availability: AvailabilityStatus;
  location: string;
  remoteOnly: boolean;
  status: CandidateStatus;
}

type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Native";
type SeniorityLevel =
  | "Junior"
  | "Semi-Senior"
  | "Senior"
  | "Lead"
  | "Executive";
type AvailabilityStatus = "Immediate" | "2 weeks" | "1 month" | "Not available";
type CandidateStatus = "Active" | "In process" | "Hired" | "Inactive";
```

**Reglas de validación:**

- `yearsOfExperience` debe estar entre 0 y 50, ambos inclusive.
- `currentSalary` y `expectedSalary` deben ser mayores que 0.
- `skills` debe contener al menos una habilidad.
- `email` debe tener un formato básico válido (contener `@` y `.` en posiciones correctas).
- `phone` no debe estar vacío.

### Vacancy

```ts
interface Vacancy {
  id: string;
  title: string;
  companyName: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minYearsExperience: number;
  maxYearsExperience: number;
  requiredEnglishLevel: EnglishLevel;
  requiredSeniority: SeniorityLevel;
  salaryRangeMin: number;
  salaryRangeMax: number;
  isRemote: boolean;
  location: string;
  status: VacancyStatus;
}

type VacancyStatus = "Open" | "In progress" | "Closed" | "On hold";
```

**Reglas de validación:**

- `requiredSkills` debe contener al menos una habilidad.
- `minYearsExperience` debe ser mayor o igual que 0.
- `maxYearsExperience` debe ser mayor o igual que `minYearsExperience`.
- `salaryRangeMin` y `salaryRangeMax` deben ser mayores que 0.
- `salaryRangeMax` debe ser mayor o igual que `salaryRangeMin`.

### SelectionProcess

```ts
interface SelectionProcess {
  id: string;
  candidateId: string;
  vacancyId: string;
  stage: ProcessStage;
  score: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

type ProcessStage =
  | "Screening"
  | "Interview"
  | "Technical test"
  | "Final interview"
  | "Offer"
  | "Rejected"
  | "Hired";
```

---

## Funciones requeridas

Implementa las funciones en los archivos indicados. Mantén las funciones puras: deben trabajar con sus parámetros y no depender de variables globales.

### Operaciones de colecciones — `src/utils/collections.ts`

- `filterCandidatesBySkills(candidates: Candidate[], requiredSkills: string[]): Candidate[]`: devuelve candidatos que tengan **todas** las habilidades requeridas. La comparación no distingue mayúsculas y minúsculas.
- `filterCandidatesBySeniority(candidates: Candidate[], seniority: SeniorityLevel): Candidate[]`: devuelve candidatos con el nivel de seniority indicado.
- `filterCandidatesByAvailability(candidates: Candidate[], availability: AvailabilityStatus[]): Candidate[]`: devuelve candidatos cuya disponibilidad coincida con cualquiera de los estados indicados.
- `sortCandidatesBySalary(candidates: Candidate[], order: "asc" | "desc"): Candidate[]`: ordena por salario esperado, ascendente o descendente, sin mutar el array original.
- `sortCandidatesByExperience(candidates: Candidate[], order: "asc" | "desc"): Candidate[]`: ordena por años de experiencia, ascendente o descendente, sin mutar el array original.

### Operaciones de búsqueda — `src/utils/search.ts`

- `findCandidateById(candidates: Candidate[], id: string): Candidate | null`: búsqueda lineal por ID; devuelve el candidato o `null`.
- `findCandidateByEmail(candidates: Candidate[], email: string): Candidate | null`: búsqueda lineal por email con comparación case-insensitive; devuelve el candidato o `null`.
- `binarySearchCandidateBySalary(sortedCandidates: Candidate[], targetSalary: number): number`: búsqueda binaria sobre un array ya ordenado por salario esperado ascendente; devuelve el índice encontrado o `-1`. Si hay salarios repetidos, puede devolver cualquier índice válido.

### Scoring, matching y agrupación — `src/utils/transformations.ts`

#### `calculateCandidateScore(candidate: Candidate, vacancy: Vacancy): number`

Calcula una puntuación de match entre 0 y 100 con estos componentes:

- **Habilidades (máximo 40 puntos):** 40 puntos si tiene todas las habilidades requeridas; si no, 20 puntos si tiene al menos el 50% de las requeridas; suma 10 puntos por cada habilidad preferida que tenga, hasta 20 puntos.
- **Experiencia (máximo 20 puntos):** 20 puntos si está dentro del rango de la vacante; 10 puntos si queda a 1 o 2 años fuera del rango; 0 puntos si queda a más de 2 años.
- **Seniority (máximo 15 puntos):** 15 puntos por coincidencia exacta; 7 puntos si está un nivel por encima o por debajo; 0 en cualquier otro caso.
- **Inglés (máximo 15 puntos):** 15 puntos si alcanza o supera el nivel requerido; 0 en caso contrario.
- **Salario (máximo 10 puntos):** 10 puntos si el salario esperado está dentro del rango; 5 puntos si supera el máximo hasta en un 20%; 0 puntos si lo supera por más del 20%.

#### Otras funciones de scoring y agrupación

- `rankCandidatesForVacancy(candidates: Candidate[], vacancy: Vacancy): Array<{ candidate: Candidate; score: number }>`: puntúa todos los candidatos y los devuelve en orden descendente de puntuación.
- `groupCandidatesBySeniority(candidates: Candidate[]): Record<SeniorityLevel, Candidate[]>`: agrupa los candidatos por nivel de seniority.

### Agregaciones y reportes — `src/utils/transformations.ts`

- `countCandidatesByStatus(candidates: Candidate[]): Record<CandidateStatus, number>`: devuelve el conteo de candidatos para cada estado.
- `calculateAverageSalary(candidates: Candidate[]): number`: calcula el promedio de `expectedSalary`, redondeado a 2 decimales.
- `findTopSkills(candidates: Candidate[], topN: number): Array<{ skill: string; count: number }>`: devuelve las `topN` habilidades más frecuentes, ordenadas de mayor a menor frecuencia, junto con el número de candidatos que tienen cada habilidad.
- `calculateVacancyFillRate(processes: SelectionProcess[]): number`: calcula el porcentaje de procesos cuya etapa es `Hired`; devuelve un valor entre 0 y 100, redondeado a 2 decimales.

### Validaciones — `src/utils/validations.ts`

- `validateCandidate(candidate: Candidate): { valid: boolean; errors: string[] }`: valida todas las reglas de negocio del candidato. `valid` es `true` solo si no hay errores.
- `validateVacancy(vacancy: Vacancy): { valid: boolean; errors: string[] }`: valida todas las reglas de negocio de la vacante. `valid` es `true` solo si no hay errores.
- `isValidEmail(email: string): boolean`: valida de forma básica que el email contenga `@` y `.` en posiciones correctas; no es una validación de nivel producción.

---

## Datos de ejemplo

### Candidatos

```ts
const sampleCandidates: Candidate[] = [
  {
    id: "C-2024-0451",
    fullName: "María González",
    email: "maria.gonzalez@email.com",
    phone: "+56912345678",
    yearsOfExperience: 5,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    englishLevel: "B2",
    seniority: "Semi-Senior",
    currentSalary: 3500,
    expectedSalary: 4200,
    availability: "1 month",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
  {
    id: "C-2024-0452",
    fullName: "Juan Pérez",
    email: "juan.perez@email.com",
    phone: "+56987654321",
    yearsOfExperience: 3,
    skills: ["JavaScript", "React", "CSS", "HTML"],
    englishLevel: "B1",
    seniority: "Junior",
    currentSalary: 2200,
    expectedSalary: 2800,
    availability: "Immediate",
    location: "Miami, Florida, Estados Unidos",
    remoteOnly: true,
    status: "Active",
  },
  {
    id: "C-2024-0453",
    fullName: "Carolina Silva",
    email: "carolina.silva@email.com",
    phone: "+56911223344",
    yearsOfExperience: 8,
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"],
    englishLevel: "C1",
    seniority: "Senior",
    currentSalary: 5500,
    expectedSalary: 6500,
    availability: "2 weeks",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
];
```

### Vacante

```ts
const sampleVacancy: Vacancy = {
  id: "V-2024-0892",
  title: "Senior Full-Stack Developer",
  companyName: "TechCorp Solutions",
  requiredSkills: ["TypeScript", "React", "Node.js"],
  preferredSkills: ["PostgreSQL", "Docker"],
  minYearsExperience: 4,
  maxYearsExperience: 8,
  requiredEnglishLevel: "B2",
  requiredSeniority: "Senior",
  salaryRangeMin: 5000,
  salaryRangeMax: 7000,
  isRemote: true,
  location: "Remote",
  status: "Open",
};
```

---

## Criterios de aceptación

La implementación se evaluará según:

1. **Seguridad de tipos:** interfaces bien definidas con tipos apropiados.
2. **Corrección:** cada función produce el resultado esperado para sus entradas.
3. **Casos límite:** manejo correcto de arrays vacíos, valores nulos y datos inválidos.
4. **Validación:** aplicación precisa de las reglas de negocio.
5. **Organización:** funciones ubicadas en los archivos indicados según su responsabilidad.
6. **Convenciones:** nombres de variables, funciones y tipos coherentes con TypeScript.
7. **Sin mutaciones:** operaciones de ordenamiento y filtrado no modifican los arrays originales.
8. **Pureza:** funciones sin dependencias en variables globales.

> “No necesito que sea perfecto. Necesito que funcione y sea mantenible. Los consultores usarán estas funciones a través de una interfaz que construiremos después; primero necesito saber que la lógica es sólida. Dame código limpio en el que pueda confiar y construiremos el resto encima.”
>
> — Javier Almeida, Gerente de Operaciones
