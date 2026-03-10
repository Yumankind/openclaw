---
name: business-memory-public
description: "Read and update the shared public business knowledge base. Use when answering questions about the business that any external user could know, or when a manager confirms that new information is safe to publish publicly."
metadata: { "openclaw": { "emoji": "📖" } }
---

# Business Public Memory

The public business knowledge base lives at `business/PUBLIC_MEMORY.md` inside the
agent workspace. It contains facts, FAQs, pricing, policies, and any information
the business is happy to share with external users.

## When to use

- **Reading:** Answer a user question about the business (opening hours, pricing, services, policies, contact info, etc.).
- **Writing:** A manager or admin confirms that new information is public-safe and should be persisted for future users.

## File location

```
<workspace>/business/PUBLIC_MEMORY.md
```

`<workspace>` is the value of `agents.defaults.workspace` in config (typically
`~/.openclaw/workspace`).

## Reading public memory

At the start of every session, read this file to load current business context:

```bash
cat business/PUBLIC_MEMORY.md 2>/dev/null || echo "(no public memory yet)"
```

## Answering user questions

1. Check `business/PUBLIC_MEMORY.md` for a matching fact.
2. If found → answer directly, citing the memory.
3. If not found → check the user's own private memory (see `user-private-memory`
   skill) for any prior answers given to this user.
4. If still not found → escalate to a manager (see `business-escalation` skill).

## Writing to public memory

When a manager confirms information is public-safe:

```bash
# Append a new fact (create file if missing)
cat >> business/PUBLIC_MEMORY.md <<'EOF'

## <Topic>

<Fact or FAQ here>

_Added: <ISO date>_
EOF
```

Or edit a specific section with the `edit` tool to update an existing entry.

## File format

Use plain Markdown with `## <Topic>` headings. Example:

```markdown
# Business Public Memory

## Opening Hours

Monday–Friday: 09:00–18:00
Saturday: 10:00–14:00
Sunday: Closed

## Pricing

Starter plan: $49/month
Pro plan: $149/month
Enterprise: contact sales@example.com

## Refund Policy

Full refund within 30 days of purchase, no questions asked.
```

## Rules

- Never write private, role-gated, or user-specific information here.
- Prefer concise, factual entries over long prose.
- When in doubt about whether something is public, ask a manager before writing
  (see `business-escalation` skill).
