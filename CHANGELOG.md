# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-08-14

- The README carries the same badge row as every server here: npm, CI, the
  licence, the MCP registry entry, the Glama score, and one-click installs for
  Cursor and VS Code. Each install link encodes this package. npm serves the
  README frozen at publish time, so a release is what puts it there.

## [1.0.1] - 2026-08-14

### Fixed

- A recency search says which date it filtered on. Lever publishes the date it
  recorded an opening and no other, so an opening a company republished keeps
  its first one, and recency measures when a role was first posted.
- A read served from the cache no longer reports itself as fresh. An absence
  replayed from the cache, and a resolution whose every probe came from it, both
  say so.

## [1.0.0] - 2026-08-13

This release fixes what the tools promise. See **Stability** in the README for
the surface a major version covers and the changes that stay minor.

### Changed

### Changed

- `resolve_company` takes `names`, a list, and reports each one. Probing ten
  companies costs ten resolutions, where a search would read ten boards to
  answer the same question. Its output moves under `resolved`, one entry per
  name, each carrying whether this session had already resolved it.

### Added

- A near miss is offered from the site names Lever confirmed during the session,
  so a spelling that fails next to one that worked is named.
- `posted_within_days` walks up to five pages per company. Lever pages by title,
  so a recent opening sits anywhere in a board.

### Fixed

- Grouped reads no longer fail on the group Lever returns without a title, which
  holds the openings carrying no value for that field. It is reported as the gap
  it names.
- Failures are recognised by shape rather than class identity, which failed
  across the two entry points this package ships and reached callers blank.
- An argument named after part of a declared one is suggested: `slug` points at
  `company_slug`.

## [0.1.0] - 2026-08-13

### Added

- `resolve_company`, which turns a company name into the Lever site name that
  addresses its board, trying four spellings on both Lever instances and
  reporting every instance that answered.
- `search_jobs`, which reads the openings of named companies. Location, team,
  department and commitment are sent to Lever; keyword, workplace type, country,
  salary and recency are applied here, because Lever accepts none of them.
- `get_job`, which reads one opening in full, with its named sections.
- `list_filter_values`, which publishes the wordings one company uses, since
  Lever answers a wording it does not know with an empty list and no error.
- A published low-level client under the `./client` subpath, carrying the
  pacing, the cache and the error taxonomy without the protocol.

### Notes the answers carry

- Counts of what a filter dropped, each taken over every opening read, with the
  warning that one opening turned away twice appears in both.
- The reminder that filters applied here see only the openings a call read, so
  their figures are a share of that window and no share of what a company
  publishes.
- The openings Lever files under no wording for a field, which no filter on that
  field can reach.
