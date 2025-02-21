use firebase_rs::Firebase;
use serde::{Deserialize, Serialize};
use std::{error::Error, fs};
use std::path::Path;
use base64::{encode, decode};
use dotenv::dotenv;
use std::env;
use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2
};

const FIREBASE_URL_ENV_VAR: &str = "FIREBASE_URL";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Sample {
    pub title: String,
    pub url: String,
    pub uploaded_by: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Preset {
    pub title: String,
    pub data: String,
    pub uploaded_by: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct User {
    pub username: String,
    pub password: String,
    pub friends: Option<Vec<String>>,
}

pub fn init_firebase() -> Firebase {
    dotenv().ok();
    let firebase_url = env::var(FIREBASE_URL_ENV_VAR).expect("FIREBASE_URL not set");
    Firebase::new(&firebase_url).expect("Failed to initialize Firebase")
}

fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)?.to_string();
    Ok(password_hash)
}

fn verify_password(hash: &str, password: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

pub async fn register_user(username: String, password: String) -> Result<(), String> {
    let firebase = init_firebase();
    let users_ref = firebase.at(&format!("users/{}", username));

    // Check if the user already exists
    let result: Result<serde_json::Value, _> = users_ref.get().await;
    match result {
        Ok(data) => {
            if data != serde_json::Value::Null {
                return Err(format!("User '{}' already exists.", username));
            }
        }
        Err(_) => {
            println!("No existing user found. Proceeding with registration...");
        }
    }

    let hashed_password = hash_password(&password).map_err(|e| e.to_string())?;

    let user = User {
        username: username.clone(),
        password: hashed_password,
        friends: None,
    };

    users_ref.set(&user).await.map_err(|e| e.to_string())?;
    println!("User '{}' registered successfully.", username);
    Ok(())
}

pub async fn login_user(username: String, password: String) -> Result<bool, String> {
    let firebase = init_firebase();
    let users_ref = firebase.at(&format!("users/{}", username));

    let result: serde_json::Value = users_ref.get().await.map_err(|e| e.to_string())?;
    println!("Firebase response for user '{}': {:?}", username, result);

    if let Some(user_map) = result.as_object() {
        for (_random_key, user_obj) in user_map {
            if let Some(fields) = user_obj.as_object() {
                if let Some(stored_password) = fields.get("password").and_then(|p| p.as_str()) {
                    if verify_password(stored_password, &password).map_err(|e| e.to_string())? {
                        println!("User '{}' logged in successfully.", username);
                        return Ok(true);
                    } else {
                        println!("Invalid password for user '{}'.", username);
                        return Err("Invalid username or password.".to_string());
                    }
                }
            }
        }
    }

    println!("No user data found for '{}'.", username);
    Err("Invalid username or password.".to_string())
}

pub async fn fetch_samples() -> Result<Vec<Sample>, Box<dyn Error>> {
    let firebase = init_firebase();
    let samples_ref = firebase.at("songs");

    let result: serde_json::Value = samples_ref.get().await?;
    let mut samples = Vec::new();

    if let Some(samples_map) = result.as_object() {
        for (_key, sample_group) in samples_map {
            if let Some(inner_map) = sample_group.as_object() {
                for (_inner_key, sample_value) in inner_map {
                    if let Ok(sample) = serde_json::from_value::<Sample
                >(sample_value.clone()) {
                        samples.push(sample);
                    }
                }
            }
        }
    }
    println!("Fetched {} songs from the database.", samples.len());
    Ok(samples)
}

pub async fn fetch_presets() -> Result<Vec<Preset>, Box<dyn Error>> {
    let firebase = init_firebase();
    let presets_ref = firebase.at("presets");

    let result: serde_json::Value = presets_ref.get().await?;
    let mut presets = Vec::new();

    if let Some(presets_map) = result.as_object() {
        for (_key, preset_group) in presets_map {
            if let Some(inner_map) = preset_group.as_object() {
                for (_inner_key, preset_value) in inner_map {
                    if let Ok(preset) = serde_json::from_value::<Preset>(preset_value.clone()) {
                        presets.push(preset);
                    }
                }
            }
        }
    }

    println!("Fetched {} presets from the database.", presets.len());
    Ok(presets)
}

pub fn file_to_base64(file_path: &str) -> Result<String, Box<dyn Error>> {
    println!("Converting file to base64: {}", file_path);
    let file_bytes = fs::read(&file_path)?;
    let base64_string = encode(file_bytes);
    println!("File converted to base64.");
    Ok(base64_string)
}

pub fn base64_to_file(base64_data: &str, output_path: &str) -> Result<(), Box<dyn Error>> {
    println!("Converting base64 to file: {}", output_path);
    let file_bytes = decode(base64_data)?;
    fs::write(output_path, file_bytes)?;
    println!("File saved to {}", output_path);
    Ok(())
}

pub async fn upload_preset(file_path: &str, username: &str) -> Result<(), Box<dyn std::error::Error>> {
    let firebase = init_firebase();

    let file_name = Path::new(file_path)
        .file_stem()
        .and_then(|f| f.to_str())
        .ok_or("Failed to get file name")?;

    let base64_data = file_to_base64(file_path)?;

    let preset = Preset {
        title: file_name.to_string(),
        data: base64_data,
        uploaded_by: username.to_string(),
    };

    let preset_ref = firebase.at(&format!("presets/{}", file_name));
    preset_ref.set(&preset).await?;

    println!("Preset uploaded: {} by user '{}'", file_name, username);
    Ok(())
}

pub async fn download_preset(preset_name: &str, output_path: &str) -> Result<(), Box<dyn Error>> {
    let firebase = init_firebase();
    let preset_ref = firebase.at(&format!("presets/{}", preset_name));

    println!("Fetching preset from Firebase: {}", preset_name);

    let result: serde_json::Value = preset_ref.get().await?;
    
    if let Some(preset_group) = result.as_object() {
        for (_key, preset_data) in preset_group {
            if let Some(preset_obj) = preset_data.as_object() {
                if let Some(preset_base64) = preset_obj.get("data").and_then(|b| b.as_str()) {
                    base64_to_file(preset_base64, output_path)?;
                    println!("Preset downloaded and saved to: {}", output_path);
                    return Ok(());
                }
            }
        }
    }

    Err(format!("Failed to fetch preset data for: {}", preset_name).into())
}

pub async fn add_song(sample: Sample) -> Result<(), Box<dyn Error>> {
    let firebase = init_firebase();
    let samples_ref = firebase.at(&format!("songs/{}", sample.title));

    samples_ref.set(&sample).await?;
    println!("Sample added to Firebase with title: {}", sample.title);
    Ok(())
}

pub async fn add_friend(my_username: &str, friend_username: &str) -> Result<(), String> {
    let firebase = init_firebase();

    let friend_ref = firebase.at(&format!("users/{}", friend_username));
    let friend_exists = friend_ref
            .get::<serde_json::Value>()
            .await
            .map(|data| data != serde_json::Value::Null)
            .map_err(|e| format!("Failed to check if friend exists: {}", e))?;

    if !friend_exists {
        return Err(format!("User '{}' does not exist.", friend_username));
    }

    let my_friends_ref = firebase.at(&format!("users/{}/friends/{}", my_username, friend_username));
    my_friends_ref
        .set(&true)
        .await
        .map_err(|e| format!("Failed to add '{}' to your friends list: {}", friend_username, e))?;

    let friend_friends_ref = firebase.at(&format!("users/{}/friends/{}", friend_username, my_username));
    friend_friends_ref
        .set(&true)
        .await
        .map_err(|e| format!("Failed to add yourself to '{}'s friends list: {}", friend_username, e))?;

    println!("'{}' and '{}' are now friends.", my_username, friend_username);
    Ok(())
}

pub async fn fetch_friends(username: &str) -> Result<Vec<String>, String> {
    let firebase = init_firebase();
    let friends_ref = firebase.at(&format!("users/{}/friends", username));

    let result: serde_json::Value = friends_ref
        .get()
        .await
        .map_err(|e| e.to_string())?;

    let mut friend_list = Vec::new();

    if let Some(friend_map) = result.as_object() {
        for (friend_name, _value) in friend_map {
            friend_list.push(friend_name.clone());
        }
    }

    println!("Found {} friends for user '{}'", friend_list.len(), username);
    Ok(friend_list)
}

pub async fn remove_friend(my_username: &str, friend_username: &str) -> Result<(), String> {
    let firebase = init_firebase();

    let my_friends_ref = firebase.at(&format!("users/{}/friends/{}", my_username, friend_username));
    let my_friends_delete_result = my_friends_ref.delete().await;

    if let Err(e) = my_friends_delete_result {
        println!(
            "Could not remove '{}' from '{}''s friends list: {}",
            friend_username, my_username, e
        );
    } else {
        println!(
            "Removed '{}' from '{}''s friends list.",
            friend_username, my_username
        );
    }

    let friend_friends_ref =
        firebase.at(&format!("users/{}/friends/{}", friend_username, my_username));
    let friend_friends_delete_result = friend_friends_ref.delete().await;

    if let Err(e) = friend_friends_delete_result {
        println!(
            "Could not remove '{}' from '{}''s friends list: {}",
            my_username, friend_username, e
        );
    } else {
        println!(
            "Removed '{}' from '{}''s friends list.",
            my_username, friend_username
        );
    }

    Ok(())
}

pub async fn remove_sample(title: &str) -> Result<(), Box<dyn Error>> {
    let firebase = init_firebase();
    let sample_ref = firebase.at(&format!("songs/{}", title));

    sample_ref.delete().await?;
    println!("Sample removed from Firebase with title: {}", title);
    Ok(())
}