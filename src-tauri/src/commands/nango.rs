use std::process::Command;

#[tauri::command]
pub fn deploy_integration(project_dir: String) -> Result<String, String> {
    let output = Command::new("npx")
        .arg("nango")
        .arg("deploy")
        .current_dir(&project_dir)
        .output()
        .map_err(|e| format!("Failed to run nango deploy: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn dryrun_sync(project_dir: String, sync_name: String) -> Result<String, String> {
    let output = Command::new("npx")
        .args(["nango", "dryrun", &sync_name])
        .current_dir(&project_dir)
        .output()
        .map_err(|e| format!("Failed to run nango dryrun: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
