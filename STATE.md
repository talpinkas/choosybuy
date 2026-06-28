# STATE — live session handoff (2026-06-25)

Read this FIRST in a new session, alongside CLAUDE.md and memory.

## Current phase
Single-site pilot on NEXT. Building a clean, rich catalog + preparing the expanded pilot. Full engine deferred (instrument duels DURING the pilot; build the engine AFTER).

## What is running right now
`node tools/classify-vision.js` — vision re-classification of all ~9,132 NEXT products via OpenAI gpt-4o-mini (image+title -> gender/category/color/color2/pattern/theme/style/kids). Writes data/classifications.json, checkpointed every 50, 429-safe, resumable. Last check ~3,900/9,132 done, <1% fail. RESUME = re-run the same command (needs $env:OPENAI_API_KEY). ~1-1.5h left at the account rate limit. Quality spot-checked = good. ~32% come back unisex (heavy dual-listing) — decide later whether to keep unisex->both.

## Catalog pipeline (order)
1. Scrape (DONE): tools/scrape-next.js (CDP to real Chrome, bypasses Akamai) -> data/next-data.json (~9,132).
2. Vision classify (IN PROGRESS): tools/classify-vision.js -> data/classifications.json.
3. Build: tools/import-next-data.js (consumes classifications.json; vision gender/category/color override; stores pattern/theme/style/color2; drops kids=false). WIPES catalogs, writes NEXT-only.
4. Visual check: tools/gen-gallery.js -> next-catalog-check.html.
5. QA: tools/audit-next.js (>=50 gate, gender dual, category, color).
6. Deploy (APPROVED once verified): commit + push -> Vercel. Do NOT wait for the engine.

## CRITICAL data rule (caused a data-loss incident)
data/next-data.json is authored by the LOCAL scraper on the CEO machine. The sandbox mount can be STALE for large files. NEVER write large data files back from the sandbox (it once overwrote 11,301 products with a stale 6,559). Heavy builds/scrapes run on the CEO machine; the sandbox only reads small summaries or has the CEO run commands.

## Decisions locked this session (also in memory)
- Messaging/onboarding (mode-2) BEFORE engine; engine NOT a gate for the expanded pilot.
- Engine objective = BINARY conversion only for now; transaction-value deferred to advanced stages after proven binary performance; still passively LOG willingness-to-pay.
- Positioning: hunting (ציד) not gathering (ליקוט); hunting converts via efficiency+confidence; value-by-fit not upsell; "better hunt -> higher conversion" is a falsifiable hypothesis the pilot tests.
- Deploy the cleaned catalog once verified (do not wait for engine).
- Expand cohort only after: clean catalog live + mode-2 message ready + duel-logging active.
- Ways of working: plan-first for code; data source-of-truth rule; big outputs via subagent; batch/async default; use skills (testing-strategy, write-spec, code-review); seamless handoff.
- Be critical, not sycophantic.

## Expanded pilot (plan: docs/expanded-pilot-recruitment.md)
Target ~50 QUALIFIED engaged-with-feedback (not 100 raw). Lead WARM; screen for active purchase intent (2 questions); START WITHOUT incentive (CEO concern: overjustification + gaming); hold a modest completion-gated raffle in reserve for the cold push only if feedback rate is low. Funnel: ~400 warm touches -> ~200 clicks -> ~100 activated -> ~50 feedback.

## Coming-days focus (CEO)
Catalog + duel-quality validation; small UX/design polish; build mode-2 message + marketing material; launch the expanded pilot.

## Catalog architecture — DECIDED 2026-06-28 (see docs/catalog-architecture-decisions.md)
CPO meeting locked the category/filter architecture. Headline cats per segment;
swim headline for all (summer); bodysuits headline 0-2; multipack→filter;
outfit-sets dissolve into garment cats + is_set flag; accessories split to
hats/socks/bags/sunglasses (2-8 only), rest archived; filters = budget/color/vibe/
sale + adaptive multipack/"no-sets"; theme REMOVED; unisex→both. Governing rule:
"protected minimum pool" (floor 8, live-count+disable, auto-relax thin cells).
Mockup: catalog-filter-mockup.html (mockup only — real design/logo unchanged).

## Open / next steps
1. classify-vision.js — DONE (catalogs built locally, NEXT-only, 36 files).
2. IMPLEMENT the new architecture (docs/catalog-architecture-decisions.md):
   A. import-next-data.js (accessories split, sets dissolve, archive rules, girl-2-8 bottoms fix)
   B. get-pool.js (expose style/in_pack/is_set/sale)
   C. app.js+UI (SEGMENT_CATS, 2-tier grouping, adaptive filters; keep design)
3. CEO runs rebuild on local machine (large data — NOT sandbox): import -> registry -> audit-next -> gen-gallery -> visual approval.
4. Deploy cleaned catalog (commit+push; bash tools/load-push-token.sh if push auth missing).
5. Add duel-logging (every duel as preference data) — engine fuel during the pilot.
6. mode-2 onboarding/message + a simple marketing asset.
7. Recruitment per the funnel doc.
8. PENDING (CEO request): build a "board-meeting" SKILL that reproduces the deck dynamic — role reports (CPO/CTO/Data/CMO/AI-Ops), 4-quadrant (was/learned/recommend/decisions), readiness scorecard, decisions slide with team-lean, Now/Next/Later plan, brand-styled navigable HTML deck, interactive (present -> decision-by-decision -> lock week plan). Use skill-creator, package as .skill.
9. Backlog: automated tests + runbook for the pipeline.

## Key artifacts
docs/catalog-architecture-decisions.md (NEW — category/filter architecture + impl brief), catalog-filter-mockup.html (NEW — layout mockup), docs/recommender-strategy.md, docs/ways-of-working.md, docs/expanded-pilot-recruitment.md, docs/pilot-site-decision.md, board-meeting.html. private/ holds pilot cohort + feedback (gitignored; participant names NEVER in the repo).
