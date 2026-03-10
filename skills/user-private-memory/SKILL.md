---
name: user-private-memory
description: "Read and write per-user private memory. Each channel user has their own private memory file that stores their preferences, past answers, and personal context. Use when personalising replies, recalling what was said to a specific user before, or storing user-specific information that should never be shared with other users."
metadata: { "openclaw": { "emoji": "👤" } }
---

# User Private Memory

Every user who interacts with the agent through any channel gets their own
private memory file. This memory is **isolated per channel + user** and must
never be shown to other users or used in shared/group contexts.

## File location

```
<workspace>/business/users/<channel>/<userId>.md
```

Examples:

```
business/users/discord/123456789.md
business/users/telegram/987654321.md
business/users/slack/U04ABCDEF.md
business/users/webchat/alice@example.com.md
```

`<channel>` is the lowercase channel name (`discord`, `telegram`, `slack`,
`whatsapp`, `signal`, `webchat`, etc.).
`<userId>` is the sender identifier supplied in the session context (check the
system prompt `Peer:` line or the inbound message envelope).

## When to use

- **Reading:** At the start of a conversation, load this file to recall prior
  answers, preferences, and context for this specific user.
- **Writing:** After answering a user's question (especially if the answer was
  escalated to a manager), write the answer to this file so future sessions can
  answer directly without re-escalating.
- **Privacy:** Never include this file in group/shared contexts or in any reply
  that could be seen by another user.

## Reading private memory for the current user

```bash
# Derive channel and userId from session context (see system prompt Peer line)
CHANNEL="<channel>"
USER_ID="<userId>"

cat "business/users/${CHANNEL}/${USER_ID}.md" 2>/dev/null \
  || echo "(no private memory for this user yet)"
```

## Writing private memory

```bash
CHANNEL="<channel>"
USER_ID="<userId>"
mkdir -p "business/users/${CHANNEL}"

cat >> "business/users/${CHANNEL}/${USER_ID}.md" <<'EOF'

## <Topic or date>

<What was said / answered / stored>

_Saved: <ISO date>_
EOF
```

## When to write

- A manager answered a question from this user → save the answer so it can be
  reused directly on next ask.
- The user stated a preference ("always answer in Spanish", "I prefer bullet
  lists") → save it.
- The user asked the same question more than once → write a brief FAQ entry so
  the answer is instant next time.
- After any escalation that produced a personal answer → always write here.

## File format

Plain Markdown. Keep entries short and factual:

```markdown
# Private Memory — discord/123456789

## Preferred language

Always reply in Spanish.

## Answered questions

### 2026-01-15 — Delivery time to Madrid

Answered: "Standard shipping to Spain takes 5–7 business days."
Source: Manager escalation (Alice, 2026-01-15).

### 2026-02-01 — Discount for returning customers

Answered: "Returning customers receive 10% off their next order."
Source: public memory.
```

## Rules

- Each user's file is **private**. Do not read one user's file in another user's
  session.
- Do not store sensitive personal data (passwords, payment info, government IDs).
- If a user requests to be forgotten, delete their file:
  `rm "business/users/${CHANNEL}/${USER_ID}.md"`.
- Only the main external-facing agent writes here. Managers/admins do not need
  to read these files (those interactions are logged in their own sessions).
