-- Read Mail Script
-- Search and retrieve email messages based on filters
-- Template variables: ${messageIds}, ${sender}, ${subject}, ${flags}, ${mailboxes}, ${sortBy}, ${includeBody}, ${maxResults}

tell application "Mail"
	-- Parse JSON inputs (converted from null to missing value if not provided)
	set messageIdsJson to ${messageIds}
	set senderFilter to ${sender}
	set subjectFilter to ${subject}
	set flagsJson to ${flags}
	set mailboxesJson to ${mailboxes}
	set sortByOption to ${sortBy}
	set shouldIncludeBody to ${includeBody}
	set maxResults to ${maxResults}
	
	-- Initialize results
	set matchedMessages to {}
	set matchedMessageObjects to {} -- Store message objects for sorting
	set messageCount to 0
	
	-- If specific message IDs provided, retrieve only those
	if messageIdsJson is not missing value then
		set requestedIds to my parseJsonArray(messageIdsJson)
		
		-- Search for specific messages by ID
		repeat with acc in accounts
			repeat with mb in mailboxes of acc
				try
					repeat with msg in messages of mb
						if messageCount ≥ maxResults then exit repeat
						
						set msgId to id of msg
						if msgId is in requestedIds then
							set end of matchedMessageObjects to msg
							set messageCount to messageCount + 1
						end if
						
						if messageCount ≥ maxResults then exit repeat
					end repeat
				end try
				if messageCount ≥ maxResults then exit repeat
			end repeat
			if messageCount ≥ maxResults then exit repeat
		end repeat
		
		-- Sort and build results
		set sortedMessages to my sortMessages(matchedMessageObjects, sortByOption)
		repeat with msg in sortedMessages
			set messageInfo to my buildMessageInfo(msg, shouldIncludeBody)
			set end of matchedMessages to messageInfo
		end repeat
		
		-- Skip regular search since we found messages by ID
		set searchComplete to true
	else
		set searchComplete to false
	end if
	
	-- Regular search if no message IDs provided
	if not searchComplete then
	
	-- Determine which mailboxes to search
	set mailboxesToSearch to {}
	if mailboxesJson is not missing value then
		-- Parse mailbox names from JSON array
		set mailboxNames to my parseJsonArray(mailboxesJson)
		
		-- Find matching mailboxes
		repeat with mbName in mailboxNames
			repeat with acc in accounts
				repeat with mb in mailboxes of acc
					if name of mb is mbName then
						set end of mailboxesToSearch to mb
					end if
				end repeat
			end repeat
		end repeat
	else
		-- Search all mailboxes
		repeat with acc in accounts
			set mailboxesToSearch to mailboxesToSearch & mailboxes of acc
		end repeat
	end if
	
	-- Parse flags filter if provided
	set flagsFilter to missing value
	if flagsJson is not missing value then
		set flagsFilter to my parseJsonObject(flagsJson)
	end if
	
	-- Search through mailboxes
	repeat with mailbox in mailboxesToSearch
		try
			repeat with msg in messages of mailbox
				if messageCount ≥ maxResults then exit repeat
				
				-- Check if message matches all filters
				set messageMatches to true
				
				-- Apply sender filter
				if senderFilter is not missing value and messageMatches then
					set msgSender to sender of msg
					if msgSender does not contain senderFilter then
						set messageMatches to false
					end if
				end if
				
				-- Apply subject filter
				if subjectFilter is not missing value and messageMatches then
					set msgSubject to subject of msg
					if msgSubject does not contain subjectFilter then
						set messageMatches to false
					end if
				end if
				
				-- Apply flags filter
				if flagsFilter is not missing value and messageMatches then
					if not my matchesFlags(msg, flagsFilter) then
						set messageMatches to false
					end if
				end if
				
				-- If message matches all filters, collect message object
				if messageMatches then
					set end of matchedMessageObjects to msg
					set messageCount to messageCount + 1
				end if
				
				if messageCount ≥ maxResults then exit repeat
			end repeat
		end try
		
			if messageCount ≥ maxResults then exit repeat
		end repeat
		
		-- Sort collected messages
		set sortedMessages to my sortMessages(matchedMessageObjects, sortByOption)
		
		-- Build message info from sorted list
		repeat with msg in sortedMessages
			set messageInfo to my buildMessageInfo(msg, shouldIncludeBody)
			set end of matchedMessages to messageInfo
		end repeat
	end if
	
	-- Build JSON result
	set resultJson to "{\"success\":true,\"count\":" & messageCount & ",\"messages\":["
	set first to true
	repeat with msgInfo in matchedMessages
		if not first then
			set resultJson to resultJson & ","
		else
			set first to false
		end if
		set resultJson to resultJson & msgInfo
	end repeat
	set resultJson to resultJson & "]}"
	
	return resultJson
end tell

-- Helper: Build message info JSON
on buildMessageInfo(msg, includeBody)
	tell application "Mail"
		set msgId to id of msg
		set msgSender to sender of msg
		set msgSubject to subject of msg
		set msgDate to date received of msg
		set msgRead to read status of msg
		set msgFlagged to flagged status of msg
		set msgReplied to replied to status of msg
		set msgForwarded to false -- AppleScript doesn't expose forwarded status directly
		set msgDeleted to deleted status of msg
		set msgJunk to junk mail status of msg
		
		-- Escape special characters for JSON
		set msgSenderEscaped to my escapeJson(msgSender)
		set msgSubjectEscaped to my escapeJson(msgSubject)
		
		set info to "{" & ""
		set info to info & "\"id\":\"" & msgId & "\","
		set info to info & "\"sender\":\"" & msgSenderEscaped & "\","
		set info to info & "\"subject\":\"" & msgSubjectEscaped & "\","
		set info to info & "\"date\":\"" & msgDate & "\","
		set info to info & "\"flags\":{" & ""
		set info to info & "\"read\":" & msgRead & ","
		set info to info & "\"flagged\":" & msgFlagged & ","
		set info to info & "\"replied\":" & msgReplied & ","
		set info to info & "\"forwarded\":" & msgForwarded & ","
		set info to info & "\"deleted\":" & msgDeleted & ","
		set info to info & "\"junk\":" & msgJunk & "}"
		
		if includeBody then
			set msgBody to content of msg
			set msgBodyEscaped to my escapeJson(msgBody)
			set info to info & ",\"body\":\"" & msgBodyEscaped & "\""
		end if
		
		set info to info & "}"
		return info
	end tell
end buildMessageInfo

-- Helper: Check if message matches flag filters
on matchesFlags(msg, flagsFilter)
	tell application "Mail"
		-- Check each flag in the filter
		if flagsFilter contains "read" then
			set expectedRead to my getJsonValue(flagsFilter, "read")
			if (read status of msg) is not expectedRead then return false
		end if
		
		if flagsFilter contains "flagged" then
			set expectedFlagged to my getJsonValue(flagsFilter, "flagged")
			if (flagged status of msg) is not expectedFlagged then return false
		end if
		
		if flagsFilter contains "replied" then
			set expectedReplied to my getJsonValue(flagsFilter, "replied")
			if (replied to status of msg) is not expectedReplied then return false
		end if
		
		if flagsFilter contains "deleted" then
			set expectedDeleted to my getJsonValue(flagsFilter, "deleted")
			if (deleted status of msg) is not expectedDeleted then return false
		end if
		
		-- Note: junk is a boolean property in Mail
		if flagsFilter contains "junk" then
			set expectedJunk to my getJsonValue(flagsFilter, "junk")
			if (junk mail status of msg) is not expectedJunk then return false
		end if
		
		return true
	end tell
end matchesFlags

-- Helper: Parse JSON array (simple implementation)
on parseJsonArray(jsonStr)
	-- Remove brackets and quotes, split by comma
	set jsonStr to text 2 thru -2 of jsonStr -- Remove [ ]
	set AppleScript's text item delimiters to "\",\""
	set items to text items of jsonStr
	set AppleScript's text item delimiters to ""
	
	set result to {}
	repeat with item in items
		-- Remove leading/trailing quotes
		set cleanItem to item
		if cleanItem starts with "\"" then set cleanItem to text 2 thru -1 of cleanItem
		if cleanItem ends with "\"" then set cleanItem to text 1 thru -2 of cleanItem
		set end of result to cleanItem
	end repeat
	
	return result
end parseJsonArray

-- Helper: Parse JSON object (simple implementation)
on parseJsonObject(jsonStr)
	-- This is a simplified parser - just stores the string
	-- and provides lookup methods
	return jsonStr
end parseJsonObject

-- Helper: Get value from JSON object
on getJsonValue(jsonStr, key)
	-- Simple JSON value extraction
	set searchStr to "\"" & key & "\":"
	set startPos to offset of searchStr in jsonStr
	if startPos is 0 then return missing value
	
	set valueStart to startPos + (length of searchStr)
	set remainingStr to text valueStart thru -1 of jsonStr
	
	-- Get value (assumes boolean or simple value)
	if remainingStr starts with "true" then return true
	if remainingStr starts with "false" then return false
	
	return missing value
end getJsonValue

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

-- Helper: Sort messages
on sortMessages(messagesList, sortOption)
	tell application "Mail"
		if (count of messagesList) ≤ 1 then return messagesList
		
		-- Simple bubble sort (good enough for typical result sizes)
		set sortedList to messagesList
		set listSize to count of sortedList
		
		repeat with i from 1 to listSize - 1
			repeat with j from 1 to listSize - i
				set msg1 to item j of sortedList
				set msg2 to item (j + 1) of sortedList
				
				set shouldSwap to false
				
				if sortOption is "date-newest" then
					-- Most recent first (descending)
					if (date received of msg1) < (date received of msg2) then
						set shouldSwap to true
					end if
				else if sortOption is "date-oldest" then
					-- Oldest first (ascending)
					if (date received of msg1) > (date received of msg2) then
						set shouldSwap to true
					end if
				else if sortOption is "sender" then
					-- Alphabetical by sender
					if (sender of msg1) > (sender of msg2) then
						set shouldSwap to true
					end if
				else if sortOption is "subject" then
					-- Alphabetical by subject
					if (subject of msg1) > (subject of msg2) then
						set shouldSwap to true
					end if
				end if
				
				if shouldSwap then
					set temp to item j of sortedList
					set item j of sortedList to item (j + 1) of sortedList
					set item (j + 1) of sortedList to temp
				end if
			end repeat
		end repeat
		
		return sortedList
	end tell
end sortMessages
