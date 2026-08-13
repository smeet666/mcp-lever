# Esquisse : les outils et la forme rendue

Brouillon de travail, écrit depuis les sondes du 13 août 2026 consignées dans
`FEASIBILITY.md`. Il fixe ce que le serveur expose et ce qu'il rend, avant que
le plan ne fixe comment.

## L'entreprise se nomme, et le serveur la confirme

Le serveur n'embarque aucun annuaire. L'appelant nomme les entreprises,
`resolve_company` transforme chaque nom en identifiant de site, et l'API
confirme.

Une liste figée aurait vieilli d'un tiers par an, mesuré : sur 24 identifiants
d'une collecte de septembre 2025 testés onze mois plus tard, 9 avaient disparu.
Et un appelant l'aurait prise pour l'ensemble des clientes de Lever, alors
qu'elle n'en couvre qu'une part arbitraire.

Le plafond d'entreprises par appel se fixe dans `config.ts`, puisque chacune
coûte au moins une requête et une seconde.

## Les hôtes que le serveur a le droit de lire

`jobs.lever.co` ferme sa porte à six agents nommés, dont `ClaudeBot` et `CCBot`.
Le serveur ne lit que `api.lever.co` et `api.eu.lever.co`, qui n'excluent
personne.

Cette règle se tient par trois moyens, et pas seulement par la discipline :

1. **Une liste blanche d'hôtes dans la couche HTTP.** Toute adresse dont l'hôte
   n'y figure pas lève une erreur avant l'ouverture de la connexion.
2. **Un test qui espionne la couche HTTP** pendant toute la suite : chaque
   adresse effectivement demandée doit porter un hôte de la liste. Les champs
   `hostedUrl` et `applyUrl` traversent le rendu comme des chaînes et n'atteignent
   jamais le client HTTP, ce que le même test vérifie.
3. **Un canari qui relit les `robots.txt`** des hôtes lus, et échoue si une règle
   nouvelle vise notre agent, `ClaudeBot`, ou le chemin `/v0/postings/`. Un site
   qui change d'avis doit casser la construction plutôt que passer inaperçu.

Le `User-Agent` porte le nom du projet et une adresse de contact, et n'imite
aucun navigateur.

## Le récapitulatif

Ce que l'API permet, et ce qui mérite d'être exposé. Les deux colonnes sont
séparées, parce qu'un outil faisable et sans intérêt coûte des tokens à chaque
appel de `tools/list`.

| Outil envisagé | Faisable | Pertinent | Pourquoi |
|---|---|---|---|
| `resolve_company` | oui | **oui** | Rien ne s'appelle sans un site nommé, et le nom ne se devine pas à tous les coups |
| `search_jobs` | oui | **oui** | Le cœur du serveur, `companies` requis |
| `get_job` | oui | **oui** | Une liste ne peut pas porter le texte : 25 offres pèsent déjà 466 Ko |
| `list_filter_values` | oui | **oui** | Une valeur inconnue rend `200 []` sans erreur, donc le vocabulaire se lit avant de filtrer |
| Recherche sans entreprise nommée | **non** | — | Aucun index ne traverse les clientes de Lever |
| Annuaire d'entreprises embarqué | oui | **non** | Une liste figée vieillit d'un tiers par an et se lit comme l'ensemble des clientes, ce qu'elle n'est pas |
| Recherche plein texte chez Lever | **non** | — | L'éditeur écrit que l'API ne le fait pas ; le mot-clé s'applique chez nous |
| Annuaire des entreprises clientes | **non** | — | Aucune route ne les énumère |
| Formulaire de candidature d'une offre | **non** | — | L'éditeur écrit que les questions personnalisées ne sont pas exposées |
| Fiche d'entreprise | partiellement | **non** | Aucune route ne la publie ; la déduire des offres inventerait un profil |
| Candidater à une offre | oui | **non** | Une route `POST` existe et ces serveurs n'écrivent nulle part |
| Statistiques de salaire | oui | **non** | 14 offres sur 50 publient un salaire, et les périodes diffèrent : la moyenne mentirait |
| Rendu HTML ou iframe | oui | **non** | Destiné à l'inclusion dans une page carrières, sans usage pour un agent |
| Offres récentes | oui | **non** | `posted_within_days` sur `search_jobs` y répond sans outil de plus |

## Les quatre outils

Enregistrés dans cet ordre, qui est celui du rendu. Les requêtes qu'ils coûtent :

| Outil | Requêtes réseau |
|---|---|
| `resolve_company` | une par forme et par instance, deux au mieux, huit au pire |
| `search_jobs` | la résolution, puis une par entreprise |
| `get_job` | une |
| `list_filter_values` | une par regroupement demandé |

Un cache de résolution tenu pour la session évite de payer deux fois la même
entreprise, et un `companies` portant déjà un identifiant exact évite l'échelle
de formes.

### `resolve_company`

Le nom d'une entreprise en entrée, son identifiant de site Lever en sortie.
Aucun autre outil ne peut travailler sans lui, puisque Lever n'offre aucune
recherche transverse et exige un site nommé.

```jsonc
{ "name": "Included Health" }
```

Le serveur essaie les formes connues dans l'ordre — minuscules collées,
capitale initiale, premier mot seul, forme à tiret — sur l'instance globale puis
l'européenne, et **s'arrête à la première que Lever confirme**.

```jsonc
{
  "resolved": { "slug": "includedhealth", "instance": "global", "publishes": true },
  "tried": ["includedhealth"],
  "notes": []
}
```

Ce qu'il rend quand rien ne répond dit ce qui a été essayé, plutôt que d'affirmer
une absence :

```jsonc
{
  "resolved": null,
  "tried": ["mitek", "Mitek", "miteksystems", "mitek-systems"],
  "notes": ["Aucune de ces formes n'existe sur Lever. L'identifiant d'un site est sensible à la casse et ne dérive pas toujours du nom de l'entreprise, donc ce résultat ne prouve pas que Mitek Systems soit absente de la plateforme."]
}
```

Cette note est l'invariant du serveur. **Un 404 ne prouve rien**, puisque `flex`
répond 404 et `Flex` rend 35 offres.

### `search_jobs`

Une ou plusieurs entreprises en entrée, une liste d'offres en sortie. Le
paramètre `companies` est requis, et sa description dit pourquoi : Lever ne
publie aucun index traversant ses clientes.

| Argument | Type | Où il s'applique |
|---|---|---|
| `companies` | string[] | requis, noms ou identifiants de site |
| `keyword` | string | chez nous, sur l'intitulé et le texte |
| `location`, `team`, `department`, `commitment`, `level` | string[] | chez Lever, valeur exacte |
| `workplace_type` | enum[] | chez nous, `onsite` `remote` `hybrid` `unspecified` |
| `country` | string[] | chez nous, ISO 3166-1 alpha-2 |
| `salary_min`, `currency` | number, string | chez nous, sur les offres qui publient un salaire |
| `posted_within_days` | integer | chez nous, sur `createdAt` |
| `limit`, `skip` | integer | chez Lever, `limit` plafonné par le serveur |

Les filtres de Lever exigent la valeur exacte et distinguent la casse. Un filtre
que le site refuse fait réessayer sans lui, et la note nomme ce qui a été écarté.

Sortie :

```jsonc
{
  "jobs": [ /* la ligne décrite plus bas */ ],
  "per_company": [
    { "company": "Included Health", "slug": "includedhealth", "status": "read", "returned": 25 },
    { "company": "Mitek Systems", "slug": null, "status": "unresolved", "returned": 0 }
  ],
  "has_more": true,
  "total_available": null,
  "notes": []
}
```

`per_company` porte l'honnêteté de l'agrégation : une entreprise lue, une
entreprise sans identifiant trouvé et une entreprise en panne sont trois états
différents, et une liste qui les confond ment sur ce qu'elle couvre.

`total_available` vaut `null`. Lever ne publie aucun compteur, et le nombre de
lignes d'une page ne mesure rien.

### `get_job`

Un identifiant de site et un identifiant d'offre, la fiche complète en sortie,
texte et rubriques compris. Un identifiant inconnu répond 404 chez Lever, donc
`not_found` chez nous.

### `list_filter_values`

Un identifiant de site, et le vocabulaire réel de ce site en sortie, lu par
`group=team`, `group=location` et `group=commitment`.

Cet outil existe parce que les filtres de Lever exigent la valeur exacte :
`team=Engineering` rend une liste vide sur un site dont l'équipe s'appelle
autrement. Le vocabulaire appartient à chaque entreprise, et il se lit avant de
filtrer dessus.

## Ce que le serveur n'expose pas

- Une recherche sans entreprise nommée. L'API n'en offre aucune, et un outil qui
  en promettrait une rendrait le vide.
- Un tri par salaire. 14 offres sur 50 en publient un dans le corpus sondé.
- Un compteur de résultats. Lever n'en publie aucun.

## La fiche, telle qu'elle est rendue

Deux formes, la ligne de liste et la fiche complète, la seconde étendant la
première.

### La ligne, rendue par `search_jobs`

Construite depuis une offre réelle d'Included Health :

```json
{
  "id": "6f97a19f-c047-426e-9237-9c67829eacbf",
  "title": "Remote Mental Health Therapist",
  "company": "Included Health",
  "company_slug": "includedhealth",
  "location": "Remote",
  "all_locations": ["Remote"],
  "country": "US",
  "workplace_type": "remote",
  "commitment": "Contractor",
  "team": "General Interest",
  "department": "Clinical & Behavioral Health",
  "salary": { "min": 63.09, "max": 63.09, "currency": "USD", "interval": "per-hour-wage" },
  "posted_at": "2026-02-03T18:00:08.607Z",
  "url": "https://jobs.lever.co/includedhealth/6f97a19f-c047-426e-9237-9c67829eacbf",
  "apply_url": "https://jobs.lever.co/includedhealth/6f97a19f-c047-426e-9237-9c67829eacbf/apply",
  "instance": "global"
}
```

### La fiche complète, rendue par `get_job`

Les mêmes champs, plus le texte :

```jsonc
{
  // … tous les champs de la ligne …
  "description": "…",
  "sections": [
    { "heading": "Responsibilities:", "items": ["Perform age-appropriate history and virtual examinations…", "…"] },
    { "heading": "Required Qualifications", "items": ["Completion of a 3-year Family Medicine or Emergency Medicine residency", "…"] }
  ],
  "salary_note": null,
  "source": {
    "site": "Lever",
    "retrieved_from": "https://api.lever.co/v0/postings/includedhealth/1a0a2e39-a95d-467d-b24e-54bc4479edb0"
  }
}
```

## Les règles de rendu

Elles viennent du corpus et gouverneront les tests.

1. **`salary` absent se rend `null`**, jamais zéro. 36 offres sur 50 n'en
   publient aucun, et un `0` sur une échelle qui commence à zéro se confond avec
   un salaire nul.
2. **`interval` se rend tel que Lever l'écrit**, `per-year-salary` ou
   `per-hour-wage`, sans conversion. Un taux horaire annualisé chez nous serait
   un chiffre que personne n'a publié.
3. **`min` et `max` égaux se rendent égaux.** Un montant unique existe.
4. **`country: null` se rend `null`**, et vaut « pays inconnu ».
5. **`all_locations` se rend en tableau**, jamais recollé en chaîne, et
   `location` reste le lieu principal que Lever désigne.
6. **`workplace_type: "unspecified"` se rend tel quel**, jamais traduit en
   « sur site ». Les valeurs observées sont `remote`, `hybrid` et `onsite`, cette
   dernière s'écrivant sans tiret dans la charge là où la documentation la note
   `on-site`. Le serveur suit la charge.
11. **Une valeur de filtre que Lever ne connaît pas rend une liste vide sans
    erreur.** `team=Engineering` sur un site qui n'a pas cette équipe répond
    `200 []`. Le serveur vérifie donc la valeur contre le vocabulaire du site
    avant d'appeler, et une valeur absente devient `invalid_input` avec les
    valeurs permises, plutôt qu'une absence fabriquée.
7. **Un site non résolu se dit non résolu**, avec les formes essayées, et jamais
   comme une entreprise sans offre.
8. **Les entités HTML se déséchappent.** Le texte des rubriques porte `&nbsp;`
   dans la charge, et le rendre tel quel montre du balisage au lecteur.
9. **`posted_at` se convertit en ISO 8601 UTC** depuis les millisecondes de
   `createdAt`, sans changer l'instant.
10. Le texte venu du site ne doit pas pouvoir imiter une ligne que le serveur
    écrit : les préfixes `Note:` et `Source:` se décalent.

## Ce qui reste ouvert

- La source des noms d'entreprises, en amont de `resolve_company`.
- La stratégie des deux instances : sonder les deux à chaque fois, ou mémoriser
  celle d'un site et accepter une erreur le jour d'un déménagement.
- Le plafond de `limit`, sachant qu'une réponse sans plafond a pesé 48 Mo.
