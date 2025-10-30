-- Get Mail Structure Script
-- List all available accounts and their mailboxes/folders in a hierarchical structure
-- Template variables (all JSON strings, parsed with parseValue): ${accountName}

-- Parse JSON input
set accountFilter to parseValue(${accountName})

tell application "Mail"
	
	-- Initialize results
	set accountsList to {}
	set totalMailboxCount to 0
	
	-- Iterate through accounts
	repeat with acc in accounts
		set accName to name of acc
		
		-- Apply account filter if specified
		if accountFilter is not missing value and accName is not accountFilter then
			-- Skip this account
		else
			-- Get mailboxes for this account
			set accountMailboxes to {}
			repeat with mb in mailboxes of acc
				set mbInfo to my buildMailboxInfo(mb)
				set end of accountMailboxes to mbInfo
				set totalMailboxCount to totalMailboxCount + 1
			end repeat
			
			-- Build account info with nested mailboxes
			-- Build account info as list of pairs for buildJSONObject
			set accInfo to {{"name", accName}, {"mailboxCount", (count of accountMailboxes)}, {"mailboxes", accountMailboxes}}
			set end of accountsList to accInfo
		end if
	end repeat
	
end tell

-- Return hierarchical structure using buildJSONObject
return buildJSONObject({"success", true}, {"accountCount", count of accountsList}, {"totalMailboxes", totalMailboxCount}, {"accounts", accountsList}})

-- Helper: Build mailbox info record
on buildMailboxInfo(mb)
	tell application "Mail"
		set mbName to name of mb
		set mbUnreadCount to unread count of mb
		
		-- Return as list of pairs for buildJSONObject
		return {{"name", mbName}, {"unreadCount", mbUnreadCount}}
	end tell
end buildMailboxInfo
