# ChoosyBuy — Pilot Handover & Operating Model

> **Read this first, together with `CLAUDE.md`.**
> `CLAUDE.md` = the **technical** source of truth (architecture, catalogs, data flow, gotchas).
> `HANDOVER.md` = the **current phase**, the goals, and **how we work** (the operating model).
> This file is for a fresh session (incl. Cowork) to take over with zero context loss.

---

## 0. How to use this file (for the new session)

On session start, do these in order:

1. Read `CLAUDE.md` end-to-end, then this file.
2. Confirm the current state (Section 1) is still accurate — run the health checks, don't assume.
3. Present the plan for the workstream the user wants to push (Section 2), and get approval before building.
4. Operate by the rules in Section 4 (lean, agentic, parallel, verification-gated).
5. Keep `CLAUDE.md` and this file current — update them at the end of each phase.

**Communication style the user wants (durable):** concise; **one question at a time**, never a long
bundled list; always explain the *implication* of each option; Hebrew is fine, but keep technical tokens
(filenames, commands) on their own lines so RTL/LTR mixing doesn't garble the text.

---

## 1. Where we are (verified 2026-06-21)

- **Product:** ChoosyBuy ("Choosy Kids") is **live at choosybuy.com** and the MVP is complete. The
  "2-not-3" tournament works end-to-end in prod and locally. Latest commit: mobile fit (`12bb93d`).
- **Catalogs:** 6 Israeli retailers, **79 catalog files**, 14 segments. Coverage per retailer:
  Terminal X 14 · NEXT 14 · Shilav 14 · Fox 14 · Glory 14 · Keds 9 (no swim).
- **Analytics:** anonymous feedback widget → Mixpanel. The **two closed feedback questions ARE the
  pilot KPIs** — decision-ease (1–5) and purchase-intent (would-buy yes/maybe/no). (See the Mixpanel
  transport gotcha in `CLAUDE.md` — never "tidy" the tracking call back to JSON.)
- **Done recently:** i18n (he/en toggle), vintage design face-lift, branded share preview (Open Graph),
  mobile one-screen fit. **W3 catalog classification fixed & deployed (2026-06-21):** the "red shirt"
  colour bug (print/accent word overriding the base colour) and a gender bug (Shilav skirts shown to
  boys) are fixed and verified live; see CLAUDE.md "Classification quality". An explainer-video brief
  for the CMO is in `docs/W1-explainer-video-brief.md`.
- **Monetization groundwork:** affiliate research was already started (Admitad investigated; catalogs
  carry an `affiliate_ready: false` flag). Not yet wired.
- **Phase:** **soft launch** to a small, focused parent audience (WhatsApp groups + a friends/parents
  focus group). Open threads from the last session: a light explainer video (tool chosen: Canva) to
  embed on the landing page, and the outreach message.

**Health checks (run to confirm state, don't trust this list blindly):**
```
node -e "require('./catalogs')"
node tools/audit-catalogs.js
curl -s -o /dev/null -w "choosybuy.com -> HTTP %{http_code}\n" "https://choosybuy.com/"
```

---

## 2. The five workstreams

Each has: **Goal · Definition of Done · Next actions · Owner agent · Go-to skills.**
Push them in parallel where independent; only serialize true dependencies.

### W1 — Go-to-market & messaging
- **Goal:** get the right parents to try Choosy and understand the value in 10 seconds.
- **Done when:** landing reassurance is crisp, the explainer video is embedded, and an outreach message +
  focus-group flow is ready to send.
- **Next:** (a) produce the explainer video plan/storyboard for Canva (the woman-overwhelmed →
  Choosy → doorbell concept); (b) finalize the WhatsApp outreach + focus-group invite; (c) tighten
  landing copy around the slogan **"לא לחפש, למצוא."**
- **Agent:** `growth-marketer` · **Skills:** `product-management:competitive-brief`,
  `product-management:product-brainstorming`, `deep-research`.

### W2 — Product (improve from feedback)
- **Goal:** turn pilot feedback + ideas into a prioritized, shippable backlog.
- **Done when:** there's a ranked Now/Next/Later list tied to the KPIs, each item with a one-line spec.
- **Next:** stand up a feedback intake → synthesis loop; spec the top 1–2 improvements before building.
- **Agent:** `product-strategist` · **Skills:** `product-management:synthesize-research`,
  `product-management:write-spec`, `product-management:roadmap-update`.

### W3 — Backend & catalog health
- **Goal:** every product shown is correctly classified (color + gender + category) and in-stock /
  shippable in Israel. Bad filtering during the pilot makes the product look broken.
- **Done when:** the classification audit is clean (or known-issues are documented), and there's a
  repeatable refresh routine.
- **Status (2026-06-21):** the "red 2–8 shirt" bug is FIXED (colour now picks the left-most/leading
  family in `get-pool.js`; Shilav skirts forced to girl). Audit noise cut 467→~112 false positives.
  Remaining, low-impact: ~13 TX items (overalls/shirts) filed under `bottoms` by TX's own taxonomy.
- **Next:** decide whether to fix the ~13 TX category items; otherwise W3 is in good shape.
- **Agent:** `catalog-engineer` · **Tools/tooling:** `tools/audit-catalogs.js`, the per-retailer builders.

### W4 — Monetization (affiliates)
- **Goal:** decide if/how Choosy can earn from outbound clicks **now**, without hurting the UX.
- **Done when:** there's a clear go/no-go per network (Admitad and the retailers' own programs), and if
  go — a plan to flip `affiliate_ready` and wrap the winner-screen "buy" links.
- **Next:** finish the affiliate-network feasibility (which IL retailers have programs, payout, link
  format, terms). Keep it research-only until the user approves any signup (spend/commitment gate).
- **Agent:** `growth-marketer` · **Skills:** `deep-research`, `product-management:competitive-brief`.

### W5 — Data & insights
- **Goal:** the pilot must *teach* us something — instrument the funnel and read it weekly.
- **Done when:** key events are tracked (start → who/what → refine → each duel → champion → feedback),
  and there's a simple weekly metrics read against the two KPIs.
- **Next:** verify the funnel events fire (Mixpanel proof, not assumption), define the metric set, and
  set up the weekly review.
- **Agent:** `data-analyst` · **Skills:** `product-management:metrics-review`,
  `product-management:synthesize-research`.

---

## 3. Subagent roster

Defined in `.claude/agents/`. Dispatch them for **delegated, parallel** execution; they each run in their
own context and report back, which keeps the main session lean. Map: W1+W4 → `growth-marketer`,
W2 → `product-strategist`, W3 → `catalog-engineer`, W5 → `data-analyst`.

**Honest guidance on when agents actually help:**
- **Big win — parallel execution of independent work:** e.g. audit 6 catalogs at once, draft 4 outreach
  variants at once, research 5 affiliate networks at once. Fan these out.
- **Small win — focused strategic thinking:** a single main-session pass with the right *skill* is often
  better than a subagent. Use the agent to *draft*; decide with the user in the main session.
- **Cost control:** for grunt work (audits, builders, scraping), dispatch the agent on a cheaper model
  (Sonnet). Keep strategy/writing on the strong model. Don't run five agents "always on" — that burns
  tokens for no gain. Spawn for a concrete deliverable, collect, move on.

---

## 4. Operating model — the rules

1. **One session per phase.** `/compact` when a session runs long; `HANDOVER.md` + `CLAUDE.md` carry the
   state across sessions. Don't let one session balloon (the prior build ran 75h / 10MB and replayed
   that context on every turn).
2. **Parallelize independent work via subagents; serialize only real dependencies.** Default to fan-out.
3. **Every task starts from a brief** (Goal / Context / Constraints / Definition-of-done / "don't proceed
   past step N without approval").
4. **Verification gates — evidence before "it works":**
   - After any tracking change: prove the event reached Mixpanel (HTTP 200 + `{status:1}`), don't infer
     from the UI.
   - After any catalog rebuild: `node tools/audit-catalogs.js` and read the report.
   - After any UI change: check mobile + browser console (no errors) via the preview/Playwright tools.
   - After deploy: HTTP-check `choosybuy.com`.
5. **Break a failing loop after 2 tries.** Stop, list the top hypotheses, add logging to confirm which,
   *then* fix. Never re-report the same symptom a third time.
6. **No large pastes in chat.** Save to a file and point to it (`@path`).
7. **Stop and ask the user only for:** security (deps, secrets, auth, sending data out), spend
   (paid infra/SaaS/domains), or irreversible actions (deleting files you didn't create, force-push,
   dropping data). Everything else: act.

---

## 5. Permissions (max-autonomy, already mostly set)

`.claude/settings.json` already has `defaultMode: "auto"` and allows node/npm/git/web/Playwright.
To reduce prompts further without lowering the guardrails, the new session may (with the user present)
consolidate a broad **read-only / dev** allow-list and remove the auto-accumulated one-offs in
`settings.local.json`. Suggested broad rules to add:
```
Bash(node tools/*)        Bash(node --check:*)      Bash(node -e:*)
Bash(grep:*)  Bash(ls:*)  Bash(cat:*)  Bash(curl -s:*)
Bash(git -C:*)            mcp__plugin_playwright_playwright__*
```
Keep the `deny` list (`.env`, `*.pem`, `secrets*`) intact. The fastest path: run the
`/fewer-permission-prompts` skill, which proposes an allow-list from the transcripts.

**Git push from the Cowork sandbox (Linux):** the Windows machine pushes via Git Credential Manager +
OS keyring — NOT portable to the sandbox, and the GitHub MCP connector can't drive its OAuth here
(`does not support dynamic client registration`). The working path is a **fine-grained PAT** (repo:
`talpinkas/choosybuy`, Contents: read/write) wired to a git credential `store` helper:
`git config --global credential.helper store` then write
`https://talpinkas:<PAT>@github.com` to `~/.git-credentials` (chmod 600). The sandbox is **ephemeral**,
so this resets each session — re-add the PAT (or have the user paste it) to push autonomously again.
Note: writing files via the editor tool can desync the shell mount for that file; if a committed file
looks truncated in `git diff`, rebuild it from `git show HEAD:<file>` and re-stage, or write via the
shell directly.

---

## 6. First actions for the new session (turnkey checklist)

1. Read `CLAUDE.md` + this file.
2. Run the Section 1 health checks; report any drift from the stated state.
3. Ask the user which workstream to push first (one question).
4. Request max relevant permissions (Section 5).
5. For the chosen workstream: present a short plan from the brief template, get approval, then dispatch
   the owner agent (parallel where possible).
6. Update `CLAUDE.md` / `HANDOVER.md` as state changes.

---

## 7. Definition of done for THIS handover

The new session can: guide the user in their preferred style, name and drive all five workstreams, work
agentically and in parallel, verify before claiming done, keep the MD files current, and operate within
the autonomy boundaries — all without re-asking for context that lives in these two files.
