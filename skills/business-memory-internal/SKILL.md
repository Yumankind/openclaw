---
name: business-memory-internal
description: "Read and update role-gated internal business memory. Use for information that is internal to the team (not for external users): procedures, pricing tiers, staff notes, escalation rules, and other non-public facts. Only agents that are managers or admins should write to this memory."
metadata: { "openclaw": { "emoji": "🔒" } }
---

# Business Internal Memory

Internal memory files live under `business/internal/` in the agent workspace.
They contain non-public business information that should never be shared with
external users, but is available to internal agents (managers, admins).

## File layout

```
<workspace>/
  business/
    ROLES.md                 ← who the managers/admins are (channel + description)
    internal/
      INTERNAL_MEMORY.md     ← shared internal facts (all staff)
      roles/
        manager.md           ← manager-only notes
        admin.md             ← admin-only notes
```

## When to use

- **Reading:** An internal agent or manager session needs context (procedures,
  cost structures, staff instructions, escalation rules, etc.).
- **Writing:** A manager or admin wants to store a new internal fact or update
  an existing procedure.
- **Role check:** Before sharing any of this content outward, verify the
  requesting session is an internal/manager/admin channel — **never leak
  internal memory to an external user**.

## Reading internal memory

```bash
# Shared internal facts
cat business/internal/INTERNAL_MEMORY.md 2>/dev/null || echo "(no internal memory yet)"

# Manager-specific notes
cat business/internal/roles/manager.md 2>/dev/null || echo "(no manager notes yet)"

# Admin-specific notes
cat business/internal/roles/admin.md 2>/dev/null || echo "(no admin notes yet)"
```

## Who is a manager / admin?

Load `business/ROLES.md` to see which channels/users have elevated roles:

```bash
cat business/ROLES.md 2>/dev/null || echo "(no roles defined yet)"
```

`ROLES.md` format:

```markdown
# Business Roles

## Managers

- **Alice** — Slack: @alice, Discord: alice#1234 — Customer success & escalations
- **Bob** — Telegram: @bob_ops — Operations & logistics

## Admins

- **Carol** — Webchat (internal channel) — System administration
```

Only the agents/sessions listed in `ROLES.md` should receive escalations and
have write access to internal memory.

## Writing to internal memory

```bash
# Append a shared internal fact
cat >> business/internal/INTERNAL_MEMORY.md <<'EOF'

## <Topic>

<Internal fact or procedure>

_Added by: <role> / <date>_
EOF
```

```bash
# Append a manager-only note
mkdir -p business/internal/roles
cat >> business/internal/roles/manager.md <<'EOF'

## <Topic>

<Manager-only detail>

_Added: <date>_
EOF
```

## Rules

- **Never** expose internal memory content to external users.
- When an external user's question requires internal knowledge, escalate via the
  `business-escalation` skill — do not copy internal facts into the public reply.
- Managers may promote internal facts to public memory by explicitly saying
  "this is public" (see `business-memory-public` skill).
- Keep `ROLES.md` up to date whenever a manager or admin changes.
