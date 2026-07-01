# CHOOSY org map (authoritative)

One map of who does what. If another file contradicts this one, this one wins.
Updated: 2026-07-02. Owner: the CEO agent maintains this file, Tal approves changes.

## The four levels

1. **Owner — Tal.** Approves: any spend, anything irreversible, external publishing,
   contacting real people, and messages in his name. Touch points: the control room
   (tal-system/O-output/control-room.html), the morning brief, board meetings, and
   the open-decisions queue in docs/decision-log.md.
2. **HQ — tal-system.** Identity, standards, memory, the projects registry, and the
   orchestrator (chief of staff across ALL of Tal's projects). The orchestrator
   prioritizes BETWEEN organizations. It does not manage inside CHOOSY.
3. **Management — judgment roles.** Live in `.claude/agents/`, built to the Adi
   standard. They advise, frame decisions, and direct execution agents within
   pre-approved boundaries. Tal decides.
4. **Execution — task agents and skills.** Tools that managers dispatch. They do,
   they do not decide.

## Management roster

| Role | File | Status |
|---|---|---|
| CEO | `.claude/agents/ceo.md` | Active. Runs the team, owns decision-log and org.md, time-boxes decisions. |
| CPO — Adi | `.claude/agents/adi-cpo.md` | Active. Product strategy, discovery, choice architecture. |
| CTO | — | Not built. CEO to propose scope and timing. |
| CMO | — | Not built. Build when marketing becomes a standing workstream. growth-marketer covers execution until then. |
| Data analyst | — | Judgment role deferred until expanded-pilot data exists. data-analyst covers execution. |

## Execution roster

| Agent | File | Reports to |
|---|---|---|
| catalog-engineer | `.claude/agents/catalog-engineer.md` | CTO (until built: CEO) |
| data-analyst | `.claude/agents/data-analyst.md` | CEO |
| growth-marketer | `.claude/agents/growth-marketer.md` | CEO |

## Authority model (locked 2026-07-02, from Tal's interview)

- Default: everything requires Tal's approval.
- Pre-approved for the CEO now: creating and changing agents and management roles.
- NOT approved (Tal only): external publishing, contacting real people, any spend
  or payment, sending messages in Tal's name.
- The CEO may direct managers/agents to execute only what Tal already pre-approved
  for them. Anything irreversible requires Tal.
- Approval requests queue in docs/decision-log.md → "Open decisions", so Tal
  reviews them in one place (e.g. during a nightly/async session, requests wait
  there for the morning).

## Deprecated

The role stubs in tal-system/A-agents (cto.md, cpo.md, cmo.md, copywriter.md,
researcher.md, networking.md) are ARCHIVED skeletons from before this map. Do not
dispatch them for CHOOSY work. Adi's vault copy in A-agents/adi-cpo.md mirrors the
authoritative file here.
