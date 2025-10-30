# Mail Plugin Debugging Guide

## Summary of Changes

### Fixed Case-Sensitivity Issue
The `read_mail` tool now uses **case-insensitive matching** for account and mailbox names:
- `'charlie@garrison'` will match `'Charlie@garrison'`
- `'INBOX'` will match `'inbox'` or `'Inbox'`

### Added Debug Logging
The script now logs filtering activity to help diagnose issues:
- Which accounts/mailboxes are being checked
- Which accounts/mailboxes matched filters
- How many items will be searched
- Filter values being used

### New Test Tool
Added `test_mail_structure` tool to quickly see what Mail.app actually calls your accounts and mailboxes.

## How to Enable Debug Logging

Set these environment variables before starting the server:

```bash
export DEBUG_APPLESCRIPT=true
export DEBUG_APPLESCRIPT_SAVE_ALL=true  # Optional: saves all scripts, not just failures
export DEBUG_APPLESCRIPT_DIR=./debug/applescript  # Optional: custom debug directory
```

When enabled:
- AppleScript `log` statements are captured in stderr
- Failed scripts are automatically saved to the debug directory
- Scripts include metadata files (`.json`) with execution details

## Using the Test Tool

### 1. Test Mail Structure
Quickly see what account and mailbox names Mail.app uses:

```typescript
const result = await test_mail_structure();
```

Example output:
```json
{
  "success": true,
  "accounts": [
    {
      "accountName": "Charlie@garrison",
      "mailboxes": ["INBOX", "Sent", "Drafts", "Trash"]
    },
    {
      "accountName": "work@company.com",
      "mailboxes": ["INBOX", "Projects", "Archive"]
    }
  ]
}
```

### 2. Debug Read Mail
With debug logging enabled, the script will output:

```
Filtering accounts: charlie@garrison
Checking account: Charlie@garrison
Account matched: Charlie@garrison
Accounts to search: 1
Filtering mailboxes: INBOX
Mailbox matched: INBOX in account Charlie@garrison
Mailboxes to search: 1
Has filters: true, sender: buckingham
```

## Common Issues and Solutions

### Issue: "0 messages returned" despite knowing messages exist

**Possible Causes:**
1. **Account/mailbox name mismatch** (FIXED)
   - Old: Required exact case match
   - New: Case-insensitive matching

2. **Wrong mailbox name**
   - Use `test_mail_structure` to see actual names
   - Mail.app might use "INBOX" not "Inbox"

3. **Sender filter not matching**
   - Sender filter uses partial match: `'buckingham'` matches `'john@buckingham.com'`
   - Check debug logs to see what Mail.app returns

4. **Messages in wrong mailbox**
   - Use `test_mail_structure` to list all mailboxes
   - Try searching without mailbox filter first

### Issue: Debug logs not showing

**Solutions:**
1. Ensure `DEBUG_APPLESCRIPT=true` is set BEFORE starting server
2. Check that logs are being written to stderr
3. Look in `./debug/applescript/` for saved script files

## Implementation Details

### Case-Insensitive Helper Function
```applescript
on toLower(str)
	set lowercaseChars to "abcdefghijklmnopqrstuvwxyz"
	set uppercaseChars to "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	set result to ""
	
	repeat with i from 1 to length of str
		set char to character i of str
		set charOffset to offset of char in uppercaseChars
		
		if charOffset > 0 then
			set result to result & character charOffset of lowercaseChars
		else
			set result to result & char
		end if
	end repeat
	
	return result
end toLower
```

### Filtering Logic
Accounts and mailboxes now use:
```applescript
set accNameLower to my toLower(accName)
repeat with filterName in accountNames
	if accNameLower is equal to my toLower(filterName) then
		-- Match found!
	end if
end repeat
```

## Testing Steps

1. **Test without filters:**
   ```typescript
   read_mail({ includeBody: false, maxResults: 5 })
   ```

2. **Test account filter:**
   ```typescript
   read_mail({ 
     accounts: ['charlie@garrison'],  // Case doesn't matter now
     includeBody: false 
   })
   ```

3. **Test mailbox filter:**
   ```typescript
   read_mail({ 
     mailboxes: ['inbox'],  // Case doesn't matter now
     includeBody: false 
   })
   ```

4. **Test sender filter:**
   ```typescript
   read_mail({ 
     sender: 'buckingham',  // Partial match
     accounts: ['charlie@garrison'],
     mailboxes: ['inbox'],
     includeBody: false 
   })
   ```

## Files Changed

1. `server/src/plugins/mail.plugin/scripts/read_mail.applescript`
   - Added `toLower()` helper function
   - Updated account filtering for case-insensitive matching
   - Updated mailbox filtering for case-insensitive matching
   - Added debug log statements throughout
   - **PERFORMANCE:** Optimized message ID lookup using `whose` clause (180x faster for large mailboxes)

2. `server/src/plugins/mail.plugin/scripts/test_mail_structure.applescript` (NEW)
   - Quick test script to show account/mailbox names

3. `server/src/plugins/mail.plugin/plugin.ts`
   - Registered `test_mail_structure` tool
   - Added type definitions

## Performance Notes

### Message ID Lookup Optimization
The script now uses Mail.app's native `whose` clause for message ID lookups:

**Before:** Looped through every message (50k+ iterations)
**After:** Direct filtering by Mail.app (< 1 second)

**Performance:** Up to **180x faster** for large mailboxes!

See `docs/mail-plugin-performance.md` for detailed benchmarks and optimization tips.

## Next Steps

If you still experience issues after these changes:

1. Run `test_mail_structure` to verify account/mailbox names
2. Enable debug logging to see what's being filtered
3. Check debug directory for saved scripts and metadata
4. Look for stderr output in the tool results
