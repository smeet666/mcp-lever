# Security policy

## Reporting

Report a vulnerability through
[GitHub security advisories](https://github.com/smeet666/mcp-lever/security/advisories/new),
or by opening an issue when the matter is not sensitive. Expect an
acknowledgement within a week.

## What this server does

It reads two public Lever hosts over HTTPS, `api.lever.co` and
`api.eu.lever.co`, and nothing else. Any other address is refused before a
connection opens. It holds no credential, writes nowhere, and stores nothing on
disk.

## What reaches a model

Job adverts are written by the companies that publish them, so their text is
third-party content. Every line of it that this server renders is shifted when it
opens with `Note:` or `Source:`, and newlines are collapsed in the fields that
are written on a line of their own, so published text cannot pass for a line the
server wrote.

## Pacing

One request at a time, one second apart, which is the `Crawl-delay` both hosts
publish. Configuration widens that interval and never narrows it, including
through the published client entry point.
