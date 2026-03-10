# Business Roles

This file is managed by the **business-memory-internal** skill.
It defines which staff members are managers or admins and how to reach them
via `sessions_send` (see `business-escalation` skill).

---

## Managers

| Name                | Session label | Channel / contact | Topics |
| ------------------- | ------------- | ----------------- | ------ |
| _Add managers here_ |               |                   |        |

<!-- Example:
| Alice | manager-alice | Discord: @alice#1234 | Customer success, refunds |
| Bob   | manager-bob   | Telegram: @bob_ops   | Operations, logistics     |
-->

## Admins

| Name              | Session label | Channel / contact | Topics |
| ----------------- | ------------- | ----------------- | ------ |
| _Add admins here_ |               |                   |        |

<!-- Example:
| Carol | internal | Internal channel (webchat) | All topics (fallback admin) |
-->

## Default escalation

If no specific manager matches the topic, use session label `"internal"`.
Update this line once you have configured your admin session.
