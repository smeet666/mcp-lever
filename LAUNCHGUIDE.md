# mcp-lever

**What it is.** An MCP server for the public job boards companies publish
through Lever. No API key, no account, read-only.

**Install.** `npx mcp-lever`

**Tools.** `resolve_company`, `search_jobs`, `get_job`, `list_filter_values`.

**Why it exists.** Lever hosts one board per company and publishes no index
across them, so a job search there starts with a company name. This server turns
a name into the site name that addresses its board, reads the openings of the
companies you name, and says plainly what it could not find: a site name that
does not exist, a site publishing nothing, and a failed read are three different
answers.

**Repository.** https://github.com/smeet666/mcp-lever
