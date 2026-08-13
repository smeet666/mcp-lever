# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
