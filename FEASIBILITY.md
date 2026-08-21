# Lever — étude de faisabilité

Sondée le 13 août 2026. Verdict : **GO**, et c'est le meilleur des trois sites
examinés jusqu'ici. Les conditions sont propres, la donnée est riche et déjà
structurée, et l'éditeur écrit lui-même que ses annonces publiées se font
moissonner.

## 1. Le serveur existe-t-il déjà ? Non, nulle part

Le registre officiel ne rend que des homonymes, `mcp-klever-vm`, `leverage`,
`clevername-mcp`. npm n'a rien. **Aucun serveur MCP ne lit Lever**, ni du côté
candidat, ni du côté recruteur.

## 2. Le `robots.txt`

| Hôte              | Contenu                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `api.lever.co`    | `Allow: /`, `Crawl-delay: 1`                                                     |
| `api.eu.lever.co` | `Allow: /`, `Crawl-delay: 1`                                                     |
| `www.lever.co`    | `Disallow: /studio/`, `/api/`, `/404`, `/500`                                    |
| `jobs.lever.co`   | bloc Cloudflare : `Content-Signal`, puis `Disallow: /` nommément pour six agents |

Le serveur lit `api.lever.co`, qui autorise tout et demande une seconde entre
deux requêtes. Ce fichier ne nomme aucun agent et ne porte aucun `Content-Signal`.

**`jobs.lever.co` ferme sa porte à six agents nommés**, dans un bloc que
Cloudflare gère : `CCBot`, **`ClaudeBot`**, `GPTBot`, `Google-Extended`,
`meta-externalagent` et `CloudflareBrowserRenderingCrawler` reçoivent chacun un
`Disallow: /`. Le bloc `*` qui suit porte `Allow: /` et `Crawl-delay: 1`.

Les deux hôtes servent la même donnée et envoient des signaux opposés. La
lecture qui en découle :

- **L'API reste ouverte.** `api.lever.co` est l'interface que l'éditeur
  documente, elle ne nomme personne et n'exclut personne. C'est là que le
  serveur lit, et il ne touche jamais `jobs.lever.co`.
- **Rendre un lien vers `jobs.lever.co` reste légitime.** Un `Disallow` interdit
  de parcourir, jamais de citer une adresse.
- **Moissonner `jobs.lever.co` est exclu**, y compris à travers un tiers qui
  l'aurait moissonné pour nous.

Le `Content-Signal` de `jobs.lever.co` mérite d'être lu en entier, puisqu'il
porte sur le même contenu servi par une autre porte. `search=yes` autorise
l'indexation et les extraits, `ai-train=no` interdit l'entraînement, et
`use=reference` autorise la consommation avec renvoi à la source. `ai-input`
n'est pas mentionné, ce que le préambule du fichier définit comme ni accordé ni
refusé. Le fichier ajoute que toute restriction ainsi exprimée vaut réserve de
droits au titre de l'article 4 de la directive 2019/790.

Ce que le serveur fait tombe dans `search` et dans `use=reference` : il lit à la
demande, rend un extrait et renvoie vers l'annonce. Il n'entraîne rien.

## 3. Les conditions écrites

Les conditions de service, mises à jour le 25 août 2023, régissent
« a customer's acquisition and use of Lever software and/or services ». La
clause de restriction commence par **« Customer will not, and will not permit
any third party to »** et vise la rétro-ingénierie, les œuvres dérivées, le
service bureau, la revente et la sous-licence du service.

**Aucune occurrence de « scraping », « crawling », « extraction », « data
mining », « spiders », « robots » ou « automated ».** Rien sur la lecture des
annonces publiées.

Dans l'autre sens, la documentation publique de l'API écrit :

> Note that all job postings in the `published` state are publicly viewable.
> **These jobs may be scraped by third parties.** All other jobs are completely
> hidden from the jobs API.

C'est la phrase la plus permissive rencontrée sur les trois sites examinés.

## 4. Le site sert-il un agent honnête ?

Oui. `curl` avec un `User-Agent` de projet reçoit 200 sur toutes les routes de
lecture, sur l'instance globale comme sur l'européenne. Aucun mur.

## 5. Passerelle officielle

L'API est documentée sur `github.com/lever/postings-api`, dépôt public de
l'éditeur, avec les paramètres, les champs et des exemples.

## 6. La donnée vaut-elle un serveur ? Oui, et elle est bien faite

Les champs d'une annonce, tels que l'API les rend :

| Champ                                                      | Ce qu'il porte                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`, `text`                                               | identifiant UUID, intitulé du poste                                |
| `categories`                                               | `location`, `commitment`, `team`, `department`, **`allLocations`** |
| `country`                                                  | code ISO 3166-1 alpha-2, **`null` quand il est inconnu**           |
| `workplaceType`                                            | `unspecified`, `on-site`, `remote`, `hybrid`                       |
| `salaryRange`                                              | objet `{ currency, interval, min, max }`, optionnel                |
| `descriptionPlain`, `openingPlain`, `descriptionBodyPlain` | le texte, déjà en clair                                            |
| `lists`                                                    | les blocs nommés de l'annonce, prérequis et avantages              |
| `hostedUrl`, `applyUrl`                                    | la page de l'annonce, le formulaire de candidature                 |
| `createdAt`                                                | horodatage en millisecondes                                        |

Trois choses valent d'être soulignées, parce qu'elles évitent chacune un
mensonge courant :

- **Le salaire porte son intervalle.** `{ currency, interval, min, max }` dit si
  le montant est annuel, ce qu'une chaîne libre ne dit pas.
- **Le pays est un code fermé, et vaut `null` quand il est inconnu.** L'absence
  se déclare au lieu de se deviner.
- **Les lieux arrivent en tableau.** `allLocations` évite de découper une chaîne
  à la virgule, opération qui invente des lieux.
- **Le texte arrive en clair.** Chaque champ HTML a son jumeau `Plain`, donc
  aucune conversion maison, aucune entité à déséchapper.

## Ce que l'API sait faire, et ce qu'elle refuse

Documenté par l'éditeur, et vérifié :

- **Pagination** par `skip` et `limit`.
- **Filtres côté serveur** : `location`, `commitment`, `team`, `department`,
  `level`, cumulables et combinés en OU.
- **Regroupement** par `group=location|commitment|team`, qui rend les catégories
  avec leurs offres.
- **Route d'annonce unique** : `/v0/postings/{site}/{id}`.

L'éditeur écrit ce que l'API ne fait pas, et la première ligne gouverne la
conception : **« Let you do full-text searches over open jobs. »** Aucune
recherche plein texte, et aucune recherche transverse entre entreprises.

Les filtres exigent la valeur exacte, sensible à la casse.
`team=Engineering` rend une liste vide là où la valeur réelle diffère. Le
chemin honnête passe par `group=team`, qui publie le vocabulaire réel d'un site
avant de filtrer dessus.

## Trois pièges, tous mesurés

**Le nom de site est sensible à la casse.** `Flex` rend 35 offres et `flex`
répond 404 ; `Sprinto` rend 30 offres et `sprinto` répond 404. **Un 404 ne
prouve donc pas qu'une entreprise est absente de Lever**, et un serveur qui le
dirait mentirait. C'est l'invariant le plus important de ce site.

**Une réponse sans `limit` rend le board entier.** Jobgether, cliente de Lever,
publie 4 618 offres : **48 Mo dans une seule réponse**. Le `limit` doit être
imposé par le serveur plutôt que laissé à l'appelant.

**Deux instances coexistent, la globale et l'européenne**, sur `api.lever.co` et
`api.eu.lever.co`. Un site absent de l'une peut vivre sur l'autre, donc une
absence ne se déclare qu'après avoir interrogé les deux.

## Les trois états d'une réponse, tous distinguables

C'est la propriété qui rend ce site honnête :

| Réponse                                         | Ce qu'elle veut dire                           |
| ----------------------------------------------- | ---------------------------------------------- |
| `404 {"ok":false,"error":"Document not found"}` | ce nom de site n'existe pas sur cette instance |
| `200 []`                                        | le site existe et ne publie rien               |
| `200 [ … ]`                                     | le site existe et publie                       |

Vérifié : `zzznotreal999` répond 404, `lever`, `plaid` et `mistral` rendent
`200 []`, `theathletic` rend 14 offres. La même distinction vaut sur une annonce
unique, où un identifiant inconnu répond 404.

## Le rythme

`Crawl-delay: 1` est publié sur les deux instances de l'API, donc **une seconde
entre deux requêtes**, une requête à la fois, plancher que la configuration peut
élargir. Aucune limite de débit n'apparaît dans les en-têtes.

Le poids des réponses est l'autre argument : un cache par site est nécessaire, et
un `limit` par défaut modeste l'est autant.

## La découverte, et la seule porte qui existe

Comme chez tous les ATS, il faut nommer l'entreprise avant d'appeler, et
l'éditeur ne publie aucun annuaire de ses clientes.

**La devinette marche, à condition de partir du bon nom.** Douze entreprises
choisies au hasard ont toutes répondu 404, ce qui mesurait leur absence de Lever
plutôt que la qualité de la devinette. Reprise sur les 18 entreprises que Lever
présente elle-même en études de cas, la même règle — nom en minuscules, sans
espace — **touche 14 fois sur 18** : `lucidworks`, `royalambulance`,
`enablecomp`, `entrata`, `insomniacookies`, `hottopic`, `coupa`, `kinsta`,
`aircall`, `sambatv`, `voro`, `benchsci`, `15five`, `bazaarvoice`.

Une échelle de variantes récupère une partie du reste : `Autify` répond avec sa
majuscule, `basis` répond en gardant le premier mot de « Basis Technologies ».
Les deux derniers échecs, Mitek Systems et Numan, ne répondent à aucune variante
et ont vraisemblablement quitté la plateforme.

Les formes à essayer, dans cet ordre : minuscules collées, capitale initiale,
premier mot seul, forme avec tiret. Les noms réels observés couvrent tous ces
cas : `thinkahead` pour AHEAD, `gohighlevel` pour HighLevel, `matchgroup` pour
Match Group, `includedhealth` pour Included Health, `Flex` et `Sprinto` avec
leur capitale.

**Un moteur de recherche, lui, rend les noms exacts.** Une requête restreinte au
domaine `jobs.lever.co` a rendu dix sites réels d'un coup, tous confirmés
ensuite par l'API. C'est une porte hors de Lever, qui ne contourne aucun accès et
ne lit aucune page interdite.

## Ce qui a été tranché

- **La découverte** : l'appelant nomme les entreprises, l'échelle de formes
  propose un identifiant, et l'API confirme. Le serveur n'embarque aucun
  annuaire.
- **Les deux instances** : la globale et l'européenne se sondent toutes les
  deux, et un identifiant qui vit des deux côtés se rend des deux côtés sans
  qu'on en élise un.
- **Ce qu'une liste rend** : la ligne seule, le texte complet passant par une
  route à part, puisque 25 offres pèsent déjà 466 Ko chez Lever.
- **Les plafonds** : 10 entreprises par recherche et 25 au maximum, 25 offres par
  entreprise et 100 au maximum.

Le reste vit dans `PLAN.md`.
