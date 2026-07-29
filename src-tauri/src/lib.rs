// Tauri runtime entry point. Intentionally minimal: this is a thin shell
// around the existing FMG web build, with no business logic or JS hooks.
// The CORS-avoidance strategy relies entirely on Tauri's `tauri://localhost`
// custom protocol (HTTP semantics, same-origin) plus the asset protocol
// (`assetProtocol`) enabled in `tauri.conf.json`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running FMG desktop");
}
