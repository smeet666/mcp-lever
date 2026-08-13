# Schéma déduit de l'API des annonces Lever

Établi le 13 août 2026 sur **450 offres de 8 sites** : `thinkahead`,
`includedhealth`, `gohighlevel`, `matchgroup`, `Flex`, `Sprinto`, `theathletic`,
`openx`. Chaque site a été lu en une requête, à une seconde d'intervalle comme
le demande le `robots.txt`.

Endpoint : `GET https://api.lever.co/v0/postings/{site}?mode=json`
Instance européenne : `https://api.eu.lever.co/v0/postings/{site}?mode=json`

## L'enveloppe

La liste rend **un tableau nu**, sans objet d'enveloppe, sans compteur et sans
curseur. La pagination passe par `skip` et `limit`, et `group=` change la forme
de la réponse en un tableau de catégories `{ title, postings[] }`.

Une annonce seule se lit à `/v0/postings/{site}/{id}` et rend l'objet nu.

## Les trois états d'une réponse

C'est la propriété la plus utile de ce site, et un client qui les confond ment.

| Réponse | Ce qu'elle veut dire |
|---|---|
| `404 {"ok":false,"error":"Document not found"}` | ce nom de site n'existe pas sur cette instance |
| `200 []` | le site existe et ne publie rien |
| `200 [ … ]` | le site existe et publie |

La même distinction vaut sur une annonce : un identifiant inconnu répond 404.

**Le nom de site distingue la casse.** `Flex` rend 35 offres et `flex` répond
404 ; `Sprinto` rend 30 offres et `sprinto` répond 404. Un 404 ne prouve donc
jamais qu'une entreprise est absente de Lever.

## Les champs d'une offre

Vingt champs au plus. Dix-sept sont toujours présents, trois sont optionnels et
**disparaissent de l'objet** quand ils ne sont pas publiés.

| Champ | Type | Présence sur 450 | Vide | Statut |
|---|---|---|---|---|
| `id` | string | 450/450 | 0 | **toujours** |
| `text` | string | 450/450 | 0 | **toujours** |
| `categories` | object | 450/450 | 0 | **toujours** |
| `country` | string \| null | 450/450 | **2 nuls** | **toujours**, nul quand inconnu |
| `workplaceType` | string | 450/450 | 0 | **toujours** |
| `createdAt` | integer | 450/450 | 0 | **toujours** |
| `hostedUrl` | string | 450/450 | 0 | **toujours** |
| `applyUrl` | string | 450/450 | 0 | **toujours** |
| `description` | string | 450/450 | 4 | **toujours** |
| `descriptionPlain` | string | 450/450 | 15 | **toujours** |
| `descriptionBody` | string | 450/450 | 13 | **toujours** |
| `descriptionBodyPlain` | string | 450/450 | 39 | **toujours** |
| `opening` | string | 450/450 | **258** | **toujours**, vide 57 % du temps |
| `openingPlain` | string | 450/450 | **258** | **toujours**, vide 57 % du temps |
| `additional` | string | 450/450 | 19 | **toujours** |
| `additionalPlain` | string | 450/450 | 23 | **toujours** |
| `lists` | array | 450/450 | 52 | **toujours** |
| `salaryRange` | object | **146/450** | 0 | **absent** quand non publié |
| `salaryDescription` | string | **58/450** | 0 | **absent** quand non publié |
| `salaryDescriptionPlain` | string | **58/450** | 0 | **absent** quand non publié |

Trois formes d'absence coexistent :

- `salaryRange`, `salaryDescription` et `salaryDescriptionPlain` **disparaissent
  de l'objet** ;
- `country` reste présent et vaut `null` ;
- `opening`, `lists` et les textes restent présents et valent `""` ou `[]`.

`salaryDescription` et `salaryRange` sont **indépendants** : une offre porte une
description de salaire sans fourchette chiffrée.

**La description utile est `descriptionPlain`.** `openingPlain` est vide sur 258
offres, donc une fiche bâtie dessus rendrait un texte vide une fois sur deux.
`descriptionPlain` va de 0 à 17 725 caractères, médiane 1 653.

## `categories`, et ses clés optionnelles

| Clé | Présence sur 450 | Valeurs distinctes |
|---|---|---|
| `location` | 450/450 | 98 |
| `team` | 450/450 | 103 |
| `allLocations` | 450/450 | — |
| `commitment` | **420/450** | 17 |
| `department` | **371/450** | 35 |

`commitment` et `department` **manquent de l'objet** sur certains sites, et leur
absence se rend absente.

`allLocations` porte un lieu sur 425 offres, et jusqu'à neuf : 2 offres en
portent 9, 2 en portent 4, 7 en portent 3, 13 en portent 2.

## Le groupement, et son groupe sans titre

`group=team|location|commitment` rend un tableau de `{ title, postings[] }`, et
**`title` manque sur un des groupes**. Vérifié sur Spotify, dont le groupement
par type de contrat rend quatre groupes : `Full Time Contractor` (1),
`Permanent` (91), `Short Term` (4), et un quatrième sans titre portant 6 offres.

Ce groupe rassemble les offres dont le champ n'est pas renseigné. Il nomme un
manque, jamais un libellé : le proposer comme valeur de filtre offrirait un mot
que Lever n'accepte pas, et les 6 offres qu'il porte ne sont atteignables par
aucun filtre de ce champ.

Les compteurs des trois groupements somment au nombre d'offres publiées par le
site, ce qui est le seul total que l'API laisse calculer.

## Les vocabulaires

**`workplaceType` — trois valeurs observées, une quatrième documentée.**

| Valeur | Part |
|---|---|
| `remote` | 311 |
| `hybrid` | 121 |
| `onsite` | 18 |

La documentation annonce aussi `unspecified`, absent du corpus. Elle écrit
`on-site` avec un tiret là où la charge porte `onsite` sans tiret : **la charge
gouverne**. Le champ se déclare sans énumération fermée, puisque trois valeurs
observées ne font pas une liste close.

**`commitment`, `team`, `department`, `location` — vocabulaires ouverts, propres
à chaque entreprise.** `commitment` porte 17 valeurs distinctes sur huit sites,
dont trois graphies du même contrat : `Full-time`, `Full Time` et `Full-Time`,
auxquelles s'ajoutent `Employee India`, `EE Full-Time`, `Modified Full-Time`,
`Part-Time`. Aucune de ces valeurs ne se devine, et les filtres de Lever exigent
la valeur exacte : le vocabulaire d'un site se lit par `group=` avant de filtrer
dessus.

**Un filtre dont la valeur est inconnue rend `200 []` sans erreur.**
`team=Engineering` sur un site qui n'a pas cette équipe répond par une liste
vide, jamais par un message.

La casse compte seulement sur les valeurs multiples, comme la documentation
l'annonce. Une valeur seule passe dans n'importe quelle casse : `advisory` et
`Advisory` rendent les mêmes 3 offres. Deux valeurs exactes rendent 10 offres,
les deux mêmes en minuscules en rendent **0**.

## `salaryRange`

Présent sur 146 offres, toujours avec **exactement quatre clés**, jamais une de
plus ni de moins :

```jsonc
{ "min": 63.09, "max": 63.09, "currency": "USD", "interval": "per-hour-wage" }
```

| Propriété | Ce que le corpus montre |
|---|---|
| `interval` | `per-year-salary` (138), `per-hour-wage` (8) |
| `currency` | USD (140), CAD (2), GBP (2), INR (1), AUD (1) |
| `min` et `max` | nombres, `min` jamais supérieur à `max`, égaux sur 5 offres |

**Les deux périodes ne se comparent pas.** Un taux horaire de 63,09 USD face à un
seuil annuel de 60 000 n'est pas une comparaison. `interval` se rend tel quel,
sans annualisation.

`min` égal à `max` désigne un montant unique et se rend tel quel.

## Les formats

- `id` : UUID canonique de 36 caractères sur les 450.
- `hostedUrl` : commence par `https://jobs.lever.co/` et **contient l'id** sur
  les 450.
- `applyUrl` : vaut exactement `hostedUrl` suivi de `/apply` sur les 450.
- `createdAt` : entier, millisecondes depuis l'époque Unix. C'est la date à
  laquelle Lever a enregistré l'offre, et l'API n'en publie aucune autre : une
  offre rafraîchie garde la sienne. Le corpus s'étale du
  30 août 2017 au 13 août 2026, donc une annonce peut être très ancienne et
  toujours publiée.
- `country` : code ISO 3166-1 alpha-2, 22 valeurs distinctes, nul sur 2 offres.
- `lists` : tableau de `{ text, content }`, où `content` porte des `<li>` bruts.
  323 intitulés de rubrique distincts, sans vocabulaire commun :
  `Required Qualifications:`, `Responsibilities: `, `Responsibilities`, à
  l'espace et au deux-points près.

**`content` porte des entités HTML** : 555 rubriques du corpus en contiennent,
dont `&nbsp;` et `&amp;`. Elles se déséchappent, sans quoi le lecteur voit du
balisage.

## Ce que le serveur devra dire et ne pas dire

- `salaryRange` absent vaut « non publié », jamais zéro. 304 offres sur 450 n'en
  portent aucun, donc filtrer sur le salaire écarte deux offres sur trois en
  silence : le serveur doit dire combien il a écarté.
- `country: null` vaut « pays inconnu », jamais « sans pays ».
- `commitment` ou `department` absent vaut « le site ne le renseigne pas ».
- `opening` vide vaut « pas de préambule », et la description reste dans
  `descriptionPlain`.
- Un 404 sur un nom de site vaut « ce nom-là n'existe pas », jamais « cette
  entreprise n'est pas sur Lever ».
- Le paramètre `remoteType` n'existe pas ici, et `workplaceType` **n'est pas
  filtrable** : passé à l'API, il est accepté et ignoré. Vérifié, une requête
  portant `workplaceType=remote` rend 100 offres dont 24 `hybrid` et 9 `onsite`.
- Le filtre `level` est documenté et n'apparaît sur aucune des 450 offres : le
  serveur ne peut ni le valider ni le rendre.
- Aucune recherche plein texte n'existe, l'éditeur l'écrit. Le mot-clé
  s'applique chez nous, sur le texte déjà reçu.
