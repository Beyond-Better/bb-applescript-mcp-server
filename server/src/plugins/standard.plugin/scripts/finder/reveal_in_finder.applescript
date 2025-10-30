(*
	Reveal in Finder
	Reveals and selects one or more files/folders in Finder
	
	Parameters (all JSON strings):
		pathsJson - JSON array of file/folder paths
*)

on run argv
	if (count of argv) < 1 then
		return "Error: Missing required parameter (paths)"
	end if
	
	-- Parse JSON input
	set filePaths to parseJSON(item 1 of argv)
	
	if (count of filePaths) is 0 then
		return "Error: No valid paths provided"
	end if
	
	set revealedItems to {}
	set failedPaths to {}
	
	tell application "Finder"
		activate
		
		repeat with filePath in filePaths
			try
				set fileItem to POSIX file filePath as alias
				reveal fileItem
				-- don't need both reveal and select - opens folder twice. 
				--select fileItem
				set end of revealedItems to filePath
			on error errMsg
				set end of failedPaths to filePath & " (" & errMsg & ")"
			end try
		end repeat
	end tell
	
	-- Return using buildJSONObject
	set resultData to {{"revealedCount", count of revealedItems}, {"totalCount", count of filePaths}, {"message", "Revealed " & (count of revealedItems) & " of " & (count of filePaths) & " items in Finder"}}
	
	if (count of failedPaths) > 0 then
		set end of resultData to {"failedPaths", failedPaths}
	end if
	
	return buildJSONObject(resultData)
end run
