// src-tauri/src/lib.rs

use std::process::Command;
use std::fs;
use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_video_duration(path: String) -> Result<f64, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &path
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    let duration_str = String::from_utf8_lossy(&output.stdout);
    let duration: f64 = duration_str.trim().parse()
        .map_err(|e| format!("Failed to parse duration: {}", e))?;

    Ok(duration)
}

#[tauri::command]
fn generate_thumbnail(video_path: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("thumb_{}.jpg", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()));
    
    let temp_path = temp_file.to_str().ok_or("Invalid temp path")?;

    let output = Command::new("ffmpeg")
        .args([
            "-i", &video_path,
            "-ss", "00:00:01.000",
            "-vframes", "1",
            "-vf", "scale=160:90",
            "-y",
            temp_path
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("FFmpeg error: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let image_data = fs::read(temp_path)
        .map_err(|e| format!("Failed to read thumbnail: {}", e))?;
    
    let base64_image = general_purpose::STANDARD.encode(&image_data);
    
    let _ = fs::remove_file(temp_path);

    Ok(format!("data:image/jpeg;base64,{}", base64_image))
}

#[tauri::command]
fn read_image_as_base64(image_path: String) -> Result<String, String> {
    let image_data = fs::read(&image_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;
    
    let base64_image = general_purpose::STANDARD.encode(&image_data);
    
    let ext = image_path.split('.').last().unwrap_or("jpg").to_lowercase();
    let mime_type = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        _ => "image/jpeg"
    };

    Ok(format!("data:{};base64,{}", mime_type, base64_image))
}

#[tauri::command]
fn generate_timeline_thumbnails(video_path: String, count: u32) -> Result<Vec<String>, String> {
    let temp_dir = std::env::temp_dir();
    let mut thumbnails = Vec::new();

    let duration_output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &video_path
        ])
        .output()
        .map_err(|e| format!("Failed to get duration: {}", e))?;

    let duration: f64 = String::from_utf8_lossy(&duration_output.stdout)
        .trim()
        .parse()
        .map_err(|e| format!("Failed to parse duration: {}", e))?;

    let interval = duration / (count as f64);

    for i in 0..count {
        let timestamp = i as f64 * interval;
        let temp_file = temp_dir.join(format!("timeline_thumb_{}_{}.jpg", 
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            i
        ));
        let temp_path = temp_file.to_str().ok_or("Invalid temp path")?;

        let output = Command::new("ffmpeg")
            .args([
                "-ss", &format!("{:.2}", timestamp),
                "-i", &video_path,
                "-vframes", "1",
                "-vf", "scale=80:45",
                "-y",
                temp_path
            ])
            .output()
            .map_err(|e| format!("Failed to generate thumbnail {}: {}", i, e))?;

        if !output.status.success() {
            continue;
        }

        if let Ok(image_data) = fs::read(temp_path) {
            let base64_image = general_purpose::STANDARD.encode(&image_data);
            thumbnails.push(format!("data:image/jpeg;base64,{}", base64_image));
        }

        let _ = fs::remove_file(temp_path);
    }

    Ok(thumbnails)
}

#[tauri::command]
fn exclude_file(file_path: String) -> Result<String, String> {
    use std::path::Path;
    
    let path = Path::new(&file_path);
    let parent = path.parent().ok_or("No parent directory")?;
    let filename = path.file_name().ok_or("No filename")?.to_str().ok_or("Invalid filename")?;
    
    // Create "Excluded" folder in the same directory as the file
    let excluded_folder = parent.join("Excluded");
    fs::create_dir_all(&excluded_folder)
        .map_err(|e| format!("Failed to create Excluded folder: {}", e))?;
    
    // Move file to Excluded folder
    let new_path = excluded_folder.join(filename);
    fs::rename(&file_path, &new_path)
        .map_err(|e| format!("Failed to move file: {}", e))?;
    
    Ok(new_path.to_str().ok_or("Invalid path")?.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())  // ADD THIS LINE
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_video_duration, 
            generate_thumbnail,
            read_image_as_base64,
            generate_timeline_thumbnails,
            exclude_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}