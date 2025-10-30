# Apple Mail Plugin

Provides tools for reading, organizing, and managing emails via Apple Mail.app.

## Available Tools

### 1. read_mail

Search and retrieve email messages based on sender, subject, and status flags.

**Parameters:**
- `messageIds` (optional): Retrieve specific messages by ID (ignores other filters if provided)
- `sender` (optional): Filter by sender email address or name (partial match)
- `subject` (optional): Filter by subject text (partial match)
- `flags` (optional): Filter by message flags/status
  - `read`: Filter by read status (boolean)
  - `flagged`: Filter by flagged status (boolean)
  - `replied`: Filter by replied status (boolean)
  - `forwarded`: Filter by forwarded status (boolean)
  - `deleted`: Filter by deleted/junk status (boolean)
- `mailboxes` (optional): Array of mailbox names to search (searches all if not specified)
- `sortBy` (optional): Sort messages - one of: `date-newest` (default), `date-oldest`, `sender`, `subject`
- `includeBody` (optional): Include full message bodies (default: false)
- `maxResults` (optional): Maximum number of messages to return (default: 50, hard limit: 100)
- `timeout` (optional): Timeout in milliseconds

**Returns:**
```json
{
  "success": true,
  "count": 2,
  "messages": [
    {
      "id": "123456",
      "sender": "john@example.com",
      "subject": "Meeting Tomorrow",
      "date": "2025-01-15 10:30:00",
      "flags": {
        "read": false,
        "flagged": true,
        "replied": false,
        "forwarded": false,
        "deleted": false,
        "junk": false
      },
      "body": "(included if includeBody=true)"
    }
  ]
}
```

**Example Usage:**

*Basic search (metadata only):*
```
Find all unread emails from john@example.com
```
```
Show me the 10 most recent flagged emails with "urgent" in the subject
```
```
Get the 20 oldest unread messages
```

*Retrieve full body for specific messages:*
```
# Step 1: Get list with metadata
"Show me unread emails from sarah@company.com about project alpha"
# Returns messages with IDs: ["123", "456", "789"]

# Step 2: Get full body for specific message(s)
"Get the full body of message 123"
# OR
"Get the full bodies of messages 123 and 456"
```

---

### 2. get_mailboxes

List all available mailboxes/folders across all accounts or for a specific account.

**Parameters:**
- `accountName` (optional): Filter mailboxes by specific account name
- `timeout` (optional): Timeout in milliseconds

**Returns:**
```json
{
  "success": true,
  "count": 5,
  "mailboxes": [
    {
      "name": "INBOX",
      "account": "work@company.com",
      "unreadCount": 12
    },
    {
      "name": "Projects",
      "account": "work@company.com",
      "unreadCount": 3
    }
  ]
}
```

**Example Usage:**
```
List all my mailboxes
```
```
Show me mailboxes for my work account
```
```
Which folders have unread messages?
```

---

### 3. mark_mail

Mark email messages with specific flags (read/unread, flagged, deleted, junk).

**Parameters:**
- `messageIds` (required): Array of message IDs to mark (obtained from read_mail)
- `flagType` (required): Type of flag to modify - one of: `read`, `flagged`, `deleted`, `junk`
- `flagValue` (required): Value to set the flag to (true or false)
- `timeout` (optional): Timeout in milliseconds

**Returns:**
```json
{
  "success": true,
  "processedCount": 3,
  "successCount": 3,
  "failedCount": 0,
  "flagType": "read",
  "flagValue": true,
  "failedIds": []
}
```

**Example Usage:**
```
Mark the first 5 unread emails as read
```
```
Flag all emails from the CEO
```
```
Mark those spam messages as junk
```

**Note:** This tool will request user approval before modifying messages (TODO: implement elicitation).

---

## Usage Patterns

### Pattern 1: Search and Process (Recommended)

1. Use `read_mail` to find messages matching criteria (metadata only, sorted by date)
2. Review the results and note the message IDs
3. Use `read_mail` with specific `messageIds` and `includeBody=true` to get full content
4. Process the messages
5. Use `mark_mail` to mark them as read

**Example Flow:**
```
1. "Find the 10 most recent unread emails from support@company.com"
   # LLM uses: read_mail with sender filter, flags.read=false, sortBy='date-newest', maxResults=10
   # Returns: 10 messages with IDs ["msg1", "msg2", ...]

2. (Review the list of 10 messages)

3. "Get the full body of messages msg1 and msg3"
   # LLM uses: read_mail with messageIds=["msg1", "msg3"], includeBody=true
   # Returns: Full content for just those 2 messages

4. (LLM processes and responds to questions)

5. "Mark msg1 and msg3 as read"
   # LLM uses: mark_mail with messageIds=["msg1", "msg3"], flagType="read", flagValue=true
```

### Pattern 2: Mailbox Organization

1. Use `get_mailboxes` to see available folders
2. Use `read_mail` with specific mailbox filters
3. Process or organize messages

**Example Flow:**
```
1. "Show me all my mailboxes"
2. "Find flagged messages in my Projects folder"
3. "What are the urgent items in my work inbox?"
```

### Pattern 3: Automated Triage

1. Use `read_mail` to find messages needing attention
2. LLM analyzes content and context
3. Use `mark_mail` to flag important ones or mark others as read

**Example Flow:**
```
1. "Find all unread emails from the last 2 days"
2. "Which of these are urgent?"
3. "Flag the urgent ones and mark the rest as read"
```

---

## Future Features (TODO)

The following tools are planned for future implementation:

### send_mail
Compose and send emails with attachments.
- Parameters: `to`, `subject`, `body`, `cc`, `bcc`, `attachments`
- Use case: "Send an email to john@example.com about the meeting"

### move_mail
Move messages between mailboxes.
- Parameters: `messageIds`, `targetMailbox`
- Use case: "Move these emails to my Archive folder"

### delete_mail
Delete or move messages to trash.
- Parameters: `messageIds`, `permanent` (bool)
- Use case: "Delete these spam messages"

### create_mailbox
Create new mailboxes/folders.
- Parameters: `name`, `accountName`, `parentMailbox`
- Use case: "Create a new folder called 'Q1 Reports'"

### reply_to_mail / forward_mail
Create reply or forward messages.
- Parameters: `messageId`, `body`, `to` (for forward)
- Use case: "Reply to that email saying I'll attend"

### get_mail_attachments
List or save attachments from messages.
- Parameters: `messageId`, `savePath`
- Use case: "Save the attachments from that email to Downloads"

---

## Technical Notes

### Message IDs

Mail.app assigns unique IDs to each message. These IDs are stable and can be used to reference specific messages across tool calls. Always use the `id` field from `read_mail` results when calling `mark_mail`.

### Performance Considerations

- Searching across all mailboxes can be slow for large mail archives
- Use specific mailbox filters when possible
- Keep `maxResults` reasonable (default 50) for faster responses
- Use `includeBody=false` when you only need to count or list messages

### Sorting and Message Retrieval

**Sorting Options:**
- `date-newest` (default): Most recent messages first - ideal for "show me latest emails"
- `date-oldest`: Oldest messages first - useful for finding early correspondence
- `sender`: Alphabetical by sender email/name
- `subject`: Alphabetical by subject line

**Two-Step Workflow (Recommended):**

1. **First call - Get list with metadata:**
   ```
   read_mail({
     sender: "john@example.com",
     flags: { read: false },
     sortBy: "date-newest",
     maxResults: 10,
     includeBody: false  // Fast, just get IDs and metadata
   })
   ```
   Returns: `[{id: "msg1", subject: "...", date: "..."}, ...]`

2. **Second call - Get full bodies for specific messages:**
   ```
   read_mail({
     messageIds: ["msg1", "msg3"],  // Only get these specific messages
     includeBody: true              // Get full content
   })
   ```
   Returns: Full content for just those 2 messages

**Why This Works Better:**
- Metadata queries are fast (no body retrieval)
- User/LLM can review list and decide which to read fully
- Only retrieve full bodies for messages that matter
- More efficient for large result sets

### Filtering Tips

- **Message IDs**: When provided, ignores all other filters and retrieves only those specific messages
- **Sender filter**: Matches partial strings, so "john" will match "john@example.com", "John Doe", etc.
- **Subject filter**: Case-insensitive partial match
- **Flag filters**: Exact boolean match (true/false)
- **Mailbox names**: Must match exactly (use `get_mailboxes` to see exact names)

### AppleScript Limitations

- The `forwarded` flag is not directly exposed by Mail's AppleScript dictionary (always returns false)
- Searching very large mailboxes (thousands of messages) may be slow
- Complex queries (AND/OR logic) require multiple tool calls

### Approval Mechanism (TODO)

The `mark_mail` tool should request user approval before modifying messages. This will use bb-mcp-server's elicitation support to:
1. Present the action to be performed
2. Show which messages will be affected
3. Request user confirmation
4. Proceed only if approved

This ensures the LLM doesn't accidentally modify important emails without user consent.

---

## Permissions

On first use, macOS will prompt you to grant automation permissions for the MCP server to control Mail.app. 

You can also manually grant permissions in:
**System Settings → Privacy & Security → Automation → [Your MCP Client] → Mail**

---

## Examples

### Example 1: Daily Email Triage

**User:** "Show me all unread emails from today"

**Assistant uses:**
1. `read_mail` with `flags.read=false` (metadata only)
2. Reviews and summarizes the emails

**User:** "Read the full content of the one from my manager"

**Assistant uses:**
3. `read_mail` with specific sender filter and `includeBody=true`
4. Provides full analysis

**User:** "Mark it as read and flag it for follow-up"

**Assistant uses:**
5. `mark_mail` with `flagType=read`, `flagValue=true`
6. `mark_mail` with `flagType=flagged`, `flagValue=true`

---

### Example 2: Project Email Organization

**User:** "List my mailboxes"

**Assistant uses:**
1. `get_mailboxes`
2. Shows all available folders

**User:** "Find all emails about 'Project Phoenix' in my work inbox"

**Assistant uses:**
3. `read_mail` with `subject="Project Phoenix"`, `mailboxes=["INBOX"]`
4. Returns matching messages

**User:** "Which ones haven't been replied to?"

**Assistant filters results** where `flags.replied=false`

**User:** "Flag those for follow-up"

**Assistant uses:**
5. `mark_mail` with the unreplied message IDs and `flagType=flagged`

---

## Development

### Testing

Test the plugin with:
```bash
deno task dev
```

Then in your MCP client:
```
List my mailboxes
Find unread emails
Mark message XYZ as read
```

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug deno task dev
```

Test AppleScript directly:
```bash
osascript server/src/plugins/mail.plugin/scripts/read_mail.applescript
```

---

## Contributing

To add new mail-related tools:

1. Add the tool definition to `plugin.ts`
2. Create the corresponding `.applescript` file in `scripts/`
3. Update this README with usage examples
4. Test thoroughly with various mail configurations

See `docs/creating-plugins.md` for detailed plugin development guidance.
