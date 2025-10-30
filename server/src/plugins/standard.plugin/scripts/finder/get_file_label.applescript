(*
	Get Finder Label Color
	Gets the label color for one or more files/folders
	
	Parameters (all JSON strings):
		pathsJson - JSON array of file/folder paths
*)

on run argv
	if (count of argv) < 1 then
		return "Error: Missing required parameter (paths)"
	end if
	
	-- Parse JSON input
	set filePaths to parseValue(item 1 of argv)
	
	if (count of filePaths) is 0 then
		return "Error: No valid paths provided"
	end if
	
	set resultList to {}
	
	tell application "Finder"
		repeat with filePath in filePaths
			try
				set fileItem to POSIX file filePath as alias
				set labelIdx to label index of fileItem
				set labelName to ""
				
				-- Map index to name
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
				
				-- Build result entry as list of pairs for buildJSONObject
				set resultEntry to {{"path", filePath}, {"labelIndex", labelIdx}, {"labelName", labelName}}
				set end of resultList to resultEntry
			on error errMsg
				-- Build error entry as list of pairs for buildJSONObject
				set resultEntry to {{"path", filePath}, {"error", errMsg}}
				set end of resultList to resultEntry
			end try
		end repeat
	end tell
	
	-- Return using buildJSONArray
	return buildJSONArray(resultList)
end run
