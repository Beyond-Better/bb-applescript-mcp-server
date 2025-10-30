-- Mark Mail Script
-- Mark messages with specific flags
-- Template variables (all JSON strings, parsed with parseJSON): ${messageIds}, ${flagType}, ${flagValue}

tell application "Mail"
	-- Parse JSON inputs
	set messageIds to parseJSON(${messageIds})
	set flagType to parseJSON(${flagType})
	set flagValue to parseJSON(${flagValue})
	
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
	
	-- Build result using buildJSONObject
	set resultPairs to {{"success", true}, {"processedCount", count of messageIds}, {"successCount", successCount}, {"failedCount", count of failedIds}, {"flagType", flagType}, {"flagValue", flagValue}}
	
	if (count of failedIds) > 0 then
		set end of resultPairs to {"failedIds", failedIds}
	end if
	
	return buildJSONObject(resultPairs)
end tell
