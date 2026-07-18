# Conversations

## Purpose

A read-only inspector for every conversation the AI (or a human, via [Inbox](../inbox/README.md)) has had with a website visitor — the debugging/QA surface for the Conversation Engine. Distinct from Inbox, which is the agent-facing surface for actually replying.

## Features

- Full transcript view per conversation
- Which knowledge chunks grounded each AI reply, with similarity/confidence ([citations](../ai/README.md#citations))
- Token usage and latency per message
- Filter by widget

## Roles

| Role | Access |
|---|---|
| `owner`, `admin`, `manager`, `agent`, `viewer` | View only — `conversations.view` |

There is no write permission for this module; replying happens through [Inbox](../inbox/README.md) instead.

## Workflow

A conversation is created automatically the first time a widget visitor sends a message (see [AI → Conversation execution pipeline](../ai/README.md#conversation-execution-pipeline)). This screen is purely observational — nothing here changes conversation state.

## Screens

- `/app/conversations` — list, filterable by widget
- `/app/conversations/[conversationId]` — full transcript, citations, usage per message

## Related APIs

[Conversations — Inspector endpoints](../api/README.md#conversations--inspector)

## Database tables

`conversation_sessions`, `conversations`, `conversation_messages`, `conversation_citations`, `conversation_usage` — see [Database → Conversation Engine](../database/README.md#conversation-engine).

Related: [AI pipeline](../ai/README.md) · [Inbox](../inbox/README.md)
