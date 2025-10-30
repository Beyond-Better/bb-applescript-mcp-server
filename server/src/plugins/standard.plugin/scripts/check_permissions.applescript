(*
	Check AppleScript Automation Permissions
	Checks if automation permissions are granted for specified applications
	
	Parameters (all JSON strings):
		appsJson - JSON array of application names to check (optional)
		If not provided, checks common applications: Finder, BBEdit, Terminal
*)

on run argv
	set appsToCheck to {"Finder", "BBEdit", "Terminal"}
	
	-- Parse apps list if provided
	if (count of argv) > 0 then
		set appsToCheck to parseJSON(item 1 of argv)
	end if
	
	set resultList to {}
	set hasAllPermissions to true
	
	repeat with appName in appsToCheck
		
		set permissionStatus to "unknown"
		set hasPermission to false
		set errorMsg to ""
		
		try
			-- Try to perform a simple operation on the app
			if appName is "Finder" then
				tell application "Finder"
					set testResult to name of startup disk
				end tell
				set hasPermission to true
				set permissionStatus to "authorized"
			else if appName is "BBEdit" then
				try
					tell application "BBEdit"
						set testResult to name of front window
					end tell
					set hasPermission to true
					set permissionStatus to "authorized"
				on error
					-- BBEdit might not be running, but if we can check that, permission is OK
					tell application "System Events"
						if exists application process "BBEdit" then
							set hasPermission to true
							set permissionStatus to "authorized"
						else
							-- Try to check if app exists
							set appPath to path to application "BBEdit"
							set hasPermission to true
							set permissionStatus to "not_determined"
						end if
					end tell
				end try
			else if appName is "Terminal" then
				tell application "System Events"
					if exists application process "Terminal" then
						tell application "Terminal"
							set testResult to name of front window
						end tell
						set hasPermission to true
						set permissionStatus to "authorized"
					else
						set hasPermission to true
						set permissionStatus to "not_determined"
					end if
				end tell
			else
				-- Generic check for other apps
				try
					tell application appName
						set testResult to name
					end tell
					set hasPermission to true
					set permissionStatus to "authorized"
				on error errMsg
					if errMsg contains "not allowed" or errMsg contains "not authorized" then
						set permissionStatus to "denied"
					else
						set permissionStatus to "not_determined"
					end if
				end try
			end if
			
		on error errMsg
			-- Permission denied or app doesn't exist
			if errMsg contains "not allowed" or errMsg contains "not authorized" then
				set permissionStatus to "denied"
				set errorMsg to "Permission denied. Grant access in System Settings > Privacy & Security > Automation"
			else
				set permissionStatus to "error"
				set errorMsg to errMsg
			end if
		end try
		
		-- Build result entry as list of pairs for buildJSONObject
		if errorMsg is not "" then
			set resultEntry to {{"name", appName}, {"hasPermission", hasPermission}, {"status", permissionStatus}, {"instructions", errorMsg}}
		else
			set resultEntry to {{"name", appName}, {"hasPermission", hasPermission}, {"status", permissionStatus}}
		end if
		
		set end of resultList to resultEntry
		
		if not hasPermission then
			set hasAllPermissions to false
		end if
	end repeat
	
	-- Return using buildJSONObject
	return buildJSONObject({{"hasPermissions", hasAllPermissions}, {"applications", resultList}})
end run
