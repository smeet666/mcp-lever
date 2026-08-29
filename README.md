<img src="assets/icon-128.png" alt="" width="96" align="right">

# mcp-lever

[![npm](https://img.shields.io/npm/v/mcp-lever.svg)](https://www.npmjs.com/package/mcp-lever)
[![CI](https://github.com/smeet666/mcp-lever/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-lever/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-lever.svg)](./LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-lever)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-lever/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-lever)
[![M8ven](https://m8ven.ai/badge/mcp/smeet666-mcp-lever-ti7zmm?variant=verified)](https://m8ven.ai/mcp/smeet666-mcp-lever-ti7zmm)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=lever&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1sZXZlciJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=lever&config=%7B%22name%22%3A%22lever%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-lever%22%5D%7D)

<!-- m8ven-verify: 5faf86e7541e0167239ba83df2f3a7cc -->

[Lever](https://www.lever.co) is recruiting software that thousands of companies
use to run their hiring, and every customer gets a public job board that comes
with it. Each board carries that company's open positions with their title,
their location, the team and department they sit in, the commitment they ask for,
the full advert, and the salary range where the company chose to publish one.
Lever hosts one board per company, on either its global or its European instance,
and publishes no index across them.

This server connects a chat client to those boards. You name the companies you
are interested in, and it turns each name into the site name that addresses its
board, searches their openings, filters them by location, team, workplace type,
country, salary or how recently they were posted, reads one opening in full, and
lists the wordings each company filters by. It needs no API key and no account.

_[Version française](#mcp-lever-français)_

---

## Install

**One-click install**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=lever&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1sZXZlciJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=lever&config=%7B%22name%22%3A%22lever%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-lever%22%5D%7D)

**Claude Code**

```bash
claude mcp add lever -- npx -y mcp-lever
```

**Claude Desktop, Cursor, and any client using the standard config format**

```json
{
  "mcpServers": {
    "lever": {
      "command": "npx",
      "args": ["-y", "mcp-lever"]
    }
  }
}
```

Node 24 or later is required, and no environment variable has to be set.

### With Docker

```json
{
  "mcpServers": {
    "lever": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-lever:2.0.0"]
    }
  }
}
```

`-i` keeps stdin open, which is where the protocol travels, and `-t` is left out
because a TTY rewrites the stream. The container needs outbound HTTPS to
`api.lever.co` and `api.eu.lever.co`, and nothing else: no volume, no port, no
credential.

### Bundle, without npm

Download `mcp-lever-2.0.0.mcpb` from
[the latest release](https://github.com/smeet666/mcp-lever/releases/latest) and
open it. A client that supports MCP bundles installs it on its own, with no npm
and no configuration file to edit. The bundle carries its dependencies, so
nothing is fetched at install time.

## What you can ask

- "Which of Included Health, Netlify and Ramp are hiring on Lever?"
- "Find me remote engineering roles at those three companies."
- "Read me that opening in full."
- "What locations does Included Health list its jobs under?"
- "Anything posted in the last two weeks at Netlify?"

Every question starts from a company, since Lever offers no search across boards.
`search_jobs` resolves the names you give it, so no preparation is needed:

```
resolve_company(["Included Health"])  ->  includedhealth, global instance, publishing
search_jobs(["Included Health"], keyword: "therapist")
get_job("includedhealth", "6f97a19f-…")
```

## Tools

| Tool                 | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `resolve_company`    | Turns company names into the Lever site names of their boards. |
| `search_jobs`        | Searches the openings of the companies you name.               |
| `get_job`            | Reads one opening in full, advert included.                    |
| `list_filter_values` | Lists the wordings one company files its openings under.       |

A Lever site name distinguishes case, so `Flex` answers where `flex` returns
nothing. Four spellings are tried per name on each of the two instances, and the
answer lists what was sent, so nothing found is never proof that a company is
absent from Lever.

### `resolve_company`

Turns company names into Lever site names, reporting every instance that
answered. It takes a list.

| Argument | Type                     | Required | What it does                                         |
| -------- | ------------------------ | -------- | ---------------------------------------------------- |
| `names`  | array of 1 to 25 strings | yes      | Company names, or Lever site names you already know. |

**In return:** one entry per name, carrying `input`; `found`, a list of
`{ slug, instance, publishes }` where `publishes` is false for a site that exists
and lists nothing today; `tried`, the spellings sent in order; and `cached`, true
when this session had already resolved that name. A name answering on both
instances comes back with both, and neither is elected: pass the one you mean to
the other tools.

### `search_jobs`

Searches the openings of the companies named. Lever applies the filters it
supports on its own exact wording, and this server applies the rest to the
openings it read.

| Argument             | Type                              | Required | What it does                                                      |
| -------------------- | --------------------------------- | -------- | ----------------------------------------------------------------- |
| `companies`          | array of 1 to 25 strings          | yes      | Company names or Lever site names. Each is resolved here.         |
| `keyword`            | string                            | no       | Words to look for in the title and the advert.                    |
| `location`           | array of 1 to 20 strings          | no       | Locations, exactly as Lever writes them.                          |
| `team`               | array of 1 to 20 strings          | no       | Teams, exactly as Lever writes them.                              |
| `department`         | array of 1 to 20 strings          | no       | Departments, exactly as Lever writes them.                        |
| `commitment`         | array of 1 to 20 strings          | no       | Commitments, exactly as Lever writes them.                        |
| `workplace_type`     | array of 1 to 4 strings           | no       | `remote`, `hybrid`, `onsite` or `unspecified`.                    |
| `country`            | array of 1 to 20 two-letter codes | no       | Countries as ISO codes, as in `FR` or `US`.                       |
| `salary_min`         | number, 0 or more                 | no       | The lowest upper bound of a salary range to keep.                 |
| `salary_interval`    | string                            | no       | The period `salary_min` is written in, such as `per-year-salary`. |
| `currency`           | three-letter code                 | no       | The currency `salary_min` is written in, as in `EUR`.             |
| `posted_within_days` | integer, 1 to 3650                | no       | How recent an opening must be.                                    |
| `limit`              | integer, 1 to 100, default `25`   | no       | Openings to read per company.                                     |
| `skip`               | integer, 0 to 100000, default `0` | no       | Openings to step over per company.                                |

Lever itself applies `location`, `team`, `department` and `commitment`; this
server applies `keyword`, `workplace_type`, `country`, `salary_min`,
`salary_interval`, `currency` and `posted_within_days` to what it read.
`list_filter_values` publishes the wordings the first four take, and a wording
Lever does not know comes back as an empty list.

**In return:** `jobs`, each carrying `id` and `company_slug`, which `get_job`
takes, plus `title`, `location`, `all_locations`, `country`, `workplace_type`,
`team`, `posted_at`, `url` and `apply_url`. `commitment` and `department` are
absent when the company records neither. `salary` is `null` for an opening
published without one, which is never the same as zero, and it carries the
`interval` Lever wrote it in, never converted or annualised. `per_company` gives
one outcome per company, with a `status` of `read`, `unresolved`, `empty` or
`failed`, which are four different answers, and the `read` and `returned` counts
around the filters. `total_available` is always `null`: Lever publishes no result
count. The rows carry no advert text, since one company's board can run to
megabytes.

`limit` applies per company, and a company whose openings fill it may publish
more: the notes say when that happened, and that a count taken inside that window
measures the window. `posted_within_days` walks up to five pages per company,
and Lever pages by title, so an opening published yesterday can sit anywhere in a
board.

### `get_job`

Reads one opening in full: the advert, its named sections, and the salary as
published.

| Argument       | Type             | Required | What it does                                               |
| -------------- | ---------------- | -------- | ---------------------------------------------------------- |
| `company_slug` | string           | yes      | The Lever site name, as `resolve_company` returns it.      |
| `job_id`       | string           | yes      | The identifier of one opening, as a search returns it.     |
| `instance`     | `global` or `eu` | no       | The instance the row came from. The global one by default. |

**In return:** `job`, holding the fields a search row carries, plus
`description`, `sections` as `{ heading, items }`, `salary_note` for what the
company wrote beside the range, and `source` with the address it was retrieved
from.

### `list_filter_values`

Lists the team, location and commitment wordings one company uses. Read it before
filtering: Lever matches its own wording, and the vocabulary belongs to each
company, one writing `Full-time` where another writes `EE Full-Time`.

| Argument       | Type                                                | Required | What it does                                                                           |
| -------------- | --------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `company_slug` | string                                              | yes      | The Lever site name, as `resolve_company` returns it.                                  |
| `instance`     | `global` or `eu`                                    | no       | The instance this site lives on. The global one by default.                            |
| `fields`       | array of 1 to 3 of `team`, `location`, `commitment` | no       | Which vocabularies to read. Each costs one request, and all three are read by default. |

**In return:** `company_slug`, `instance`, and `fields` holding a list of
`{ value, count }` for each vocabulary asked for. A `count` is `null` where Lever
published no figure alongside the category.

## Configuration

Nothing has to be configured. The server reads no environment variable, and the
`mcpServers` block above is complete as written.

The pacing, the timeout and the cache are settings of the client layer, which
[As a library](#as-a-library) shows how to pass. The interval between two
requests can be widened there and never narrowed.

## Errors

Every failure carries one of six codes, a message, and where it helps the values
that would have been accepted.

| Code            | What happened                                           | What to do                                                                        |
| --------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `not_found`     | Lever answered, and holds no such site or opening.      | Check the site name with `resolve_company`.                                       |
| `invalid_input` | The arguments were refused before any request went out. | Read the message, which names the argument and what it takes.                     |
| `rate_limited`  | Lever asked this client to slow down.                   | Wait, then call again with the same arguments. The opening is still on the board. |
| `parse_failure` | Lever answered in a shape this client cannot read.      | Report it at [the issue tracker](https://github.com/smeet666/mcp-lever/issues).   |
| `network_error` | The request did not complete.                           | Try again shortly.                                                                |
| `timeout`       | The request passed its deadline.                        | Ask for fewer companies, or a smaller `limit`.                                    |

## As a library

The layer reading Lever is published on its own, with its pacing, its cache and
its errors, and with no protocol attached.

```ts
import { Client } from "mcp-lever/client";

const client = new Client({ minIntervalMs: 2000 });
const resolved = await client.resolveCompany("Included Health");
const jobs = await client.listPostings(resolved.found[0], { limit: 10 });
console.log(jobs.length);
```

`ClientOptions` takes `minIntervalMs`, `timeoutMs`, `cacheTtlMs` and `fetchImpl`.
An interval below the published floor is ignored, so the floor holds here as
well.

## Pacing and attribution

Both API hosts publish `Crawl-delay: 1`, so requests go out one at a time with at
least a second between them, and that floor holds however the client is
configured. The `User-Agent` carries the project and an address where a person
can be reached, and imitates no browser.

Reads go to `api.lever.co` and `api.eu.lever.co`, which are the hosts Lever
documents for its posting data. The `jobs.lever.co` careers pages are left alone.

Every opening carries the address of its Lever page and its apply URL. Credit the
company and link that page when you show an opening.

This MCP server is an unofficial project, with no affiliation to Lever or to the
companies whose boards it reads.

## Privacy

This server collects nothing about you and sends nothing to its author. It runs
on your machine, contacts `api.lever.co` and `api.eu.lever.co` and nothing else, holds its answers in memory
while it runs, and writes nothing to disk.
[PRIVACY.md](PRIVACY.md) states what a request carries and which settings change
any of it.

## Development

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Tests run against generated fixtures and make no network request. The live suite,
`npm run test:live`, makes one request per route and runs nightly against the
service itself.

## Contributing

Bugs, questions and ideas belong in
[the issue tracker](https://github.com/smeet666/mcp-lever/issues). Pull requests
are welcome; opening an issue first helps agree on the shape of the change. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). The openings belong to the companies that published
them.

---

<a name="mcp-lever-français"></a>

# mcp-lever (français)

_[English version](#mcp-lever)_

[Lever](https://www.lever.co) est un logiciel de recrutement qu'utilisent des
milliers d'entreprises pour mener leurs embauches, et chaque cliente reçoit avec
lui un site d'offres public. Chaque site porte les postes ouverts de cette
entreprise avec leur intitulé, leur lieu, l'équipe et le département auxquels ils
appartiennent, le type de contrat demandé, l'annonce complète, et la fourchette
de salaire quand l'entreprise a choisi d'en publier une. Lever héberge un site
par entreprise, sur son instance mondiale ou sur son instance européenne, et ne
publie aucun index les traversant.

Ce serveur relie un client de conversation à ces sites. Vous nommez les
entreprises qui vous intéressent, et il traduit chaque nom en l'identifiant qui
adresse son site, cherche dans leurs offres, les filtre par lieu, équipe, mode de
travail, pays, salaire ou fraîcheur de publication, lit une offre en entier, et
liste les formulations selon lesquelles chaque entreprise classe les siennes.
Aucune clé d'API, aucun compte.

## Installation

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=lever&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1sZXZlciJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=lever&config=%7B%22name%22%3A%22lever%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-lever%22%5D%7D)

**Claude Code**

```bash
claude mcp add lever -- npx -y mcp-lever
```

**Claude Desktop, Cursor, et tout client au format de configuration standard**

```json
{
  "mcpServers": {
    "lever": {
      "command": "npx",
      "args": ["-y", "mcp-lever"]
    }
  }
}
```

Node 24 ou plus récent est nécessaire, et aucune variable d'environnement n'est à
renseigner.

### Avec Docker

```json
{
  "mcpServers": {
    "lever": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-lever:2.0.0"]
    }
  }
}
```

`-i` garde l'entrée standard ouverte, qui est le canal du protocole, et `-t` est
omis parce qu'un TTY réécrit le flux. Le conteneur a besoin d'un accès HTTPS
sortant vers `api.lever.co` et `api.eu.lever.co`, et de rien d'autre : aucun
volume, aucun port, aucun identifiant.

### Bundle, sans npm

Téléchargez `mcp-lever-2.0.0.mcpb` depuis
[la dernière publication](https://github.com/smeet666/mcp-lever/releases/latest)
et ouvrez-le. Un client qui gère les bundles MCP l'installe seul, sans npm et
sans fichier de configuration à modifier. Le bundle emporte ses dépendances, donc
rien n'est téléchargé à l'installation.

## Ce qu'on peut demander

- « Lesquelles d'Included Health, Netlify et Ramp recrutent sur Lever ? »
- « Trouve-moi des postes d'ingénierie en télétravail chez ces trois-là. »
- « Lis-moi cette offre en entier. »
- « Sous quels lieux Included Health classe-t-elle ses offres ? »
- « Quelque chose publié ces quinze derniers jours chez Netlify ? »

Chaque question part d'une entreprise, puisque Lever n'offre aucune recherche
traversant les sites. `search_jobs` résout lui-même les noms qu'on lui donne,
donc rien n'est à préparer :

```
resolve_company(["Included Health"])  ->  includedhealth, instance mondiale, publie
search_jobs(["Included Health"], keyword: "therapist")
get_job("includedhealth", "6f97a19f-…")
```

## Les outils

| Outil                | Ce qu'il fait                                                  |
| -------------------- | -------------------------------------------------------------- |
| `resolve_company`    | Traduit des noms d'entreprises en identifiants de sites Lever. |
| `search_jobs`        | Cherche dans les offres des entreprises nommées.               |
| `get_job`            | Lit une offre en entier, annonce comprise.                     |
| `list_filter_values` | Liste les formulations sous lesquelles une entreprise classe.  |

Un identifiant de site Lever distingue la casse, donc `Flex` répond là où `flex`
ne rend rien. Quatre orthographes sont essayées par nom sur chacune des deux
instances, et la réponse liste ce qui a été envoyé : ne rien trouver ne prouve
jamais qu'une entreprise est absente de Lever.

### `resolve_company`

Traduit des noms d'entreprises en identifiants de sites Lever, en signalant
chaque instance qui a répondu. Il prend une liste.

| Argument | Type                      | Requis | Ce qu'il fait                                            |
| -------- | ------------------------- | ------ | -------------------------------------------------------- |
| `names`  | tableau de 1 à 25 chaînes | oui    | Des noms d'entreprises, ou des identifiants déjà connus. |

**En retour :** une entrée par nom, portant `input` ; `found`, une liste de
`{ slug, instance, publishes }` où `publishes` est faux pour un site qui existe
et ne liste rien aujourd'hui ; `tried`, les orthographes envoyées dans l'ordre ;
et `cached`, vrai quand la session avait déjà résolu ce nom. Un nom qui répond
sur les deux instances revient avec les deux, et aucune n'est élue : passez celle
que vous visez aux autres outils.

### `search_jobs`

Cherche dans les offres des entreprises nommées. Lever applique les filtres qu'il
gère sur sa propre formulation exacte, et ce serveur applique les autres aux
offres qu'il a lues.

| Argument             | Type                                   | Requis | Ce qu'il fait                                                                   |
| -------------------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `companies`          | tableau de 1 à 25 chaînes              | oui    | Noms d'entreprises ou identifiants. Chacun est résolu ici.                      |
| `keyword`            | chaîne                                 | non    | Mots à chercher dans l'intitulé et dans l'annonce.                              |
| `location`           | tableau de 1 à 20 chaînes              | non    | Des lieux, exactement comme Lever les écrit.                                    |
| `team`               | tableau de 1 à 20 chaînes              | non    | Des équipes, exactement comme Lever les écrit.                                  |
| `department`         | tableau de 1 à 20 chaînes              | non    | Des départements, exactement comme Lever les écrit.                             |
| `commitment`         | tableau de 1 à 20 chaînes              | non    | Des types de contrat, exactement comme Lever les écrit.                         |
| `workplace_type`     | tableau de 1 à 4 chaînes               | non    | `remote`, `hybrid`, `onsite` ou `unspecified`.                                  |
| `country`            | tableau de 1 à 20 codes à deux lettres | non    | Des pays en code ISO, comme `FR` ou `US`.                                       |
| `salary_min`         | nombre, 0 ou plus                      | non    | La plus basse borne haute de fourchette à conserver.                            |
| `salary_interval`    | chaîne                                 | non    | La période dans laquelle `salary_min` est écrit, par exemple `per-year-salary`. |
| `currency`           | code à trois lettres                   | non    | La devise dans laquelle `salary_min` est écrit, comme `EUR`.                    |
| `posted_within_days` | entier, 1 à 3650                       | non    | L'ancienneté maximale d'une offre.                                              |
| `limit`              | entier, 1 à 100, défaut `25`           | non    | Offres à lire par entreprise.                                                   |
| `skip`               | entier, 0 à 100000, défaut `0`         | non    | Offres à enjamber par entreprise.                                               |

Lever applique lui-même `location`, `team`, `department` et `commitment` ; ce
serveur applique `keyword`, `workplace_type`, `country`, `salary_min`,
`salary_interval`, `currency` et `posted_within_days` à ce qu'il a lu.
`list_filter_values` publie les formulations que prennent les quatre premiers, et
une formulation que Lever ignore revient en liste vide.

**En retour :** `jobs`, chacune portant `id` et `company_slug`, que `get_job`
reprend, plus `title`, `location`, `all_locations`, `country`, `workplace_type`,
`team`, `posted_at`, `url` et `apply_url`. `commitment` et `department` sont
absents quand l'entreprise ne les renseigne pas. `salary` vaut `null` pour une
offre publiée sans fourchette, ce qui ne vaut jamais zéro, et porte l'`interval`
dans lequel Lever l'a écrite, jamais converti ni annualisé. `per_company` donne
une issue par entreprise, avec un `status` valant `read`, `unresolved`, `empty`
ou `failed`, qui sont quatre réponses différentes, et les comptes `read` et
`returned` de part et d'autre des filtres. `total_available` vaut toujours
`null` : Lever ne publie aucun compte de résultats. Les lignes ne portent pas
l'annonce, un site d'entreprise pouvant peser plusieurs mégaoctets.

`limit` s'applique par entreprise, et une entreprise dont les offres le
remplissent en publie peut-être davantage : les notes le signalent, et disent
qu'un compte pris dans cette fenêtre mesure la fenêtre. `posted_within_days`
parcourt jusqu'à cinq pages par entreprise, et Lever pagine par intitulé, donc
une offre publiée hier peut se trouver n'importe où dans un site.

### `get_job`

Lit une offre en entier : l'annonce, ses sections nommées, et le salaire tel que
publié.

| Argument       | Type             | Requis | Ce qu'il fait                                           |
| -------------- | ---------------- | ------ | ------------------------------------------------------- |
| `company_slug` | chaîne           | oui    | L'identifiant du site, rendu par `resolve_company`.     |
| `job_id`       | chaîne           | oui    | L'identifiant d'une offre, rendu par une recherche.     |
| `instance`     | `global` ou `eu` | non    | L'instance d'où vient la ligne. La mondiale par défaut. |

**En retour :** `job`, qui porte les champs d'une ligne de recherche, plus
`description`, `sections` en `{ heading, items }`, `salary_note` pour ce que
l'entreprise a écrit à côté de la fourchette, et `source` avec l'adresse d'où
l'offre a été lue.

### `list_filter_values`

Liste les formulations d'équipe, de lieu et de contrat qu'une entreprise emploie.
À lire avant de filtrer : Lever fait correspondre sa propre formulation, et le
vocabulaire appartient à chaque entreprise, l'une écrivant `Full-time` là où une
autre écrit `EE Full-Time`.

| Argument       | Type                                                    | Requis | Ce qu'il fait                                                                        |
| -------------- | ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `company_slug` | chaîne                                                  | oui    | L'identifiant du site, rendu par `resolve_company`.                                  |
| `instance`     | `global` ou `eu`                                        | non    | L'instance où vit ce site. La mondiale par défaut.                                   |
| `fields`       | tableau de 1 à 3 parmi `team`, `location`, `commitment` | non    | Les vocabulaires à lire. Chacun coûte une requête, et les trois sont lus par défaut. |

**En retour :** `company_slug`, `instance`, et `fields` qui porte une liste de
`{ value, count }` pour chaque vocabulaire demandé. Un `count` vaut `null`
là où Lever n'a publié aucun chiffre à côté de la catégorie.

## Configuration

Il n'y a rien à configurer. Le serveur ne lit aucune variable d'environnement, et
le bloc `mcpServers` ci-dessus est complet tel quel.

Le rythme, le délai et le cache sont des réglages de la couche cliente, que
[Comme bibliothèque](#comme-bibliothèque) montre comment passer. L'écart entre
deux requêtes peut y être élargi et jamais resserré.

## Erreurs

Chaque échec porte un des six codes, un message, et quand cela aide les valeurs
qui auraient été acceptées.

| Code            | Ce qui s'est passé                                       | Que faire                                                                             |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `not_found`     | Lever a répondu, et n'a ni ce site ni cette offre.       | Vérifiez l'identifiant avec `resolve_company`.                                        |
| `invalid_input` | Les arguments ont été refusés avant toute requête.       | Lisez le message, qui nomme l'argument et ce qu'il prend.                             |
| `rate_limited`  | Lever demande à ce client de ralentir.                   | Attendez, puis rappelez avec les mêmes arguments. L'offre est toujours en ligne.      |
| `parse_failure` | Lever a répondu dans une forme que ce client ne lit pas. | Signalez-le sur [le suivi d'incidents](https://github.com/smeet666/mcp-lever/issues). |
| `network_error` | La requête n'a pas abouti.                               | Réessayez sous peu.                                                                   |
| `timeout`       | La requête a dépassé son délai.                          | Demandez moins d'entreprises, ou un `limit` plus petit.                               |

## Comme bibliothèque

La couche qui lit Lever est publiée seule, avec son rythme, son cache et ses
erreurs, sans protocole attaché.

```ts
import { Client } from "mcp-lever/client";

const client = new Client({ minIntervalMs: 2000 });
const resolved = await client.resolveCompany("Included Health");
const jobs = await client.listPostings(resolved.found[0], { limit: 10 });
console.log(jobs.length);
```

`ClientOptions` prend `minIntervalMs`, `timeoutMs`, `cacheTtlMs` et `fetchImpl`.
Un écart sous le plancher publié est ignoré, donc le plancher tient également
ici.

## Rythme et attribution

Les deux hôtes d'API publient `Crawl-delay: 1`, donc les requêtes partent une à
une avec au moins une seconde entre elles, et ce plancher tient quelle que soit
la configuration du client. Le `User-Agent` porte le projet et une adresse où
joindre une personne, et n'imite aucun navigateur.

Les lectures vont vers `api.lever.co` et `api.eu.lever.co`, les hôtes que Lever
documente pour ses données d'offres. Les pages carrières `jobs.lever.co` sont
laissées tranquilles.

Chaque offre porte l'adresse de sa page Lever et son adresse de candidature.
Créditez l'entreprise et renvoyez vers cette page quand vous montrez une offre.

Ce MCP est un projet non officiel, sans affiliation à Lever ni aux entreprises
dont il lit les sites.

## Confidentialité

Ce serveur ne collecte rien sur vous et n'envoie rien à son auteur. Il tourne sur
votre machine, ne joint que `api.lever.co` et `api.eu.lever.co`, garde ses réponses en mémoire le temps qu'il
tourne, et n'écrit rien sur le disque. [PRIVACY.md](PRIVACY.md) dit ce qu'une
requête emporte et quels réglages changent cela.

## Développement

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Les tests s'exécutent sur des fixtures engendrées et n'émettent aucune requête.
La suite en direct, `npm run test:live`, émet une requête par route et tourne
chaque nuit contre le service lui-même.

## Contribuer

Les anomalies, les questions et les idées ont leur place dans
[le suivi d'incidents](https://github.com/smeet666/mcp-lever/issues). Les
propositions de modification sont bienvenues ; ouvrir un ticket d'abord aide à
s'accorder sur la forme du changement. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT, voir [LICENSE](LICENSE). Les offres appartiennent aux entreprises qui les
ont publiées.
