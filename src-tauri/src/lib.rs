mod commands;

use commands::{codegen, nango, project};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            codegen::generate_code,
            nango::deploy_integration,
            nango::dryrun_sync,
            project::save_project,
            project::open_project,
            project::list_project_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
