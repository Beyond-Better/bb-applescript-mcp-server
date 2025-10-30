-- Mark Mail Script
-- Mark messages with specific flags
-- Template variables: ${messageIds}, ${flagType}, ${flagValue}

tell application "Mail"
	set messageIdsJson to ${messageIds}
	set flagType to ${flagType}
	set flagValue to ${flagValue}
	
	-- Parse message IDs from JSON array
	set messageIds to my parseJsonArray(messageIdsJson)
	
	-- Track results
	set successCount to 0
	set failedIds to {}
	
	-- Process each message
	repeat with msgId in messageIds
		try
			-- Find the message by ID
			set foundMessage to missing value
			repeat with acc in accounts
				repeat with mb in mailboxes of acc
					repeat with msg in messages of mb
						if id of msg is msgId then
							set foundMessage to msg
							exit repeat
						end if
					end repeat
					if foundMessage is not missing value then exit repeat
				end repeat
				if foundMessage is not missing value then exit repeat
			end repeat
			
			if foundMessage is not missing value then
				-- Apply the flag based on type
				if flagType is "read" then
					set read status of foundMessage to flagValue
				else if flagType is "flagged" then
					set flagged status of foundMessage to flagValue
				else if flagType is "deleted" then
					set deleted status of foundMessage to flagValue
				else if flagType is "junk" then
					set junk mail status of foundMessage to flagValue
				end if
				
				set successCount to successCount + 1
			else
				-- Message not found
				set end of failedIds to msgId
			end if
			on error errMsg
			-- Error processing this message
			set end of failedIds to msgId
		end try
	end repeat
	
	-- Build JSON result
	set resultJson to "{\"success\":true,"
	set resultJson to resultJson & "\"processedCount\":" & (count of messageIds) & ","
	set resultJson to resultJson & "\"successCount\":" & successCount & ","
	set resultJson to resultJson & "\"failedCount\":" & (count of failedIds) & ","
	set resultJson to resultJson & "\"flagType\":\"" & flagType & "\","
	set resultJson to resultJson & "\"flagValue\":" & flagValue
	
	if (count of failedIds) > 0 then
		set resultJson to resultJson & ",\"failedIds\":["
		set first to true
		repeat with failedId in failedIds
			if not first then
				set resultJson to resultJson & ","
			else
				set first to false
			end if
			set resultJson to resultJson & "\"" & failedId & "\""
		end repeat
		set resultJson to resultJson & "]"
	end if
	
	set resultJson to resultJson & "}"
	
	return resultJson
end tell

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
