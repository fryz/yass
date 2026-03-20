# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.

Available gstack skills:
- `/office-hours` — brainstorm ideas (YC-style forcing questions)
- `/plan-ceo-review` — CEO/founder strategy review
- `/plan-eng-review` — engineering architecture review
- `/plan-design-review` — designer's eye plan review
- `/design-consultation` — create a full design system + DESIGN.md
- `/review` — pre-landing PR code review
- `/ship` — ship workflow: merge, test, bump version, create PR
- `/browse` — headless browser for QA, screenshots, and dogfooding
- `/qa` — full QA test + fix loop
- `/qa-only` — QA report only (no fixes)
- `/design-review` — visual QA and design polish on live site
- `/setup-browser-cookies` — import real browser cookies for auth
- `/retro` — weekly engineering retrospective
- `/investigate` — systematic root cause debugging
- `/document-release` — post-ship documentation update
- `/codex` — OpenAI Codex second opinion / adversarial review
- `/careful` — safety guardrails for destructive commands
- `/freeze` — restrict edits to a specific directory
- `/guard` — full safety mode (careful + freeze combined)
- `/unfreeze` — remove directory edit restriction
- `/gstack-upgrade` — upgrade gstack to latest version

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
