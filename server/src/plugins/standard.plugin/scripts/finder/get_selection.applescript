(*
	Get Finder Selection
	Returns the currently selected items in Finder
	
	No parameters required
*)

on run
	try
		tell application "Finder"
			set selectedItems to selection
			
			if (count of selectedItems) is 0 then
				return buildJSONObject({{"count", 0}, {"items", {}}})
			end if
			
			set resultList to {}
			
			repeat with selectedItem in selectedItems
				set itemPath to POSIX path of (selectedItem as alias)
				set itemName to name of selectedItem
				set itemKind to kind of selectedItem
				
				-- Check if folder
				set isFolder to false
				try
					set folderTest to folder selectedItem
					set isFolder to true
				end try
				
				set resultEntry to {path:itemPath, name:itemName, kind:itemKind, isFolder:isFolder}
				set end of resultList to resultEntry
			end repeat
			
			-- Return using buildJSONObject
			return buildJSONObject({{"count", count of resultList}, {"items", resultList}})
		end tell
		
	on error errMsg number errNum
		return "Error (" & errNum & "): " & errMsg
	end try
end run
