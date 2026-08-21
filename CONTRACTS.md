# Contrats — mcp-lever

Ce document fige les signatures et les formes de sortie. Il se lit seul : les
tests s'écrivent contre lui, sans ouvrir un seul module de `src/`.

Il se lit avec `SCHEMA.md`, qui décrit ce que Lever rend, et `PLAN.md`, qui
porte les règles de rendu numérotées.

## Le vocabulaire commun

```ts
interface Read<T> {
  data: T;
  cached: boolean;
  skipped?: string[];
}

type Instance = "global" | "eu";

type ErrorCode =
  "not_found" | "invalid_input" | "rate_limited" | "parse_failure" | "network_error" | "timeout";

class LeverError extends Error {
  readonly code: ErrorCode;
  readonly allowedValues?: string[];
}
```

Une panne n'est jamais rendue comme un résultat vide. Un 404 donne `not_found`,
un 429 donne `rate_limited`, une charge illisible donne `parse_failure`, une
coupure donne `network_error`, un dépassement donne `timeout`, et un argument
refusé chez nous donne `invalid_input`.

## La couche basse

Aucun de ces modules n'importe le SDK MCP.

### `src/lever/hosts.ts`

```ts
/** Refuse toute adresse dont l'hôte n'est pas dans ALLOWED_HOSTS. */
function assertAllowedUrl(url: string): void;

/** Vrai pour api.lever.co et api.eu.lever.co, faux pour tout le reste. */
function isAllowedHost(url: string): boolean;
```

`assertAllowedUrl` lève `LeverError("invalid_input")` **avant** toute
connexion. `https://jobs.lever.co/...` est refusé, y compris en majuscules dans
l'hôte, y compris avec un port, y compris en sous-domaine trompeur du genre
`api.lever.co.attacker.test`.

### `src/lever/rateLimiter.ts`

```ts
class RateLimiter {
  constructor(minIntervalMs: number);
  /** Sérialise les appels et respecte l'intervalle plancher entre deux départs. */
  schedule<T>(task: () => Promise<T>): Promise<T>;
}
```

Une requête à la fois. L'intervalle configuré ne descend jamais sous
`MIN_INTERVAL_MS`, qui vaut 1000.

### `src/lever/http.ts`

```ts
interface HttpOptions {
  timeoutMs: number;
  userAgent: string;
  fetchImpl: typeof fetch;
}

/** Passe par assertAllowedUrl, puis par le limiteur, puis traduit les erreurs. */
function getJson<T>(url: string, options: HttpOptions): Promise<T>;
```

Traduction : 404 → `not_found`, 429 → `rate_limited`, 5xx et coupure →
`network_error`, JSON invalide → `parse_failure`, abandon → `timeout`.

### `src/lever/postings.ts`

```ts
interface ListParams {
  slug: string;
  instance: Instance;
  limit?: number; // défaut 25, plafond 100
  skip?: number;
  location?: string[];
  team?: string[];
  department?: string[];
  commitment?: string[];
}

/** null quand le site est inconnu sur cette instance ; [] quand il ne publie rien. */
function listPostings(p: ListParams, c: Client): Promise<Read<RawPosting[] | null>>;

function getPosting(
  slug: string,
  id: string,
  instance: Instance,
  c: Client,
): Promise<Read<RawPosting>>;

function listGroups(
  slug: string,
  instance: Instance,
  group: "team" | "location" | "commitment",
  c: Client,
): Promise<Read<RawGroup[]>>;
```

`listPostings` rend `null` sur 404 et `[]` sur une liste vide, et ces deux
valeurs ne se confondent jamais.

### `src/lever/resolve.ts`

```ts
/** Les formes essayées, dans l'ordre, sans requête. */
function slugForms(name: string): string[];

/** Sonde chaque forme sur chaque instance, s'arrête à la première confirmée
 *  par instance, et rend toutes les instances qui ont répondu. */
function resolveCompany(name: string, c: Client): Promise<Resolution>;
```

`slugForms("Basis Technologies")` rend, dans cet ordre et sans doublon :
`["basistechnologies", "Basistechnologies", "basis", "basis-technologies"]`.

Règles de `slugForms` :

1. minuscules, espaces et ponctuation retirés ;
2. la même, première lettre en capitale ;
3. le premier mot seul, en minuscules ;
4. les mots joints par un tiret, en minuscules.

Les doublons se suppriment en gardant le premier rang. Un nom d'un seul mot rend
donc moins de quatre formes. Un nom qui **est déjà un identifiant exact**, sans
espace ni ponctuation, se présente tel quel en première position, sa casse conservée, ce qui fait que `Flex` est essayé avant `flex`.

Chaque entrée de `tried` s'écrit `forme (instance)`, par exemple
`miteksystems (global)`. Une entrée par requête réellement partie : le contrat
de ce champ est de montrer le coût, et quatre formes sondées sur deux instances
coûtent huit requêtes.

`resolveCompany` s'arrête dès qu'une forme répond sur une instance, et continue
sur l'autre instance : un site vivant des deux côtés rend deux entrées dans
`found`. Un site qui répond `200 []` rend `publishes: false`.

### `src/lever/cache.ts`

```ts
class Cache<T> {
  constructor(ttlMs: number, maxEntries: number);
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}
```

Expiration par durée, éviction du plus ancien au-delà de `maxEntries`.

### `src/lever/client.ts`

```ts
class Client {
  constructor(options?: ClientOptions);
  resolveCompany(name: string): Promise<Resolution>;
  listPostings(p: ListParams): Promise<Read<RawPosting[] | null>>;
  getPosting(slug: string, id: string, instance: Instance): Promise<Read<RawPosting>>;
  listGroups(slug: string, instance: Instance, group: GroupKey): Promise<Read<RawGroup[]>>;
}
```

C'est le point d'entrée publié sous `./client`. Il porte le rythme, le cache et
la taxonomie d'erreurs, sans protocole attaché.

## Le rendu

### `src/tools/render.ts`

```ts
function toRow(p: RawPosting, slug: string, instance: Instance): JobRow;
function toRecord(p: RawPosting, slug: string, instance: Instance): JobRecord;
function decodeEntities(html: string): string;
function listItems(content: string): string[];
```

`toRow` applique les règles de rendu 1 à 12 de `PLAN.md`. En particulier :

- `salary` vaut `null` quand `salaryRange` est absent, jamais `0` ;
- `interval` traverse tel quel, sans annualisation ;
- `country: null` traverse tel quel ;
- `commitment` et `department` absents de `categories` sont absents de la ligne ;
- `posted_at` convertit `createdAt` en ISO 8601 UTC.

`toRecord` ajoute `description`, tirée de `descriptionPlain` et **jamais** de
`openingPlain`, plus `sections` construites depuis `lists` en déséchappant les
entités HTML.

## Les quatre outils

Enregistrés dans cet ordre. Chacun déclare un `outputSchema`, et
`additionalProperties: false` est appliqué à l'exécution sur les arguments.

### 1. `resolve_company`

Arguments : `{ names: string[] }`, un à 25.

Une liste plutôt qu'un nom : sonder dix entreprises coûte dix résolutions, là où
`search_jobs` lirait dix pages carrières entières pour la même question.

```jsonc
{
  "type": "object",
  "required": ["resolved", "notes"],
  "additionalProperties": false,
  "properties": {
    "resolved": { "type": "array", "items": { "$ref": "#/$defs/Resolved" } },
    "notes": { "type": "array", "items": { "type": "string" } },
  },
  "$defs": {
    "Resolved": {
      "type": "object",
      "required": ["input", "found", "tried", "cached"],
      "additionalProperties": false,
      "properties": {
        "input": { "type": "string" },
        "cached": { "type": "boolean" },
        "found": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["slug", "instance", "publishes"],
            "additionalProperties": false,
            "properties": {
              "slug": { "type": "string" },
              "instance": { "enum": ["global", "eu"] },
              "publishes": { "type": "boolean" },
            },
          },
        },
        "tried": { "type": "array", "items": { "type": "string" } },
      },
    },
  },
}
```

`found` vide **n'est pas** une absence prouvée, et `notes` porte alors la phrase
qui le dit, en nommant la sensibilité à la casse.

### 2. `search_jobs`

Arguments :

| Nom                                            | Type     | Contrainte                              |
| ---------------------------------------------- | -------- | --------------------------------------- |
| `companies`                                    | string[] | requis, 1 à 25, défaut de traitement 10 |
| `keyword`                                      | string   | chez nous                               |
| `location`, `team`, `department`, `commitment` | string[] | chez Lever, valeur exacte               |
| `workplace_type`                               | string[] | chez nous                               |
| `country`                                      | string[] | chez nous, ISO alpha-2                  |
| `salary_min`                                   | number   | chez nous, ≥ 0                          |
| `salary_interval`                              | string   | chez nous, défaut `per-year-salary`     |
| `currency`                                     | string   | chez nous, ISO 4217                     |

`salary_interval` existe parce qu'un seuil nu n'a pas de période. Lever publie
des montants annuels et des taux horaires, et comparer 60 000 à 63,09 est une
erreur de catégorie. Le seuil se lit donc dans la période nommée, et toute offre
publiée dans une autre période est écartée et comptée.
| `posted_within_days` | integer | chez nous, ≥ 1 |
| `limit` | integer | 1 à 100, défaut 25 |
| `skip` | integer | ≥ 0 |

```jsonc
{
  "type": "object",
  "required": ["jobs", "per_company", "total_available", "notes"],
  "additionalProperties": false,
  "properties": {
    "jobs": { "type": "array", "items": { "$ref": "#/$defs/JobRow" } },
    "per_company": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["input", "slug", "instance", "status", "returned"],
        "additionalProperties": false,
        "properties": {
          "input": { "type": "string" },
          "slug": { "type": ["string", "null"] },
          "instance": { "enum": ["global", "eu", null] },
          "status": { "enum": ["read", "unresolved", "empty", "failed"] },
          "returned": { "type": "integer" },
          "error": { "type": "string" },
        },
      },
    },
    "total_available": { "type": "null" },
    "notes": { "type": "array", "items": { "type": "string" } },
  },
}
```

`total_available` vaut `null` : Lever ne publie aucun compteur.

### 3. `get_job`

Arguments : `{ company_slug: string, job_id: string, instance?: "global" | "eu" }`.

Sortie : `{ job: JobRecord, notes: string[] }`. La fiche vit sous `job` parce que
`JobRecord` se ferme sur `additionalProperties: false` et que les notes sont
normatives : un salaire non publié, un pays inconnu et une annonce sans texte se
disent, et ils se disent à côté de la fiche plutôt que dedans.

### 4. `list_filter_values`

Arguments : `{ company_slug: string, instance?: Instance, fields?: ("team" | "location" | "commitment")[] }`.

```jsonc
{
  "type": "object",
  "required": ["company_slug", "instance", "fields", "notes"],
  "additionalProperties": false,
  "properties": {
    "company_slug": { "type": "string" },
    "instance": { "enum": ["global", "eu"] },
    "fields": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "team": { "$ref": "#/$defs/FilterValues" },
        "location": { "$ref": "#/$defs/FilterValues" },
        "commitment": { "$ref": "#/$defs/FilterValues" },
      },
    },
    "notes": { "type": "array", "items": { "type": "string" } },
  },
  "$defs": {
    "FilterValues": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["value", "count"],
        "additionalProperties": false,
        "properties": { "value": { "type": "string" }, "count": { "type": "integer" } },
      },
    },
  },
}
```

## Les formes rendues

### `JobRow`

```jsonc
{
  "type": "object",
  "required": [
    "id",
    "title",
    "company_slug",
    "instance",
    "location",
    "all_locations",
    "country",
    "workplace_type",
    "team",
    "salary",
    "posted_at",
    "url",
    "apply_url",
  ],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },
    "company_slug": { "type": "string" },
    "instance": { "enum": ["global", "eu"] },
    "location": { "type": "string" },
    "all_locations": { "type": "array", "items": { "type": "string" } },
    "country": { "type": ["string", "null"] },
    "workplace_type": { "type": "string" },
    "commitment": { "type": "string" },
    "team": { "type": "string" },
    "department": { "type": "string" },
    "salary": { "$ref": "#/$defs/Salary" },
    "posted_at": { "type": "string", "format": "date-time" },
    "url": { "type": "string" },
    "apply_url": { "type": "string" },
  },
  "$defs": {
    "Salary": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "required": ["min", "max", "currency", "interval"],
          "additionalProperties": false,
          "properties": {
            "min": { "type": "number" },
            "max": { "type": "number" },
            "currency": { "type": "string" },
            "interval": { "type": "string" },
          },
        },
      ],
    },
  },
}
```

`workplace_type` reste une chaîne libre : trois valeurs observées ne font pas une
énumération close, et la documentation en annonce une quatrième absente du
corpus.

### `JobRecord`

Tous les champs de `JobRow`, plus :

```jsonc
{
  "description": { "type": "string" },
  "sections": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["heading", "items"],
      "additionalProperties": false,
      "properties": {
        "heading": { "type": "string" },
        "items": { "type": "array", "items": { "type": "string" } },
      },
    },
  },
  "salary_note": { "type": ["string", "null"] },
  "source": {
    "type": "object",
    "required": ["site", "retrieved_from"],
    "additionalProperties": false,
    "properties": {
      "site": { "const": "Lever" },
      "retrieved_from": { "type": "string" },
    },
  },
}
```

## Les notes que le serveur écrit

Elles sont normatives, et un test vérifie qu'elles paraissent au bon moment.

**Tout texte destiné à un appelant s'écrit en anglais** : descriptions d'outils,
instructions du serveur, notes et messages d'erreur. Le français reste la langue
de ces documents de travail et de la moitié française du README.

| Quand                                 | Ce que la note dit                                                      |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `found` vide                          | ce résultat ne prouve pas une absence, l'identifiant distingue la casse |
| un site rendu par les deux instances  | les deux répondent, aucune n'est élue                                   |
| `salary_min` employé                  | combien d'offres ont été écartées faute de salaire publié               |
| `salary_min` face à une autre période | combien d'offres ont été écartées parce que leur période diffère        |
| `posted_within_days` employé          | combien d'offres lues ont été écartées                                  |
| une valeur de filtre refusée          | la valeur écartée, et l'invitation à lire `list_filter_values`          |
| une entreprise en panne               | laquelle, et que la liste ne couvre donc pas tout                       |
| plus de 10 entreprises demandées      | que chaque entreprise coûte une seconde                                 |

Le texte venu du site ne doit pas pouvoir imiter une note : les préfixes `Note:`
et `Source:` se décalent dans tout texte tiers rendu.
