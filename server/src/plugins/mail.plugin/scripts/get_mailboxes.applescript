-- Get Mailboxes Script
-- List all available mailboxes/folders
-- Template variables (all JSON strings, parsed with parseJSON): ${accountName}

tell application "Mail"
	-- Parse JSON input
	set accountFilter to parseJSON(${accountName})
	
	-- Initialize results
	set mailboxesList to {}
	
	-- Iterate through accounts
	repeat with acc in accounts
		set accName to name of acc
		
		-- Apply account filter if specified
		if accountFilter is not missing value and accName is not accountFilter then
			-- Skip this account
		else
			-- Get mailboxes for this account
			repeat with mb in mailboxes of acc
				set mbInfo to my buildMailboxInfo(mb, accName)
				set end of mailboxesList to mbInfo
			end repeat
		end if
	end repeat
	
	-- Build mailbox data for JSON
	set mailboxData to {}
	repeat with mbInfo in mailboxesList
		set end of mailboxData to mbInfo
	end repeat
	
	-- Return using buildJSONObject
	return buildJSONObject({{"success", true}, {"count", count of mailboxesList}, {"mailboxes", mailboxData}})
end tell

-- Helper: Build mailbox info record
on buildMailboxInfo(mb, accountName)
	tell application "Mail"
		set mbName to name of mb
		set mbUnreadCount to unread count of mb
		
		-- Return as AppleScript record (will be converted to JSON by buildJSONObject)
		return {name:mbName, account:accountName, unreadCount:mbUnreadCount}
	end tell
end buildMailboxInfo
