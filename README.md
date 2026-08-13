<img src="assets/icon-128.png" alt="" width="96" align="right">

# mcp-lever

An MCP server for the public job boards companies publish through
[Lever](https://www.lever.co). Search the openings of the companies you name,
read one in full, and see the wordings each company filters by. No API key, no
account, read-only.

[Français](#mcp-lever-français)

## What it does

Lever hosts one job board per company, and publishes no index across them. Every
question therefore starts with a company name, and this server turns that name
into the site name that addresses its board.

```
resolve_company(["Included Health"])  ->  includedhealth, global instance, publishing
search_jobs(["Included Health"], keyword: "therapist")
get_job("includedhealth", "6f97a19f-…")
```

## Install

```bash
npx mcp-lever
```

Claude Desktop, `claude_desktop_config.json`:

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

## The tools

### `resolve_company`

Company names in, the Lever site names out, with every instance that answered. It
takes a list, because probing ten names costs ten resolutions where a search
would read ten boards.

Lever site names distinguish case: `Flex` answers where `flex` returns 404. Four
spellings are tried on each of Lever's two instances, stopping at the first one
confirmed. **Nothing found is never proof that a company is absent from Lever**,
and the answer says so, listing the spellings that were sent.

### `search_jobs`

`companies` is required, and takes names or site names. Each name is resolved
here, so no preparation is needed.

| Filter | Applied by |
|---|---|
| `location`, `team`, `department`, `commitment` | Lever, on its exact wording |
| `keyword`, `workplace_type`, `country`, `salary_min`, `posted_within_days` | this server, on the openings it read |

Lever offers no full-text search and accepts no filter on workplace type,
country or salary, which is why those are applied here. `limit` applies per
company, and a company whose openings fill it may publish more: the notes say
when that happened, and that a count taken inside that window measures the
window.

`posted_within_days` walks up to five pages per company. Lever pages by title,
so an opening published yesterday sits anywhere in a board, and a recency
question read from the first page answers about the first page.

### `get_job`

One opening in full: the advert, its named sections, and the salary as
published. A search returns rows without the text, because one company's board
runs to megabytes.

### `list_filter_values`

The team, location and commitment wordings one company uses. Read it before
filtering: Lever matches its own wording, and **answers a wording it does not
know with an empty list and no error**, which reads as "nothing found". The
vocabulary belongs to each company: one writes `Full-time`, another `Full Time`,
another `EE Full-Time`.

## What the answers never claim

- **A salary Lever does not publish is `null`**, never zero. Most openings
  publish none, and filtering on salary drops them: the notes say how many.
- **An amount carries its own period.** A rate published per hour is never
  annualised, and a threshold is only compared against amounts sharing its
  period. Nothing is converted between currencies.
- **A country Lever does not record is `null`**, never another country. Openings
  carrying no country are counted separately when a country filter drops them.
- **A site name that does not exist, a site publishing nothing, and a read that
  failed are three answers**, and `per_company` says which is which.
- **No result count.** Lever publishes none, so `total_available` is always
  `null`, and a full page is no measure of what exists.

## What it reads, and what it leaves alone

The server reads `api.lever.co` and `api.eu.lever.co`, which Lever documents as
public and whose `robots.txt` allows everything with `Crawl-delay: 1`. It sends
one request at a time, a second apart, under a `User-Agent` naming the project
and a contact address.

It never reads `jobs.lever.co`, whose `robots.txt` names six agents and refuses
each of them. Openings carry the address of their page there, because citing an
address is not crawling it.

## Stability

A major version covers what a caller writes against and reads back:

- the four tool names, and the names and types of their arguments;
- the shape of what each tool returns, and the fields it carries;
- the six error codes;
- the `./client` subpath: `Client`, `Read<T>`, and the shapes it hands back.

These stay minor, and a caller who reads only what it asked for is untouched:

- a new optional argument, or a new tool;
- a new field in an answer, or a new note;
- the wording of a note, a description, or an error message;
- following a newer revision of the Model Context Protocol, which changes the
  envelope around the tools rather than the tools.

A field that Lever stops publishing is reported as absent rather than removed
from the shape, so a schema never narrows without a major version.

## Use it as a library

The low-level client is published on its own, with the pacing, the cache and the
error taxonomy, and no protocol attached:

```js
import { Client } from "mcp-lever/client";

const client = new Client();
const { found } = await client.resolveCompany("Aircall");
const { data } = await client.listPostings({ slug: found[0].slug, instance: "global" });
```

Errors carry one of six codes: `not_found`, `invalid_input`, `rate_limited`,
`parse_failure`, `network_error`, `timeout`. A failure is never returned as an
empty result.

## Licence

MIT. Job adverts belong to the companies that published them: credit the company
and link the page each opening carries.

---

# mcp-lever (français)

Un serveur MCP pour les pages carrières que les entreprises publient à travers
[Lever](https://www.lever.co). Cherchez les offres des entreprises que vous
nommez, lisez-en une en entier, et consultez le vocabulaire de filtre propre à
chacune. Sans clé d'API, sans compte, en lecture seule.

## Ce qu'il fait

Lever héberge une page carrières par entreprise et ne publie aucun index qui les
traverse. Toute question part donc d'un nom d'entreprise, que ce serveur
transforme en identifiant de site.

```
resolve_company(["Included Health"])  ->  includedhealth, instance globale, publie
search_jobs(["Included Health"], keyword: "therapist")
get_job("includedhealth", "6f97a19f-…")
```

## Installation

```bash
npx mcp-lever
```

Claude Desktop, dans `claude_desktop_config.json` :

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

## Les outils

### `resolve_company`

Des noms d'entreprises en entrée, leurs identifiants de site en sortie, avec
chaque instance qui a répondu. L'outil prend une liste, parce que sonder dix noms
coûte dix résolutions là où une recherche lirait dix pages carrières.

Les identifiants distinguent la casse : `Flex` répond là où `flex` rend 404.
Quatre formes sont essayées sur chacune des deux instances, en s'arrêtant à la
première confirmée. **Ne rien trouver ne prouve jamais qu'une entreprise est
absente de Lever**, et la réponse le dit, en listant les formes envoyées.

### `search_jobs`

`companies` est requis et accepte des noms ou des identifiants. Chaque nom est
résolu ici, sans préparation.

| Filtre | Appliqué par |
|---|---|
| `location`, `team`, `department`, `commitment` | Lever, sur son libellé exact |
| `keyword`, `workplace_type`, `country`, `salary_min`, `posted_within_days` | ce serveur, sur les offres lues |

Lever n'offre aucune recherche plein texte et n'accepte de filtre ni sur le mode
de travail, ni sur le pays, ni sur le salaire. `limit` s'applique par entreprise,
et une entreprise qui le remplit peut publier davantage : les notes le disent, et
disent aussi qu'un compte pris dans cette fenêtre mesure la fenêtre.

`posted_within_days` parcourt jusqu'à cinq pages par entreprise. Lever pagine par
titre, donc une offre publiée hier se trouve n'importe où dans une page
carrières, et une question de fraîcheur lue sur la première page répond sur la
première page.

### `get_job`

Une offre en entier : l'annonce, ses rubriques nommées, et le salaire tel que
publié. Une recherche rend des lignes sans le texte, une page carrières pesant
plusieurs mégaoctets.

### `list_filter_values`

Les libellés d'équipe, de lieu et de type de contrat qu'une entreprise emploie.
À lire avant de filtrer : Lever exige son propre libellé et **répond à un libellé
inconnu par une liste vide, sans erreur**, ce qui se lit « rien trouvé ». Le
vocabulaire appartient à chaque entreprise : l'une écrit `Full-time`, une autre
`Full Time`, une troisième `EE Full-Time`.

## Ce que les réponses n'affirment jamais

- **Un salaire que Lever ne publie pas vaut `null`**, jamais zéro. La plupart des
  offres n'en publient aucun, et filtrer sur le salaire les écarte : les notes
  disent combien.
- **Un montant porte sa période.** Un taux horaire n'est jamais annualisé, et un
  seuil ne se compare qu'à des montants de même période. Aucune devise n'est
  convertie.
- **Un pays que Lever n'enregistre pas vaut `null`**, jamais un autre pays. Les
  offres sans pays sont comptées à part quand un filtre les écarte.
- **Un identifiant qui n'existe pas, un site qui ne publie rien et une lecture en
  panne sont trois réponses**, et `per_company` dit laquelle.
- **Aucun compteur de résultats.** Lever n'en publie pas, donc `total_available`
  vaut toujours `null`, et une page pleine ne mesure rien.

## Ce qu'il lit, et ce qu'il laisse tranquille

Le serveur lit `api.lever.co` et `api.eu.lever.co`, que Lever documente comme
publics et dont le `robots.txt` autorise tout avec `Crawl-delay: 1`. Il envoie
une requête à la fois, à une seconde d'intervalle, sous un `User-Agent` portant
le nom du projet et une adresse de contact.

Il ne lit jamais `jobs.lever.co`, dont le `robots.txt` nomme six agents et les
refuse chacun. Les offres portent l'adresse de leur page là-bas, citer une
adresse n'étant pas la parcourir.

## Stabilité

Une version majeure couvre ce qu'un appelant écrit et relit :

- les noms des quatre outils, et les noms et types de leurs arguments ;
- la forme de ce que chaque outil rend, et les champs qu'elle porte ;
- les six codes d'erreur ;
- le sous-chemin `./client` : `Client`, `Read<T>`, et les formes qu'il rend.

Restent mineurs, et laissent intact un appelant qui ne lit que ce qu'il a
demandé :

- un argument optionnel de plus, ou un outil de plus ;
- un champ de plus dans une réponse, ou une note de plus ;
- la formulation d'une note, d'une description ou d'un message d'erreur ;
- le passage à une révision plus récente du Model Context Protocol, qui change
  l'enveloppe autour des outils plutôt que les outils.

Un champ que Lever cesse de publier se rend absent plutôt que retiré de la
forme, de sorte qu'un schéma ne se rétrécit jamais sans version majeure.

## Comme bibliothèque

La couche basse est publiée seule, avec son rythme, son cache et sa taxonomie
d'erreurs, sans protocole attaché :

```js
import { Client } from "mcp-lever/client";

const client = new Client();
const { found } = await client.resolveCompany("Aircall");
const { data } = await client.listPostings({ slug: found[0].slug, instance: "global" });
```

Les erreurs portent l'un de six codes : `not_found`, `invalid_input`,
`rate_limited`, `parse_failure`, `network_error`, `timeout`. Une panne n'est
jamais rendue comme un résultat vide.

## Licence

MIT. Les annonces appartiennent aux entreprises qui les publient : créditez
l'entreprise et liez la page que chaque offre porte.
