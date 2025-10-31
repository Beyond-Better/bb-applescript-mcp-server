# Mail Plugin - Quick Reference Guide

## Common Usage Patterns

### 1. List Recent Unread Emails (Metadata Only)

**User asks:** "Show me my recent unread emails"

**LLM should use:**

```json
{
  "flags": { "read": false },
  "sortBy": "date-newest",
  "maxResults": 20,
  "includeBody": false
}
```

**Returns:** List of 20 most recent unread messages with IDs, senders, subjects, dates, flags

---

### 2. Get Full Body of Specific Message

**User asks:** "Read message msg123 for me"

**LLM should use:**

```json
{
  "messageIds": ["msg123"],
  "includeBody": true
}
```

**Returns:** Full content of just that one message

---

### 3. Two-Step Workflow (Recommended)

**User asks:** "Show me emails from support@company.com and read the urgent ones"

**Step 1 - Get list:**

```json
{
  "sender": "support@company.com",
  "sortBy": "date-newest",
  "maxResults": 10,
  "includeBody": false
}
```

Returns: 10 messages with IDs ["msg1", "msg2", "msg3", ...]

**Step 2 - LLM identifies urgent ones from subjects/dates**

Let's say msg1, msg3, msg7 look urgent based on subjects

**Step 3 - Get full bodies:**

```json
{
  "messageIds": ["msg1", "msg3", "msg7"],
  "includeBody": true
}
```

Returns: Full content for just those 3 messages

**Step 4 - Mark as read after processing:**

```json
{
  "messageIds": ["msg1", "msg3", "msg7"],
  "flagType": "read",
  "flagValue": true
}
```

---

### 4. Search Old Emails

**User asks:** "Find the first email I got from john@example.com"

**LLM should use:**

```json
{
  "sender": "john@example.com",
  "sortBy": "date-oldest",
  "maxResults": 1,
  "includeBody": true
}
```

**Returns:** The oldest email from that sender with full body

---

### 5. List Flagged Messages

**User asks:** "What messages have I flagged?"

**LLM should use:**

```json
{
  "flags": { "flagged": true },
  "sortBy": "date-newest",
  "includeBody": false
}
```

**Returns:** All flagged messages, most recent first

---

### 6. Search Specific Mailbox

**User asks:** "Show me unread emails in my Work folder"

**Step 1 - Get mailbox names:**

```json
// get_mailboxes tool
{}
```

Returns: List showing mailbox named "Work" exists

**Step 2 - Search that mailbox:**

```json
{
  "mailboxes": ["Work"],
  "flags": { "read": false },
  "sortBy": "date-newest",
  "includeBody": false
}
```

---

## Sorting Options

### date-newest (Default)

```json
{ "sortBy": "date-newest" }
```

- Most recent emails first
- **Use for:** "show me recent emails", "what's new?", "latest messages"

### date-oldest

```json
{ "sortBy": "date-oldest" }
```

- Oldest emails first
- **Use for:** "find first email", "earliest message", "historical search"

### sender

```json
{ "sortBy": "sender" }
```

- Alphabetical by sender email/name
- **Use for:** "organize by sender", "group by person"

### subject

```json
{ "sortBy": "subject" }
```

- Alphabetical by subject line
- **Use for:** "organize by topic", "group by subject"

---

## Performance Tips

### ✅ Efficient Pattern

```
1. read_mail (metadata only, sorted) → Fast, returns IDs
2. Review/analyze the list
3. read_mail (specific IDs with body) → Targeted, only what's needed
4. mark_mail (update flags) → Clean up
```

### ❌ Inefficient Pattern

```
1. read_mail (includeBody=true, large maxResults) → SLOW!
   - Downloads hundreds of full email bodies
   - Overwhelms context with unnecessary content
   - Wastes time and resources
```

---

## Filter Combinations

### Unread from Specific Sender

```json
{
  "sender": "boss@company.com",
  "flags": { "read": false },
  "sortBy": "date-newest"
}
```

### Flagged Messages About Project

```json
{
  "subject": "Project Phoenix",
  "flags": { "flagged": true },
  "sortBy": "date-newest"
}
```

### Unreplied Messages from Last Week

```json
{
  "flags": { "replied": false, "read": true },
  "sortBy": "date-newest",
  "maxResults": 50
}
```

### All Messages in Archive Folder

```json
{
  "mailboxes": ["Archive"],
  "sortBy": "date-oldest",
  "maxResults": 100
}
```

---

## Common Mistakes

### ❌ Mistake 1: Always using includeBody=true

```json
{
  "flags": { "read": false },
  "includeBody": true, // ❌ Slow! Gets full bodies you might not need
  "maxResults": 50
}
```

**Better:**

```json
{
  "flags": { "read": false },
  "includeBody": false, // ✅ Fast! Get IDs first
  "maxResults": 50
}
// Then get specific bodies only if needed
```

---

### ❌ Mistake 2: Not using sort

```json
{
  "sender": "support@company.com",
  "maxResults": 10
  // ❌ Missing sortBy - gets random 10 messages
}
```

**Better:**

```json
{
  "sender": "support@company.com",
  "sortBy": "date-newest", // ✅ Gets most recent 10
  "maxResults": 10
}
```

---

### ❌ Mistake 3: Re-filtering to get bodies

```json
// First call
{
  "sender": "john@example.com",
  "includeBody": false
}
// Returns msg1, msg2, msg3

// ❌ Second call - re-filters everything!
{
  "sender": "john@example.com",
  "includeBody": true
}
```

**Better:**

```json
// First call
{
  "sender": "john@example.com",
  "includeBody": false
}
// Returns msg1, msg2, msg3

// ✅ Second call - direct lookup!
{
  "messageIds": ["msg1", "msg3"],  // Just the ones we want
  "includeBody": true
}
```

---

## Message ID Usage

### When to Use messageIds Parameter

**✅ Use when:**

- You already have message IDs from a previous query
- User asks to read a specific message: "read message msg123"
- You want to get full bodies after reviewing metadata
- You need to retrieve selected messages efficiently

**❌ Don't use when:**

- Doing initial search/filter (use sender/subject/flags instead)
- You don't have the message IDs yet
- User asks for "all emails from X" (use filters)

### Message ID Behavior

**When messageIds is provided:**

- All other filters are ignored (sender, subject, flags, mailboxes)
- Searches for exactly those message IDs
- Sort still applies to the results
- maxResults still limits how many are returned

---

## Quick Decision Tree

```
User asks about emails
├─ "Show me..." / "List..." / "Find..."
│  └─ Use metadata-only search (includeBody=false)
│     └─ Always specify sortBy (usually date-newest)
│     └─ Set reasonable maxResults
│
├─ "Read message [ID]" / "Get full body of..."
│  └─ Use messageIds with includeBody=true
│
└─ "Find and read..." (compound request)
   └─ Two-step workflow:
      1. Get list (includeBody=false, sorted)
      2. Get bodies (messageIds, includeBody=true)
```

---

## LLM Guidelines

### Default Behavior

- Always use `sortBy: "date-newest"` unless user requests otherwise
- Default to `includeBody: false` for searches
- Only use `includeBody: true` when:
  - User explicitly asks to "read" messages
  - You have specific messageIds
  - User needs full content to answer their question

### Natural Language Mapping

**"Show me recent emails"** → `sortBy: "date-newest"`, `includeBody: false`

**"Find old messages"** → `sortBy: "date-oldest"`, `includeBody: false`

**"Read message 123"** → `messageIds: ["123"]`, `includeBody: true`

**"What are my unread emails?"** → `flags.read: false`, `includeBody: false`

**"Summarize emails from John"** → Two-step:

1. Get list from John
2. Get bodies of selected messages
3. Summarize

---

## Tool Selection

### Use read_mail when:

- Searching for messages
- Listing messages
- Getting message content
- Retrieving specific messages by ID

### Use get_mailboxes when:

- User asks "what folders do I have?"
- Need to know exact mailbox names
- Want to see unread counts per folder

### Use mark_mail when:

- Marking messages as read/unread
- Flagging messages
- Organizing messages
- User says "mark as read" or "flag this"

---

**Remember:** Metadata first, bodies only when needed!
