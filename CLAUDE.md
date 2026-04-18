# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.

Available gstack skills:
- `/office-hours` — brainstorm ideas (YC-style forcing questions)
- `/plan-ceo-review` — CEO/founder strategy review
- `/plan-eng-review` — engineering architecture review
- `/plan-design-review` — designer's eye plan review
- `/design-consultation` — create a full design system + DESIGN.md
- `/design-shotgun` — rapid design exploration with multiple directions
- `/design-html` — generate HTML/CSS design mockups
- `/review` — pre-landing PR code review
- `/ship` — ship workflow: merge, test, bump version, create PR
- `/land-and-deploy` — land PR and deploy to production
- `/canary` — canary deploy workflow
- `/benchmark` — performance benchmarking
- `/browse` — headless browser for QA, screenshots, and dogfooding
- `/connect-chrome` — connect to a running Chrome instance
- `/qa` — full QA test + fix loop
- `/qa-only` — QA report only (no fixes)
- `/design-review` — visual QA and design polish on live site
- `/setup-browser-cookies` — import real browser cookies for auth
- `/setup-deploy` — configure deployment settings
- `/retro` — weekly engineering retrospective
- `/investigate` — systematic root cause debugging
- `/document-release` — post-ship documentation update
- `/codex` — OpenAI Codex second opinion / adversarial review
- `/cso` — chief security officer security review
- `/autoplan` — automatic planning for complex tasks
- `/plan-devex-review` — developer experience plan review
- `/devex-review` — developer experience review
- `/careful` — safety guardrails for destructive commands
- `/freeze` — restrict edits to a specific directory
- `/guard` — full safety mode (careful + freeze combined)
- `/unfreeze` — remove directory edit restriction
- `/gstack-upgrade` — upgrade gstack to latest version
- `/learn` — learn about the codebase

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
