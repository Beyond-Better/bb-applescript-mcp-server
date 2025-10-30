# Mail Plugin Setup Guide

## What Was Created

The Mail plugin has been created with the following structure:

```
server/src/plugins/mail.plugin/
├── plugin.ts                           # Main plugin file with tool registrations
├── scripts/
│   ├── read_mail.applescript          # Search and retrieve emails
│   ├── get_mailboxes.applescript      # List mailboxes/folders
│   └── mark_mail.applescript          # Mark messages with flags
├── README.md                           # Documentation and usage examples
└── SETUP.md                            # This file
```

## Tools Implemented

### ✅ Phase 1 (Complete)

1. **read_mail** - Search and retrieve email messages
   - Filter by sender, subject, status flags
   - Search all mailboxes or specific ones
   - Metadata-only or full body retrieval
   - Configurable max results (hard limit: 100)

2. **get_mailboxes** - List available mailboxes
   - All accounts or filter by account name
   - Shows unread counts

3. **mark_mail** - Change message flags
   - Mark as read/unread, flagged, deleted, junk
   - Batch operations on multiple messages
   - TODO: Approval elicitation before mutating

### 📋 Phase 2 (Planned)

4. **send_mail** - Compose and send emails
5. **move_mail** - Move messages between mailboxes
6. **delete_mail** - Delete or trash messages
7. **create_mailbox** - Create new folders
8. **reply_to_mail** - Create reply messages
9. **forward_mail** - Forward messages
10. **get_mail_attachments** - Manage attachments

## Next Steps

### 1. Test the Plugin

Restart your MCP server:

```bash
cd /path/to/bb-mcp-applescript
deno task dev
```

Look for in the logs:
```
Mail plugin initialized with tools: read_mail, get_mailboxes, mark_mail
```

### 2. Grant Permissions

On first use, macOS will prompt for automation permissions:
- **System Settings → Privacy & Security → Automation**
- Grant permission for your MCP client to control Mail

### 3. Test the Tools

In your MCP client (Claude Desktop or Beyond Better), try:

```
List my mailboxes
```

```
Find unread emails from the last week
```

```
Show me flagged messages with "urgent" in the subject
```

### 4. Implement Approval Elicitation (TODO)

The `mark_mail` tool has a TODO comment for implementing approval:

```typescript
// TODO: Implement approval elicitation here
// Use bb-mcp-server's elicitation support to request user approval
// before modifying messages
```

You'll need to:
1. Import the elicitation API from bb-mcp-server
2. Call it before executing the mark_mail script
3. Handle approval/rejection responses

Example pattern (pseudo-code):
```typescript
const approval = await elicitApproval({
  message: `Mark ${args.messageIds.length} message(s) as ${args.flagType}=${args.flagValue}?`,
  data: { messageIds: args.messageIds, action: 'mark_mail' }
});
if (!approval.approved) {
  return { content: [{ type: 'text', text: 'Action cancelled by user' }] };
}
```

### 5. Add Plugin to Static Imports (If Building for JSR)

If you want this plugin available as a built-in plugin:

1. Edit `server/src/plugins/pluginManager.ts`
2. Add import: `import mailPlugin from './mail.plugin/plugin.ts';`
3. Register it in the static plugins list

Otherwise, it will be discovered dynamically via `PLUGINS_DISCOVERY_PATHS`.

### 6. Test Edge Cases

- Empty mailbox searches
- Invalid message IDs in mark_mail
- Very long email bodies
- Special characters in sender/subject
- Multiple accounts with same mailbox names
- Messages with no subject

## Known Limitations

1. **Forwarded flag**: AppleScript doesn't expose this directly in Mail.app, so it always returns `false`

2. **Performance**: Searching large mailboxes (thousands of messages) can be slow

3. **Complex queries**: AND/OR logic requires multiple tool calls or client-side filtering

4. **Search scope**: Currently searches linearly through messages; no index-based search

## Configuration Options

### Hard Limits

In `plugin.ts`, you can adjust:

```typescript
// Maximum results hard limit
const maxResults = Math.min(args.maxResults || 50, 100);
```

Change `100` to a different value if needed.

### Timeout Defaults

Add default timeout in the tool schema:

```typescript
timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
```

## Troubleshooting

### Plugin Not Loading

1. Check file naming: `plugin.ts` must be named correctly
2. Verify directory structure: `server/src/plugins/mail.plugin/`
3. Check logs for initialization errors
4. Ensure proper export: `export default { ... } as AppPlugin`

### AppleScript Errors

1. Test scripts directly:
   ```bash
   osascript server/src/plugins/mail.plugin/scripts/get_mailboxes.applescript
   ```

2. Check Mail.app permissions in System Settings

3. Verify Mail.app is running and has accounts configured

4. Enable debug logging:
   ```bash
   LOG_LEVEL=debug deno task dev
   ```

### Permission Denied

1. Grant automation permissions manually:
   - System Settings → Privacy & Security → Automation
   - Find your MCP client in the list
   - Enable Mail.app

2. Restart the MCP server after granting permissions

### No Results Returned

1. Check that Mail.app has messages matching your filters
2. Verify mailbox names are exact (use `get_mailboxes` first)
3. Try broader filters (remove some criteria)
4. Check for typos in sender/subject filters

## Contributing

To add the Phase 2 tools:

1. Create new `.applescript` files in `scripts/`
2. Add tool definitions to `plugin.ts`
3. Update `README.md` with usage examples
4. Move the TODO items from comments to completed features
5. Test thoroughly

See `docs/creating-plugins.md` for detailed guidance.

## Resources

- **Plugin Documentation**: `docs/creating-plugins.md`
- **User Plugins Guide**: `docs/user-plugins-guide.md`
- **Mail.app AppleScript Dictionary**: Open Script Editor → File → Open Dictionary → Mail
- **BBEdit Plugin Example**: `server/src/plugins/bbedit.plugin/plugin.ts`

## Support

For issues or questions:
1. Check the README.md for usage examples
2. Review AppleScript syntax in the scripts directory
3. Test scripts directly with osascript
4. Check server logs for detailed error messages

---

**Status**: Phase 1 Complete ✅  
**Next**: Test tools, implement approval elicitation, add Phase 2 tools
