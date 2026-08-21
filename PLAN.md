# Plan d'implémentation — mcp-lever

Serveur MCP en lecture seule sur l'API publique des annonces de Lever, sans clé
et sans compte.

Ce plan se lit seul. Ce qui l'a établi vit à côté : `FEASIBILITY.md` porte
l'étude du site, `DESIGN-DRAFT.md` porte les outils et la forme rendue, et
`SCHEMA.md` porte le schéma déduit du corpus.

## Ce qui est acquis avant d'écrire une ligne

- **Les conditions n'interdisent rien.** Les conditions de service visent
  l'employeur sous contrat et ne mentionnent ni extraction, ni moissonnage, ni
  accès automatisé. La documentation de l'API écrit que les annonces publiées
  « may be scraped by third parties ».
- **`api.lever.co` et `api.eu.lever.co` portent `Allow: /` et `Crawl-delay: 1`**,
  sans nommer aucun agent.
- **`jobs.lever.co` refuse six agents nommés**, dont `ClaudeBot`. Le serveur ne
  lit jamais cet hôte.
- **Aucun serveur MCP n'existe sur Lever**, ni au registre officiel, ni sur npm.
- **`mcp-lever` est libre** sur npm et sur GitHub.

## Architecture

La couture habituelle, la couche basse publiée seule sous `./client` :

```
src/index.ts          exécutable, transport stdio
src/server.ts         enregistrement ordonné des quatre outils
src/tools/*.ts        arguments, rendu, notes          ← importe le SDK MCP
─────────────────────────────────────────────────────  la couture
src/lever/*.ts        http, rythme, cache, analyse     ← n'importe jamais le SDK
```

Modules de la couche basse :

| Fichier         | Rôle                                                               |
| --------------- | ------------------------------------------------------------------ |
| `config.ts`     | hôtes autorisés, intervalle minimal, plafonds, `User-Agent`        |
| `hosts.ts`      | la liste blanche, et le refus de toute autre adresse               |
| `http.ts`       | une requête à la fois, intervalle plancher, traduction des erreurs |
| `postings.ts`   | construction de la requête, lecture de la charge, `Read<T>`        |
| `resolve.ts`    | nom d'entreprise → identifiant de site, par l'échelle de variantes |
| `vocabulary.ts` | le vocabulaire d'un site, lu par `group=`                          |
| `errors.ts`     | les six codes, et rien de plus                                     |

`Read<T> = { data, cached, skipped? }`. Six codes d'erreur : `not_found`,
`invalid_input`, `rate_limited`, `parse_failure`, `network_error`, `timeout`.

## Le rythme et les hôtes

`Crawl-delay: 1` est publié sur les deux instances, donc **une seconde entre
deux requêtes**, une requête à la fois, plancher que la configuration peut
élargir et jamais réduire, y compris par le point d'entrée `client`.

La liste blanche d'hôtes vaut `api.lever.co` et `api.eu.lever.co`. Toute autre
adresse lève `invalid_input` avant l'ouverture de la connexion. Les champs
`hostedUrl` et `applyUrl` pointent vers `jobs.lever.co` : ils traversent le rendu
comme des chaînes et n'atteignent jamais le client HTTP.

Le `User-Agent` porte le nom du projet et une adresse de contact, et n'imite
aucun navigateur.

## Les quatre outils

Enregistrés dans cet ordre, qui est celui du rendu. Leur forme détaillée vit
dans `DESIGN-DRAFT.md`.

| Outil                | Requêtes réseau                                 |
| -------------------- | ----------------------------------------------- |
| `resolve_company`    | une par variante et par instance, deux au mieux |
| `search_jobs`        | la résolution, puis une par entreprise          |
| `get_job`            | une                                             |
| `list_filter_values` | une par regroupement demandé                    |

**La résolution est le poste de dépense du serveur**, et son arithmétique se
regarde en face. Quatre formes essayées sur deux instances font huit requêtes,
donc huit secondes, pour une entreprise dont le nom résiste. Une entreprise dont
le nom se devine du premier coup en coûte deux, puisque la seconde instance se
sonde toujours pour détecter les identifiants qui vivent des deux côtés.

Trois choses la contiennent :

- **Un cache de résolution**, tenu pour la session. Une entreprise résolue une
  fois ne se résout plus.
- **Un chemin court** : un `companies` dont l'élément est déjà un identifiant
  exact coûte une confirmation par instance, sans échelle.
- **Un plafond de formes** réglé dans `config.ts`, puisque chaque forme coûte une
  requête et une seconde.

L'ordre des formes suit ce que le corpus a montré : minuscules collées, capitale
initiale, premier mot seul, forme à tiret.

**`search_jobs` accepte 10 entreprises par défaut et 25 au maximum**, réglé dans
`config.ts`. À une seconde par entreprise, 25 entreprises coûtent 25 secondes, et
c'est la limite de ce qu'un appel d'outil peut promettre.

`limit` vaut 25 par défaut et 100 au maximum. Une requête sans `limit` a rendu
48 Mo sur le plus gros site observé, donc le serveur l'impose toujours.

## Les règles de rendu

Établies sur 450 offres de 8 sites, et elles gouvernent les tests.

1. **`salary` absent se rend `null`**, jamais zéro. 304 offres sur 450 n'en
   publient aucun.
2. **`interval` se rend tel que Lever l'écrit**, sans conversion ni
   annualisation. Un taux horaire comparé à un seuil annuel est une erreur de
   catégorie, et le filtre ne compare qu'à période égale.
3. **`min` égal à `max` se rend tel quel.** Cinq offres portent un montant
   unique.
4. **`country: null` se rend `null`**, et vaut « pays inconnu ». Deux offres sur 450.
5. **`all_locations` se rend en tableau**, jamais recollé, et `location` reste le
   lieu principal que Lever désigne. 25 offres en portent plusieurs, jusqu'à
   neuf.
6. **La description vient de `descriptionPlain`.** `openingPlain` est vide sur
   258 offres sur 450, et bâtir la fiche dessus rendrait une description vide
   une fois sur deux.
7. **`commitment` et `department` peuvent manquer** de `categories`, et leur
   absence se rend absente.
8. **Une valeur de filtre inconnue rend `200 []` sans erreur.** Le serveur
   vérifie la valeur contre le vocabulaire du site et rend `invalid_input` avec
   les valeurs permises, plutôt qu'une absence fabriquée.
9. **Les entités HTML se déséchappent** dans le texte des rubriques.
10. **`posted_at` se convertit en ISO 8601 UTC** depuis les millisecondes de
    `createdAt`.
11. **Un site non résolu se dit non résolu**, avec les formes essayées, et jamais
    comme une entreprise sans offre. Un 404 ne prouve rien : `flex` répond 404 et
    `Flex` rend 35 offres.
12. **`total_available` vaut `null`.** Lever ne publie aucun compteur.
13. Le texte venu du site ne doit pas pouvoir imiter une ligne que le serveur
    écrit : les préfixes `Note:` et `Source:` se décalent, et la charge
    structurée garde le texte tel qu'il a été publié.

## Ce que le serveur n'expose pas

- Une recherche sans entreprise nommée. Aucun index ne traverse les clientes de
  Lever, et l'éditeur n'en publie aucune liste. L'appelant nomme les entreprises,
  et le serveur transforme ces noms en identifiants.
- Un annuaire d'entreprises. Le serveur n'en embarque aucun : une liste figée
  vieillit d'un tiers par an, et un appelant la prendrait pour l'ensemble des
  clientes de Lever.
- Le filtre `level`. Lever l'accepte, et le champ n'apparaît sur aucune des 450
  offres du corpus : le serveur ne peut ni le valider ni le rendre.
- Un tri par salaire. 146 offres sur 450 en publient un, avec deux périodes
  différentes.
- Une candidature. Une route `POST` existe et ces serveurs n'écrivent nulle part.

## L'ordre du travail

C'est la partie qui gouverne, et elle ne se réordonne pas.

### 1. Les contrats, avant tout code et avant tout test

Trois documents figés d'abord, puisque les tests s'écrivent contre eux :

- **`SCHEMA.md`** : ce que Lever rend, mesuré sur les 450 offres. Champs,
  présence, formes d'absence, vocabulaires ouverts et fermés.
- **Les schémas de sortie** : un `outputSchema` par outil, en JSON Schema, y
  compris les unions là où la forme dépend d'une branche.
- **Les interfaces de la couche basse** : signatures de `postings.ts`,
  `resolve.ts`, `registry.ts`, `vocabulary.ts`, la forme de `Read<T>` et celle
  des six erreurs.

### 2. Les tests, écrits contre ces contrats

L'agent qui écrit les tests travaille depuis `PLAN.md`, `SCHEMA.md` et les
schémas, **ne lit aucun module de `src/`**, ne modifie rien sous `src/`, et
laisse un test rouge documenté plutôt que de l'affaiblir.

Fixtures **engendrées**, jamais capturées : `scripts/build-fixtures.mjs` écrit un
corpus d'offres inventées portant les formes observées, dont les cas rares. Le
corpus réel sert à écrire les assertions, jamais à être livré.

Cas à couvrir :

- une offre sans `salaryRange` rend `salary: null`, jamais `0` ;
- `min` égal à `max` traverse le rendu sans devenir une fourchette ;
- un taux horaire ne se compare pas à un seuil annuel, et la note le dit ;
- `country: null` traverse le rendu sans devenir une chaîne ;
- `allLocations` à neuf éléments reste un tableau de neuf ;
- une offre dont `openingPlain` est vide rend quand même une description ;
- `commitment` ou `department` absent de `categories` se rend absent ;
- une valeur de filtre inconnue rend `invalid_input` avec les valeurs du site,
  sans repli silencieux ;
- `flex` en 404 et `Flex` en 200 : la note dit que la casse compte et qu'une
  absence n'est pas prouvée ;
- l'échelle de variantes s'arrête à la première forme confirmée, sans essayer les
  suivantes ;
- une entreprise déjà résolue dans la session ne déclenche aucune requête ;
- un `companies` portant un identifiant exact évite l'échelle ;
- un site présent sur les deux instances rend les deux, sans en élire une ;
- un nom qu'aucune forme ne résout rend les formes essayées et la note qui dit
  que ce résultat ne prouve pas une absence ;
- `search_jobs` à 26 entreprises est refusé chez nous avant tout appel ;
- `limit` au-delà de 100 est refusé chez nous ;
- `per_company` distingue lue, non résolue et en panne ;
- deux appels rapprochés respectent la seconde, horloge simulée par
  `vi.useFakeTimers` ;
- une charge illisible donne `parse_failure`, une coupure `network_error`, un
  429 `rate_limited`, et aucun des trois ne donne une liste vide ;
- un argument inconnu est refusé à l'exécution, comme le déclare
  `additionalProperties: false` ;
- chaque outil déclare un `outputSchema`, et la sortie le respecte.

**Les tests de la liste blanche**, qui sont la demande explicite :

- toute adresse hors `api.lever.co` et `api.eu.lever.co` lève avant la connexion ;
- un espion sur la couche HTTP vérifie que **chaque** adresse demandée pendant
  toute la suite porte un hôte de la liste ;
- `hostedUrl` et `applyUrl` traversent le rendu et n'atteignent jamais le client
  HTTP ;
- le `User-Agent` porte le nom du projet et n'imite aucun navigateur.

Tests déterministes, aucune mesure d'horloge réelle, aucune tolérance. La porte
est **cinq passes consécutives identiques**, ce serveur étant neuf. Le `pretest`
construit, faute de quoi un dépôt fraîchement cloné échoue.

Une suite en direct derrière une variable d'environnement, une requête par
route, en canari nocturne à une heure qu'aucun voisin n'occupe. **Le canari relit
les `robots.txt`** des hôtes lus et échoue si une règle nouvelle vise notre
agent, `ClaudeBot`, ou `/v0/postings/`.

### 3. Le code, sous les tests

`src/lever/` d'abord, puis `src/tools/`, puis `server.ts`.

### 4. Les tests tournent, et on vérifie

Cinq passes identiques, et le typage sans erreur.

### 5. La revue, par agents indépendants

Un agent par angle, et aucun ne relit ce qu'il a écrit : intégrité des données,
résilience, contrat d'outils et économie de tokens, prose autonome, tics de
langage, contaminations croisées, sécurité. Puis huit personas au moins, avec de
vraies questions, dont des questions mal posées : vagues, mal orthographiées,
dans la mauvaise langue, ou supposant un filtre absent. Un chercheur d'emploi
qui demande « du remote à plus de 60k » doit apprendre que le salaire filtre sur
ce qui est publié, et qu'il faut nommer des entreprises.

## La pile

TypeScript, `@modelcontextprotocol/sdk` ^1.30, zod 4 via
`src/tools/arguments.ts`, vitest 4, tsup, prettier. Deux configurations tsup, une
pour npm avec les dépendances externes, une pour le bundle `.mcpb` qui les
compile dedans.

Le serveur parle la révision à handshake tant que le SDK ne livre pas
`2026-07-28`. Le jour où il livrera : `server/discover` devient obligatoire, et
`ttlMs` / `cacheScope` deviennent requis sur les résultats de `tools/list`.

## L'écriture

Tout texte se lit seul, sans connaissance d'une version précédente. Aucune
référence à un autre serveur du dossier, ni dans le code, ni dans les
commentaires, ni dans les descriptions, ni dans le README. On nomme Lever,
puisque c'est le site que le serveur lit.

## La publication

Dans cet ordre, une seule version à la fois : npm à la main pour la première
publication, puis le tag qui déclenche le bundle `.mcpb`, la release GitHub et
l'entrée au registre officiel, dont la description est plafonnée à 100
caractères et dont l'URL de bundle se calcule au moment de publier. Ensuite
Glama, `Build` seul puis `Make Release` avec le vrai numéro. Enfin les annuaires
tiers.

Ce que le dépôt porte : README bilingue anglais puis français, LICENSE MIT,
CHANGELOG, CONTRIBUTING, SECURITY, RELEASING, LAUNCHGUIDE, `server.json`,
`glama.json`, `packaging/manifest.json`, Dockerfile, quatre workflows, FUNDING,
et deux icônes à 128 et 512.

## Ce qui reste ouvert, et se traite par du code générique

Deux comportements ne se mesurent pas poliment, et le code les traite sans les
avoir vus :

- **Les réponses en 429 et en 5xx.** Elles ne se provoquent pas sur un site
  gratuit. Un 429 donne `rate_limited`, un 5xx `network_error`, et aucun des
  deux ne donne une liste vide.
- **L'instance européenne au-delà du site de démonstration.** Aucune cliente
  européenne n'a été identifiée. Le code la traite comme la globale, et la suite
  en direct la sonde.
