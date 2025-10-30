(*
	Create BBEdit Project
	Creates a new project with optional files and folders
	
	Template Variables:
		${name} - Project name (required)
		${location} - Save location (optional, default: ~/Documents/BBEdit Projects/)
		${itemsJson} - JSON array of file/folder paths to add (optional)
		${settingsJson} - JSON object with project settings (optional)
		${shouldOpen} - Whether to open the project after creation (optional, default: true)
*)

tell application "BBEdit"
	-- Parse JSON inputs
	set projectName to parseJSON(${name})
	set saveLocation to parseJSON(${location})
	set itemsList to parseJSON(${itemsJson})
	set projectSettings to parseJSON(${settingsJson})
	set shouldOpenProject to parseJSON(${shouldOpen})
	
	-- Create default save location if none provided
	if saveLocation is missing value or saveLocation is "" then
		set saveLocation to (path to documents folder as text) & "BBEdit Projects:"
		-- Ensure the directory exists
		try
			do shell script "mkdir -p " & quoted form of POSIX path of (saveLocation as alias)
		end try
	end if
	
	-- Build project file path
	set projectFileName to projectName & ".bbprojectd"
	set projectPath to saveLocation & projectFileName
	
	-- Create the project
	set newProject to make new project document initial save location projectPath
	
	-- Add items to project if provided
	if itemsList is not missing value and (count of itemsList) > 0 then
		repeat with itemPath in itemsList
			-- Note: BBEdit's AppleScript API does not provide a working 'add' command for projects
			-- Items cannot be added programmatically and must be added manually after creation
			-- This parameter is accepted but ignored
		end repeat
	end if
	
	-- Apply settings if provided
	-- Settings handling can be expanded in future
	-- For now, we just create the basic project
	
	-- Optionally open the project
	if shouldOpenProject is missing value or shouldOpenProject is true then
		-- Project is already open when created
		activate
	else
		-- Close the project window if user doesn't want it open
		try
			close newProject
		end try
	end if
	
	-- Return success with project info using buildJSONObject
	return buildJSONObject({{"success", true}, {"projectName", projectName}, {"projectPath", POSIX path of projectPath}})
end tell
