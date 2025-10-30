(*
	Get Extended File Information
	Gets detailed information about files including Spotlight comments, tags, labels, etc.
	
	Parameters (all JSON strings):
		filePath - Path to file or folder
*)

on run argv
	if (count of argv) < 1 then
		return "Error: Missing required parameter (filePath)"
	end if
	
	-- Parse JSON input
	set filePath to parseJSON(item 1 of argv)
	
	try
		set fileItem to POSIX file filePath as alias
		
		tell application "Finder"
			set fileName to name of fileItem
			set fileSize to size of fileItem
			set creationDate to creation date of fileItem
			set modificationDate to modification date of fileItem
			set labelIdx to label index of fileItem
			set fileKind to kind of fileItem
			set fileComment to comment of fileItem
			
			-- Get label name
			set labelName to ""
			if labelIdx is 0 then
				set labelName to "None"
			else if labelIdx is 1 then
				set labelName to "Red"
			else if labelIdx is 2 then
				set labelName to "Orange"
			else if labelIdx is 3 then
				set labelName to "Yellow"
			else if labelIdx is 4 then
				set labelName to "Green"
			else if labelIdx is 5 then
				set labelName to "Blue"
			else if labelIdx is 6 then
				set labelName to "Purple"
			else if labelIdx is 7 then
				set labelName to "Gray"
			end if
			
			-- Check if it's a folder
			set isFolder to false
			try
				set folderTest to folder fileItem
				set isFolder to true
			end try
		end tell
		
		-- Get tags using mdls (more reliable than Finder for tags)
		set tagsJson to "[]"
		try
			set tagsRaw to do shell script "mdls -name kMDItemUserTags -raw " & quoted form of POSIX path of fileItem
			if tagsRaw is not "(null)" and tagsRaw is not "" then
				-- Parse tags (basic parsing)
				set tagsJson to "[" & text 2 thru -2 of tagsRaw & "]"
			end if
		end try
		
		-- Parse tags from JSON if we got them
		set tagsList to {}
		if tagsJson is not "[]" then
			try
				set tagsList to parseJSON(tagsJson)
			end try
		end if
		
		-- Return using buildJSONObject
		return buildJSONObject({{"path", filePath}, {"name", fileName}, {"size", fileSize}, {"kind", fileKind}, {"isFolder", isFolder}, {"created", creationDate as string}, {"modified", modificationDate as string}, {"labelIndex", labelIdx}, {"labelName", labelName}, {"comment", fileComment}, {"tags", tagsList}})
		
	on error errMsg number errNum
		return "Error (" & errNum & "): " & errMsg
	end try
end run
