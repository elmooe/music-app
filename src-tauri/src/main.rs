mod db;
use db::{ add_song, download_preset, fetch_presets, fetch_friends, fetch_samples, login_user, register_user, upload_preset, Preset, Sample };
use rodio::{Decoder, OutputStream, Sink};

use serde::{Serialize, Deserialize};
use tauri::State;
use std::{fs::{self, File}, io::BufReader, path::Path, sync::{Arc, Mutex}, thread::{self}};

#[derive(Serialize, Deserialize, Clone)]
struct Song {
    title: String,
}

pub struct AppState {
    current_song: Mutex<Option<Arc<Sink>>>,
    current_song_title: Mutex<Option<String>>,
    sample_cache: Mutex<Vec<Sample>>,
    song_cache: Mutex<Vec<Song>>,
    preset_cache: Mutex<Vec<Preset>>,
    directory_path: Mutex<Option<String>>,
    logged_in_user: Mutex<Option<String>>,
    friends_cache: Mutex<Vec<String>>,
}

#[tauri::command]
async fn register_user_command(username: String, password: String) -> Result<(), String> {
    register_user(username, password).await
}

#[tauri::command]
async fn login_user_command(
    username: String,
    password: String,
    state: State<'_, Arc<AppState>>,
) -> Result<bool, String> {
    let is_authenticated = login_user(username.clone(), password).await?;
    if is_authenticated {
        println!("✅ User '{}' authenticated successfully.", username);

        if let Err(e) = cache_friends(username.clone(), state.clone()).await {
            eprintln!("Failed to cache friends for '{}': {}", username, e);
        }

        let mut logged_in_user = state.logged_in_user.lock().unwrap();
        *logged_in_user = Some(username);
        println!("Logged in user set.");
    }
    Ok(is_authenticated)
}

#[tauri::command]
fn get_cached_friends(state: State<'_, Arc<AppState>>) -> Vec<String> {
    let cache = state.friends_cache.lock().unwrap();
    println!("📦 Returning cached friends. Total: {}", cache.len());
    cache.clone()
}

async fn cache_friends(username: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let friends = fetch_friends(&username).await.map_err(|e| format!("Failed to fetch friends: {}", e))?;
    let mut friends_cache = state.friends_cache.lock().unwrap();
    *friends_cache = friends;
    println!("Cached friends for '{}': {:?}", username, *friends_cache);
    Ok(())
}

#[tauri::command]
async fn remove_friend_command(
    friend_username: String,
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<(), String> {
    let me = {
        let logged_in_user = state.logged_in_user.lock().unwrap();
        logged_in_user.clone()
    }
    .ok_or("Must be logged in to remove a friend.")?;

    db::remove_friend(&me, &friend_username).await?;

    {
        let mut friends_cache = state.friends_cache.lock().unwrap();
        friends_cache.retain(|friend| friend != &friend_username);
    }

    {
        let mut sample_cache = state.sample_cache.lock().unwrap();
        sample_cache.retain(|sample| sample.uploaded_by != friend_username);

        let mut preset_cache = state.preset_cache.lock().unwrap();
        preset_cache.retain(|preset| preset.uploaded_by != friend_username);
    }

    println!("Removed friend '{}' for user '{}'", friend_username, me);
    Ok(())
}


#[tauri::command]
fn get_logged_in_user(state: State<'_, Arc<AppState>>) -> Option<String> {
    let logged_in_user = state.logged_in_user.lock().unwrap();
    logged_in_user.clone()
}

#[tauri::command]
async fn fetch_all_samples(state: State<'_, Arc<AppState>>) -> Result<Vec<Sample>, String> {
    println!("Fetching all samples from database...");

    let me = {
        let guard = state.logged_in_user.lock().unwrap();
        guard.clone()
    }.ok_or("Not logged in")?;

    let friends = match fetch_friends(&me).await {
        Ok(friends_list) => friends_list,
        Err(_) => {
            println!("No friends found for user '{}', defaulting to an empty list.", me);
            Vec::new()
        }
    };

    let all_samples = match fetch_samples().await {
        Ok(samples) => samples,
        Err(e) => return Err(format!("Failed to fetch samples: {}", e)),
    };

    let visible_samples: Vec<Sample> = all_samples.into_iter()
        .filter(|sample| {
            sample.uploaded_by == me || friends.contains(&sample.uploaded_by)
        })
        .collect();

        let mut cache = state.sample_cache.lock().unwrap();
        *cache = visible_samples.clone();

    Ok(visible_samples)
}

#[tauri::command]
async fn fetch_all_presets(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<Preset>, String> {

    let me = {
        let guard = state.logged_in_user.lock().unwrap();
        guard.clone()
    }.ok_or("Not logged in")?;

    let friends = match fetch_friends(&me).await {
        Ok(friends_list) => friends_list,
        Err(_) => {
            println!("No friends found for user '{}', defaulting to an empty list.", me);
            Vec::new()
        }
    };

    let all_presets = match fetch_presets().await {
        Ok(presets) => {
            presets
        }
        Err(e) => return Err(format!("Failed to fetch presets: {}", e)),
    };

    let visible_presets: Vec<Preset> = all_presets.into_iter()
        .filter(|preset| {
            preset.uploaded_by == me || friends.contains(&preset.uploaded_by)
        })
        .collect();

        let mut cache = state.preset_cache.lock().unwrap();
        *cache = visible_presets.clone();

    Ok(visible_presets)
}

#[tauri::command]
fn get_cached_samples(state: State<'_, Arc<AppState>>) -> Vec<Sample> {
    let cache = state.sample_cache.lock().unwrap();
    println!("Returning cached samples. Total: {}", cache.len());
    cache.clone()
}

#[tauri::command]
fn get_cached_presets(state: State<'_, Arc<AppState>>) -> Vec<Preset> {
    let cache = state.preset_cache.lock().unwrap();
    println!("Returning cached presets. Total: {}", cache.len());
    cache.clone()
}

#[tauri::command]
async fn upload_sample_metadata(
    title: String,
    url: String,
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<(), String> {
    let logged_in_user = {
        let guard = state.logged_in_user.lock().unwrap();
        guard.clone()
    };

    let username = match logged_in_user {
        Some(u) => u,
        None => {
            return Err("No user is logged in. Please log in before uploading.".into());
        }
    };

    let sample = Sample {
        title: title.clone(),
        url,
        uploaded_by: username.clone(),
    };

    add_song(sample.clone())
        .await
        .map_err(|e| format!("Failed to add sample: {}", e))?;

    {
        let mut cache = state.sample_cache.lock().unwrap();
        cache.push(sample);
    }

    println!("Sample metadata uploaded successfully by user '{}': {}", username, title);
    Ok(())
}

#[tauri::command]
async fn upload_preset_metadata(
    file_path: String,
    state: State<'_, Arc<AppState>>
) -> Result<(), String> {
    let username = state.logged_in_user.lock().unwrap().clone()
        .ok_or("Not logged in. Cannot upload.")?;

    upload_preset(&file_path, &username)
        .await
        .map_err(|e| format!("Failed to upload preset: {}", e))
}

#[tauri::command]
async fn download_preset_file(preset_name: String, output_path: String) -> Result<(), String> {
    println!("Downloading preset: {}", preset_name);

    download_preset(&preset_name, &output_path)
        .await
        .map_err(|e| format!("Failed to download preset: {}", e))
}

#[tauri::command]
fn play_song(title: String, state: State<'_, Arc<AppState>>) {
    let dir_path = state.directory_path.lock().unwrap();
    let Some(directory) = &*dir_path else {
        eprintln!("No directory set. Cannot play song.");
        return;
    };

    let path = format!("{}/{}", directory, title);
    let state = state.inner().clone();

    thread::spawn(move || {
        let file = match File::open(&path) {
            Ok(file) => file,
            Err(e) => {
                eprintln!("Error opening file: {}: {}", path, e);
                return;
            }
        };

        let (_stream, stream_handle) = match OutputStream::try_default() {
            Ok(output) => output,
            Err(e) => {
                eprintln!("Error creating output stream: {}", e);
                return;
            }
        };

        let sink = match Sink::try_new(&stream_handle) {
            Ok(sink) => Arc::new(sink),
            Err(e) => {
                eprintln!("Error creating sink: {}", e);
                return;
            }
        };

        match Decoder::new(BufReader::new(file)) {
            Ok(source) => sink.append(source),
            Err(e) => {
                eprintln!("Error decoding audio: {}", e);
                return;
            }
        }

        {
            let mut current_song = state.current_song.lock().unwrap();
            if let Some(ref current) = *current_song {
                current.pause();
            }

            *current_song = Some(sink.clone());

            let mut title_guard = state.current_song_title.lock().unwrap();
            *title_guard = Some(title.clone());
        }

        sink.set_volume(1.0);
        sink.sleep_until_end();
        println!("Now playing: {}", title);
    });
}


#[tauri::command]
fn pause_song(state: State<'_, Arc<AppState>>) {
    let mut current_song = state.current_song.lock().unwrap();
    if let Some(ref sink) = *current_song {
        sink.pause();
        println!("Song paused");
    } else {
        println!("No active song to pause");
    }
}

#[tauri::command]
fn unpause_song(state: State<'_, Arc<AppState>>) {
    let mut current_song = state.current_song.lock().unwrap();
    if let Some(ref sink) = *current_song {
        sink.play();
        println!("Song unpaused");
    } else {
        println!("No active song to pause");
    }
}

#[tauri::command]
fn set_volume(vol: f32, state: State<'_, Arc<AppState>>) {
    let mut current_song = state.current_song.lock().unwrap();
    if let Some(ref sink) = *current_song {
        sink.set_volume(vol);
        println!("Volume set to: {:.2}", vol);
    } else {
        println!("No active song to set volume");
    }
}

fn load_songs_from_directory(directory: &str) -> Vec<Song> {
    let path = Path::new(directory);
    let mut music_files = Vec::new();

    let supported_extensions = vec!["mp3", "wav", "flac"];

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if supported_extensions.iter().any(|&e| e == ext.to_str().unwrap_or("")) {
                            if let Some(file_name) = path.file_name() {
                                if let Some(file_name_str) = file_name.to_str() {
                                    music_files.push(Song {
                                        title: file_name_str.to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        eprintln!("Failed to read directory: {}", directory);
    }

    println!("Found {} songs in directory: {}", music_files.len(), directory);
    music_files
}

#[tauri::command]
fn get_current_song_playing(state: State<'_, Arc<AppState>>) -> Option<String> {
    let title_guard = state.current_song_title.lock().unwrap();
    title_guard.clone()
}

#[tauri::command]
fn get_cached_songs(state: State<'_, Arc<AppState>>) -> Vec<Song> {
    let cache = state.song_cache.lock().unwrap();
    println!("Returning cached songs. Total: {}", cache.len());
    cache.clone()
}

#[tauri::command]
fn get_directory_path(state: State<'_, Arc<AppState>>) -> Option<String> {
    let dir_path = state.directory_path.lock().unwrap();
    dir_path.clone()
}

#[tauri::command]
fn set_directory(path: String, state: State<'_, Arc<AppState>>) {
    let mut dir_path = state.directory_path.lock().unwrap();
    *dir_path = Some(path.clone());
    println!("Directory set: {}", path);

    let mut song_cache = state.song_cache.lock().unwrap();
    *song_cache = load_songs_from_directory(&path);
    println!("Cached songs from directory: {}", path);
}

#[tauri::command]
async fn add_friend_command(
    friend_username: String,
    state: tauri::State<'_, std::sync::Arc<AppState>>
) -> Result<(), String> {
    let me = {
        let logged_in_user = state.logged_in_user.lock().unwrap();
        logged_in_user.clone()
    }.ok_or("Must be logged in to add a friend.")?;

    db::add_friend(&me, &friend_username).await?;
    let mut cache = state.friends_cache.lock().unwrap();
    cache.push(friend_username);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Arc::new(AppState {
            current_song: Mutex::new(None),
            current_song_title: Mutex::new(None),
            song_cache: Mutex::new(Vec::new()),
            sample_cache: Mutex::new(Vec::new()),
            preset_cache: Mutex::new(Vec::new()),
            directory_path: Mutex::new(None),
            logged_in_user: Mutex::new(None),
            friends_cache: Mutex::new(Vec::new()),
        }))
        .invoke_handler(tauri::generate_handler![
            fetch_all_samples,
            get_cached_samples,
            play_song,
            pause_song,
            unpause_song,
            fetch_all_presets,
            get_cached_presets,
            upload_preset_metadata,
            download_preset_file,
            upload_sample_metadata,
            set_volume,
            get_current_song_playing,
            get_cached_songs,
            get_directory_path,
            set_directory,
            register_user_command,
            login_user_command,
            get_logged_in_user,
            add_friend_command,
            get_cached_friends,
            remove_friend_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}