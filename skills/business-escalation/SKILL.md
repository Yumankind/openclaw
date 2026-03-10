---
name: business-escalation
description: "Escalate an unanswered question to a business manager or admin via the internal channel using sessions_send. Use when you cannot answer from public memory or private user memory. After the manager replies, save the answer to the correct memory tier (public or private) based on the manager's guidance."
metadata: { "openclaw": { "emoji": "📨" } }
---

# Business Escalation

When the agent cannot answer a question from public memory or private user
memory, it must escalate to a manager or admin using the internal channel
(`sessions_send`). The manager replies inside that session, and the answer is
saved to the appropriate memory tier.

## Prerequisites

1. `business/ROLES.md` must list the managers/admins with their internal session
   labels (see `business-memory-internal` skill).
2. Multi-agent routing must be configured so that manager/admin sessions have
   labels registered in `agents.list` (e.g., `id: "internal"` or individual
   manager agent IDs).
3. `tools.agentToAgent.enabled: true` must be set in gateway config for
   cross-agent `sessions_send` calls.

## Escalation workflow

### Step 1 — Check both memory tiers first

Before escalating, always verify:

```bash
# 1. Public memory
cat business/PUBLIC_MEMORY.md 2>/dev/null

# 2. User private memory
cat "business/users/<channel>/<userId>.md" 2>/dev/null
```

Only escalate if neither tier has the answer.

### Step 2 — Identify the right manager

Load `business/ROLES.md` and pick the most relevant manager or admin for the
question. Use their `sessionLabel` or `agentId` to address `sessions_send`.

```bash
cat business/ROLES.md
```

Pick the first available manager for the topic. If unsure, use the default
admin session (usually labeled `"internal"` or `"admin"`).

### Step 3 — Send the escalation

Use `sessions_send` to forward the question to the manager session. Include:

- The original user question (verbatim).
- The channel and user identifier.
- Whether you already searched both memory tiers.

```json
{
  "tool": "sessions_send",
  "args": {
    "label": "<manager-session-label>",
    "message": "❓ Escalation from <channel>/<userId>:\n\nQuestion: \"<user question verbatim>\"\n\nI checked PUBLIC_MEMORY.md and the user's private memory — no matching answer found.\n\nPlease reply using this format:\nANSWER: <the answer to send back to the user>\nPUBLIC: yes|no  (save to public memory for all users?)\nNOTES: <optional internal notes, not shown to user>",
    "timeoutSeconds": 120
  }
}
```

Adjust `timeoutSeconds` based on urgency. Use `0` for fire-and-forget if the
user can wait asynchronously.

## Expected manager reply format

Managers should reply to escalations using this structured format so the agent
can parse the answer and routing decision unambiguously:

```
ANSWER: <full answer to send to the user>
PUBLIC: yes|no
NOTES: <optional — internal context not forwarded to the user>
```

- **`ANSWER:`** — the text to relay to the external user (required).
- **`PUBLIC: yes`** — save to `business/PUBLIC_MEMORY.md` (any user can benefit from it).
- **`PUBLIC: no`** — save only to the requesting user's private memory file.
- **`NOTES:`** — optional internal context stored in the manager's own session
  (never forwarded to external users).

If the manager's reply does not follow this format, treat the entire reply as
the `ANSWER`, default `PUBLIC` to `no` (private), and omit `NOTES`.

### Step 4 — Relay the manager's reply to the user

Once `sessions_send` returns a reply:

1. Parse the `ANSWER:` field (or full reply if unstructured).
2. Send the answer back to the original user on their channel.
3. Tell the user the answer came from the team (you do not need to identify the
   manager by name).

### Step 5 — Save the answer to memory

Based on the `PUBLIC:` field in the manager's reply (or defaulting to private
if unstructured), save to the appropriate memory tier:

**If public:**

```bash
cat >> business/PUBLIC_MEMORY.md <<'EOF'

## <Topic (derived from question)>

<Answer verbatim or paraphrased>

_Added: <ISO date> via manager escalation_
EOF
```

**If private (user-specific):**

```bash
mkdir -p "business/users/<channel>"
cat >> "business/users/<channel>/<userId>.md" <<'EOF'

## <Topic / date>

<Answer verbatim>
Source: Manager escalation (<date>).
_Saved: <ISO date>_
EOF
```

**If the manager says "do not save":** respect that and do not write to either
memory file.

## Sending a message to the business owner or manager directly

Use `sessions_send` with the `label` field set to the manager's session label
from `ROLES.md`. This is the canonical way to reach any staff member:

```json
{
  "tool": "sessions_send",
  "args": {
    "label": "internal",
    "message": "Hi, a user is asking about X. Can you help?",
    "timeoutSeconds": 60
  }
}
```

You can also target a specific manager by their `agentId`:

```json
{
  "tool": "sessions_send",
  "args": {
    "agentId": "manager-alice",
    "message": "Urgent: customer is reporting a delivery issue.",
    "timeoutSeconds": 0
  }
}
```

## Manager replies

Managers receive the escalation in their internal session. They should:

1. **Reply** with the answer and whether it is public (`PUBLIC: yes/no`).
2. The agent will relay the answer and save it accordingly.

Managers can also proactively message the external-facing agent using
`sessions_send` targeting the user's session key (visible in `sessions_list`).

## Timeout handling

If the manager does not reply within `timeoutSeconds`:

1. Inform the user: "I've passed your question to the team. I'll follow up as
   soon as I have an answer."
2. Do **not** fabricate an answer.
3. Optionally set a cron job / reminder to follow up (use `cron` tool if
   available).

## ROLES.md format

`business/ROLES.md` drives escalation routing. Keep it up to date:

```markdown
# Business Roles

## Managers

| Name  | Session label | Channel / contact    | Topics                    |
| ----- | ------------- | -------------------- | ------------------------- |
| Alice | manager-alice | Discord: @alice#1234 | Customer success, refunds |
| Bob   | manager-bob   | Telegram: @bob_ops   | Operations, logistics     |

## Admins

| Name  | Session label | Channel / contact | Topics                      |
| ----- | ------------- | ----------------- | --------------------------- |
| Carol | internal      | Internal channel  | All topics (fallback admin) |

## Default escalation

If no specific manager is relevant: use label `"internal"` (Carol, admin).
```

## Configuration required in `openclaw.json`

```json5
{
  agents: {
    list: [
      // External-facing agent (receives user messages)
      {
        id: "main",
        workspace: "~/.openclaw/workspace",
      },
      // Internal / manager agent (receives escalations)
      {
        id: "internal",
        workspace: "~/.openclaw/workspace-internal",
        // Bind to your internal channel (e.g. a private Discord channel,
        // a private Slack workspace, or webchat)
      },
    ],
    defaults: {
      tools: {
        agentToAgent: { enabled: true },
      },
    },
  },
  // Bind the internal agent to its channel/account
  bindings: [{ agentId: "internal", channel: "discord", account: "internal-bot" }],
}
```

Individual manager agents (`manager-alice`, `manager-bob`) follow the same
pattern — add an entry in `agents.list` and a binding for their channel account.

## Security notes

- The external-facing agent must **never** reveal internal memory content to
  external users.
- Managers reply in their own isolated session; that session's context is
  private.
- The escalation message sent via `sessions_send` contains only the user's
  question, not other users' private memory.
