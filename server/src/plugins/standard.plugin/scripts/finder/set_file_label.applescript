(*
	Set Finder Label Color
	Sets the label color for one or more files/folders
	
	Parameters (all JSON strings):
		pathsJson - JSON array of file/folder paths
		labelIndex - Label index (0=None, 1=Red, 2=Orange, 3=Yellow, 4=Green, 5=Blue, 6=Purple, 7=Gray)
*)

on run argv
	if (count of argv) < 2 then
		return "Error: Missing required parameters (paths, labelIndex)"
	end if
	
	-- Parse JSON inputs
	set filePaths to parseValue(item 1 of argv)
	set labelIndex to parseValue(item 2 of argv)
	
	-- Validate label index
	if labelIndex < 0 or labelIndex > 7 then
		return "Error: Label index must be between 0 and 7"
	end if
	
	if (count of filePaths) is 0 then
		return "Error: No valid paths provided"
	end if
	
	set successCount to 0
	set failedPaths to {}
	
	tell application "Finder"
		repeat with filePath in filePaths
			try
				set fileItem to POSIX file filePath as alias
				set label index of fileItem to labelIndex
				set successCount to successCount + 1
			on error errMsg
				set end of failedPaths to filePath & " (" & errMsg & ")"
			end try
		end repeat
	end tell
	
	-- Return using buildJSONObject
	set resultData to {{"successCount", successCount}, {"totalCount", count of filePaths}, {"message", "Successfully set label for " & successCount & " of " & (count of filePaths) & " items"}}
	
	if (count of failedPaths) > 0 then
		set end of resultData to {"failedPaths", failedPaths}
	end if
	
	return buildJSONObject(resultData)
end run
