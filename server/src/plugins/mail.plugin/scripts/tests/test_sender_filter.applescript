-- Test Sender Filter Script
-- Diagnose why sender filtering isn't working
-- Template variables: ${accountName}, ${mailboxName}, ${senderSearch}

-- Parse inputs
set accountNameFilter to parseValue(${accountName})
set mailboxNameFilter to parseValue(${mailboxName})
set senderSearchTerm to parseValue(${senderSearch})

tell application "Mail"
	set results to {}
	set foundAccount to missing value
	set foundMailbox to missing value
	
	-- Find the specified account (case-insensitive)
	if accountNameFilter is not missing value then
		repeat with acc in accounts
			set accName to name of acc
			if my toLower(accName) is equal to my toLower(accountNameFilter) then
				set foundAccount to acc
				log "Found account: " & accName
				exit repeat
			end if
		end repeat
		
		if foundAccount is missing value then
			return buildJSONObject({{"success", false}, {"error", "Account not found: " & accountNameFilter}})
		end if
	else
		-- Use first account if not specified
		set foundAccount to first account
		log "Using first account: " & (name of foundAccount)
	end if
	
	-- Find the specified mailbox (case-insensitive)
	if mailboxNameFilter is not missing value then
		repeat with mb in mailboxes of foundAccount
			set mbName to name of mb
			if my toLower(mbName) is equal to my toLower(mailboxNameFilter) then
				set foundMailbox to mb
				log "Found mailbox: " & mbName
				exit repeat
			end if
		end repeat
		
		if foundMailbox is missing value then
			return buildJSONObject({{"success", false}, {"error", "Mailbox not found: " & mailboxNameFilter}})
		end if
	else
		-- Use INBOX if not specified
		repeat with mb in mailboxes of foundAccount
			if my toLower(name of mb) is equal to "inbox" then
				set foundMailbox to mb
				exit repeat
			end if
		end repeat
		
		if foundMailbox is missing value then
			set foundMailbox to first mailbox of foundAccount
		end if
		log "Using mailbox: " & (name of foundMailbox)
	end if
	
	-- Get first 10 messages from the mailbox
	log "Getting first 10 messages..."
	set sampleMessages to messages 1 thru 10 of foundMailbox
	log "Retrieved " & (count of sampleMessages) & " messages"
	
	-- Collect sender information
	set senderList to {}
	repeat with msg in sampleMessages
		set msgSender to sender of msg
		set msgSubject to subject of msg
		set msgId to id of msg
		
		-- Build message info
		set msgInfo to {{"id", msgId}, {"sender", msgSender}, {"subject", msgSubject}}
		
		-- Check if this sender matches our search term
		set matchesSearch to false
		if senderSearchTerm is not missing value then
			set senderLower to my toLower(msgSender)
			set searchLower to my toLower(senderSearchTerm)
			
			-- Test different matching strategies
			set exactMatch to (senderLower is equal to searchLower)
			set containsMatch to (senderLower contains searchLower)
			set emailMatch to (msgSender contains senderSearchTerm)
			
			if exactMatch or containsMatch or emailMatch then
				set matchesSearch to true
				set msgInfo to msgInfo & {{"matchType", "exact:" & exactMatch & ", contains:" & containsMatch & ", email:" & emailMatch}}
			end if
		end if
		
		set msgInfo to msgInfo & {{"matchesSearch", matchesSearch}}
		set end of senderList to msgInfo
	end repeat
	
	-- Now test Mail.app's native 'whose' clause
	set nativeFilterResults to {}
	if senderSearchTerm is not missing value then
		log "Testing native 'whose' clause with: " & senderSearchTerm
		
		-- Test 1: Exact match
		try
			set exactMatches to (messages of foundMailbox whose sender is senderSearchTerm)
			log "Exact match (is): " & (count of exactMatches) & " messages"
			set end of nativeFilterResults to {{"filterType", "exact (is)"}, {"count", count of exactMatches}}
		end try
		
		-- Test 2: Contains (case-sensitive)
		try
			set containsMatches to (messages of foundMailbox whose sender contains senderSearchTerm)
			log "Contains match: " & (count of containsMatches) & " messages"
			set end of nativeFilterResults to {{"filterType", "contains"}, {"count", count of containsMatches}}
		end try
		
		-- Test 3: Starts with
		try
			set startsWithMatches to (messages of foundMailbox whose sender starts with senderSearchTerm)
			log "Starts with match: " & (count of startsWithMatches) & " messages"
			set end of nativeFilterResults to {{"filterType", "starts with"}, {"count", count of startsWithMatches}}
		end try
		
		-- Test 4: Ends with
		try
			set endsWithMatches to (messages of foundMailbox whose sender ends with senderSearchTerm)
			log "Ends with match: " & (count of endsWithMatches) & " messages"
			set end of nativeFilterResults to {{"filterType", "ends with"}, {"count", count of endsWithMatches}}
		end try
	end if
	
	return buildJSONObject({{"success", true}, {"account", name of foundAccount}, {"mailbox", name of foundMailbox}, {"searchTerm", senderSearchTerm}, {"sampleMessages", senderList}, {"nativeFilters", nativeFilterResults}})
end tell

-- Helper: Convert string to lowercase
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
