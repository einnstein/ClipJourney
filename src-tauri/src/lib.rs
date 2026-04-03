// src-tauri/src/lib.rs

use std::process::Command;
use std::fs;
use base64::{Engine as _, engine::general_purpose};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Helper function to get bundled FFmpeg path
fn get_ffmpeg_path(app: &tauri::AppHandle) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        return Ok("ffmpeg".to_string());
    }
    
    #[cfg(not(debug_assertions))]
    {
        if let Ok(resource_path) = app.path().resource_dir() {
            let ffmpeg_path = resource_path.join("ffmpeg.exe");
            if ffmpeg_path.exists() {
                return Ok(ffmpeg_path.to_string_lossy().to_string());
            }
        }
        
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let up_path = exe_dir.join("_up_").join("resources").join("ffmpeg.exe");
                if up_path.exists() {
                    return Ok(up_path.to_string_lossy().to_string());
                }
            }
        }
        
        Err("FFmpeg not found in any expected location".to_string())
    }
}

fn get_ffprobe_path(app: &tauri::AppHandle) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        return Ok("ffprobe".to_string());
    }
    
    #[cfg(not(debug_assertions))]
    {
        if let Ok(resource_path) = app.path().resource_dir() {
            let ffprobe_path = resource_path.join("ffprobe.exe");
            if ffprobe_path.exists() {
                return Ok(ffprobe_path.to_string_lossy().to_string());
            }
        }
        
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let up_path = exe_dir.join("_up_").join("resources").join("ffprobe.exe");
                if up_path.exists() {
                    return Ok(up_path.to_string_lossy().to_string());
                }
            }
        }
        
        Err("FFprobe not found in any expected location".to_string())
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_video_duration(app: tauri::AppHandle, path: String) -> Result<f64, String> {
    let ffprobe_path = get_ffprobe_path(&app)?;
    
    let mut cmd = Command::new(ffprobe_path);
    cmd.args([
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        &path
    ]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    let duration_str = String::from_utf8_lossy(&output.stdout);
    let duration: f64 = duration_str.trim().parse()
        .map_err(|e| format!("Failed to parse duration: {}", e))?;

    Ok(duration)
}

#[tauri::command]
fn generate_thumbnail(app: tauri::AppHandle, video_path: String) -> Result<String, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("thumb_{}.jpg", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()));
    
    let temp_path = temp_file.to_str().ok_or("Invalid temp path")?;

    let mut cmd = Command::new(ffmpeg_path);
    cmd.args([
        "-i", &video_path,
        "-ss", "00:00:01.000",
        "-vframes", "1",
        "-vf", "scale=160:90",
        "-y",
        temp_path
    ]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    
    let output = cmd.output()
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
fn generate_timeline_thumbnails(app: tauri::AppHandle, video_path: String, count: u32) -> Result<Vec<String>, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let ffprobe_path = get_ffprobe_path(&app)?;
    
    let temp_dir = std::env::temp_dir();
    let mut thumbnails = Vec::new();

    let mut cmd = Command::new(ffprobe_path);
    cmd.args([
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        &video_path
    ]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    
    let duration_output = cmd.output()
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

        let mut cmd = Command::new(&ffmpeg_path);
        cmd.args([
            "-ss", &format!("{:.2}", timestamp),
            "-i", &video_path,
            "-vframes", "1",
            "-vf", "scale=80:45",
            "-y",
            temp_path
        ]);
        
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);
        
        let output = cmd.output()
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
    
    let excluded_folder = parent.join("Excluded");
    fs::create_dir_all(&excluded_folder)
        .map_err(|e| format!("Failed to create Excluded folder: {}", e))?;
    
    let new_path = excluded_folder.join(filename);
    fs::rename(&file_path, &new_path)
        .map_err(|e| format!("Failed to move file: {}", e))?;
    
    Ok(new_path.to_str().ok_or("Invalid path")?.to_string())
}

#[tauri::command]
fn run_ffmpeg(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    
    let mut cmd = Command::new(ffmpeg_path);
    cmd.args(&args);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(format!("Success!\nStdout: {}\nStderr: {}", stdout, stderr))
    } else {
        Err(format!("FFmpeg failed with status: {}\nStderr: {}", output.status, stderr))
    }
}

#[tauri::command]
fn get_video_resolution(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let ffprobe_path = get_ffprobe_path(&app)?;
    
    let mut cmd = Command::new(ffprobe_path);
    cmd.args(&[
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=p=0",
        &path
    ]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffprobe failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parts: Vec<&str> = result.split(',').collect();
    if parts.len() == 2 {
        Ok(format!("{}x{}", parts[0], parts[1]))
    } else {
        Err("Failed to parse resolution".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_video_duration, 
            generate_thumbnail,
            read_image_as_base64,
            generate_timeline_thumbnails,
            exclude_file,
            run_ffmpeg,
            get_video_resolution
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}