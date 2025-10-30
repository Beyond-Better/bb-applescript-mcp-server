-- Read Mail Script
-- Search and retrieve email messages based on filters
-- Template variables (all JSON strings, parsed with parseValue): ${messageIds}, ${sender}, ${subject}, ${flags}, ${accounts}, ${mailboxes}, ${sortBy}, ${includeBody}, ${maxResults}

-- Parse JSON inputs
set messageIds to parseValue(${messageIds})
set senderFilter to parseValue(${sender})
set subjectFilter to parseValue(${subject})
set flagsFilter to parseValue(${flags})
set accountNames to parseValue(${accounts})
set mailboxNames to parseValue(${mailboxes})
set sortByOption to parseValue(${sortBy})
set shouldIncludeBody to parseValue(${includeBody})
set maxResults to parseValue(${maxResults})

-- TODO: Add support for qualified mailbox syntax (Option 2)
-- Parse mailboxNames entries like 'account:mailbox' to allow precise targeting
-- Example: 'work:inbox' searches only inbox in work account
-- Example: 'inbox' (no prefix) searches inbox across all accounts

-- TODO: Add support for account-mailbox pair objects (Option 3)
-- Accept mailboxFilters parameter with structure: [{account: 'work', mailbox: 'inbox'}, ...]
-- This provides maximum flexibility for complex cross-account queries

tell application "Mail"
	-- Initialize results
	set matchedMessages to {}
	set matchedMessageObjects to {} -- Store message objects for sorting
	set messageCount to 0
	
	-- If specific message IDs provided, retrieve only those
	if messageIds is not missing value then
		set requestedIds to messageIds
		
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
		-- Option 1: Simple independent filters (accounts AND mailboxes - Cartesian product)
		set mailboxesToSearch to {}
		
		-- Filter accounts first
		set accountsToSearch to {}
		if accountNames is not missing value then
			-- Filter by specific accounts
			repeat with acc in accounts
				set accName to name of acc
				if accName is in accountNames then
					set end of accountsToSearch to acc
				end if
			end repeat
		else
			-- Search all accounts
			set accountsToSearch to accounts
		end if
		
		-- Now filter mailboxes within the selected accounts
		if mailboxNames is not missing value then
			-- Find matching mailboxes in selected accounts
			repeat with acc in accountsToSearch
				repeat with mb in mailboxes of acc
					if name of mb is in mailboxNames then
						set end of mailboxesToSearch to mb
					end if
				end repeat
			end repeat
		else
			-- Search all mailboxes in selected accounts
			repeat with acc in accountsToSearch
				set mailboxesToSearch to mailboxesToSearch & mailboxes of acc
			end repeat
		end if
		
		-- Build native Mail.app filter using 'whose' clause
		-- This is much more efficient than loading all messages
		set hasFilters to (senderFilter is not missing value) or (subjectFilter is not missing value) or (flagsFilter is not missing value)
		
		-- Search through mailboxes using native filtering
		repeat with mbox in mailboxesToSearch
			try
				set candidateMessages to {}
				
				if hasFilters then
					-- Use native filtering with 'whose' clause for better performance
					set candidateMessages to my getFilteredMessages(mbox, senderFilter, subjectFilter, flagsFilter)
				else
					-- No filters, get all messages from mailbox
					set candidateMessages to messages of mbox
				end if
				
				-- Collect messages up to maxResults
				repeat with msg in candidateMessages
					if messageCount ≥ maxResults then exit repeat
					
					set end of matchedMessageObjects to msg
					set messageCount to messageCount + 1
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
end tell

-- Return using buildJSONObject
return buildJSONObject({{"success", true}, {"count", messageCount}, {"messages", matchedMessages}})

-- Helper: Build message info record
on buildMessageInfo(msg, includeBody)
	tell application "Mail"
		set msgId to id of msg
		set msgSender to sender of msg
		set msgSubject to subject of msg
		set msgDate to date received of msg
		set msgRead to read status of msg
		set msgFlagged to flagged status of msg
		set msgForwarded to false -- AppleScript doesn't expose forwarded status directly
		set msgDeleted to deleted status of msg
		set msgJunk to junk mail status of msg
		
		-- Build flags record
		-- Build flags as list of pairs for buildJSONObject
		set msgFlags to {{"read", msgRead}, {"flagged", msgFlagged}, {"forwarded", msgForwarded}, {"deleted", msgDeleted}, {"junk", msgJunk}}
		
		-- Build base info as list of pairs for buildJSONObject
		set info to {{"id", msgId}, {"sender", msgSender}, {"subject", msgSubject}, {"date", msgDate as string}, {"flags", msgFlags}}
		
		if includeBody then
			set msgBody to content of msg
			set end of info to {"body", msgBody}
		end if
		
		-- Convert to JSON object format
		return buildJSONObject(info)
	end tell
end buildMessageInfo

-- Helper: Get filtered messages using native Mail.app 'whose' clause
-- This is much more efficient than loading all messages and filtering manually
on getFilteredMessages(mbox, senderFilter, subjectFilter, flagsFilter)
	tell application "Mail"
		set filteredMessages to messages of mbox
		
		-- Apply sender filter using 'whose' clause
		if senderFilter is not missing value then
			set filteredMessages to (filteredMessages whose sender contains senderFilter)
		end if
		
		-- Apply subject filter using 'whose' clause
		if subjectFilter is not missing value then
			set filteredMessages to (filteredMessages whose subject contains subjectFilter)
		end if
		
		-- Apply flag filters using 'whose' clause
		if flagsFilter is not missing value then
			try
				set filterRead to |read| of flagsFilter
				set filteredMessages to (filteredMessages whose read status is filterRead)
			end try
			
			try
				set filterFlagged to flagged of flagsFilter
				set filteredMessages to (filteredMessages whose flagged status is filterFlagged)
			end try
			
			try
				set filterDeleted to deleted of flagsFilter
				set filteredMessages to (filteredMessages whose deleted status is filterDeleted)
			end try
			
			try
				set filterJunk to junk of flagsFilter
				set filteredMessages to (filteredMessages whose junk mail status is filterJunk)
			end try
		end if
		
		return filteredMessages
	end tell
end getFilteredMessages

-- Helper: Check if message matches flag filters
-- Note: This is kept for backwards compatibility but is no longer used in the main search
on matchesFlags(msg, flagsFilter)
	tell application "Mail"
		-- flagsFilter is now a parsed AppleScript record
		try
			set filterRead to |read| of flagsFilter
			if (read status of msg) is not filterRead then return false
		end try
		
		try
			set filterFlagged to flagged of flagsFilter
			if (flagged status of msg) is not filterFlagged then return false
		end try
		
		try
			set filterDeleted to deleted of flagsFilter
			if (deleted status of msg) is not filterDeleted then return false
		end try
		
		try
			set filterJunk to junk of flagsFilter
			if (junk mail status of msg) is not filterJunk then return false
		end try
		
		return true
	end tell
end matchesFlags



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
