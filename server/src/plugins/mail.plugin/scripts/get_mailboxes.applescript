-- Get Mailboxes Script
-- List all available mailboxes/folders
-- Template variables: ${accountName}

tell application "Mail"
	set accountFilter to ${accountName}
	
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
	
	-- Build JSON result
	set resultJson to "{\"success\":true,\"count\":" & (count of mailboxesList) & ",\"mailboxes\":["
	set first to true
	repeat with mbInfo in mailboxesList
		if not first then
			set resultJson to resultJson & ","
		else
			set first to false
		end if
		set resultJson to resultJson & mbInfo
	end repeat
	set resultJson to resultJson & "]}"
	
	return resultJson
end tell

-- Helper: Build mailbox info JSON
on buildMailboxInfo(mb, accountName)
	tell application "Mail"
		set mbName to name of mb
		set mbUnreadCount to unread count of mb
		
		-- Escape special characters for JSON
		set mbNameEscaped to my escapeJson(mbName)
		set accountNameEscaped to my escapeJson(accountName)
		
		set info to "{" & ""
		set info to info & "\"name\":\"" & mbNameEscaped & "\","
		set info to info & "\"account\":\"" & accountNameEscaped & "\","
		set info to info & "\"unreadCount\":" & mbUnreadCount & ""
		set info to info & "}"
		
		return info
	end tell
end buildMailboxInfo

-- Helper: Escape special characters for JSON
on escapeJson(txt)
	set txt to my replaceText(txt, "\\", "\\\\")
	set txt to my replaceText(txt, "\"", "\\\"")
	set txt to my replaceText(txt, return, "\\n")
	set txt to my replaceText(txt, tab, "\\t")
	return txt
end escapeJson

-- Helper: Replace text
on replaceText(theText, oldText, newText)
	set AppleScript's text item delimiters to oldText
	set textItems to text items of theText
	set AppleScript's text item delimiters to newText
	set theText to textItems as text
	set AppleScript's text item delimiters to ""
	return theText
end replaceText
