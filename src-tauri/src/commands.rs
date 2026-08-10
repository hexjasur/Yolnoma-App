use crate::db::get_db;
use crate::models::{Performance, SavedVideo};
use futures::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId, DateTime, Document};
use mongodb::options::{FindOneAndUpdateOptions, ReturnDocument};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct UpdatePerformance {
    pub full_name: Option<String>,
    pub image_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub description: Option<String>,
}

fn document_to_performance(doc: &Document) -> Performance {
    let id = doc
        .get_object_id("_id")
        .map(|v| v.to_hex())
        .unwrap_or_default();

    let full_name = doc.get_str("full_name").unwrap_or("").to_string();

    let image_url = doc.get_str("image_url").unwrap_or("").to_string();

    let thumbnail_url = doc.get_str("thumbnail_url").unwrap_or("").to_string();

    let description = doc.get_str("description").ok().map(|s| s.to_string());

    let created_at = match doc.get("created_at") {
        Some(mongodb::bson::Bson::DateTime(dt)) => {
            dt.try_to_rfc3339_string().unwrap_or_else(|_| dt.to_string())
        }
        Some(mongodb::bson::Bson::String(s)) => s.clone(),
        _ => "".to_string(),
    };

    let updated_at = match doc.get("updated_at") {
        Some(mongodb::bson::Bson::DateTime(dt)) => {
            dt.try_to_rfc3339_string().unwrap_or_else(|_| dt.to_string())
        }
        Some(mongodb::bson::Bson::String(s)) => s.clone(),
        _ => "".to_string(),
    };

    Performance {
        id,
        full_name,
        image_url,
        thumbnail_url,
        description,
        created_at,
        updated_at,
    }
}

#[tauri::command]
pub async fn add_performance(
    full_name: String,
    image_url: String,
    thumbnail_url: Option<String>,
    description: Option<String>,
) -> Result<String, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let collection = db.collection::<mongodb::bson::Document>("Performance");
    
    // Check for unique full_name
    if let Ok(Some(_)) = collection.find_one(doc! { "full_name": &full_name }, None).await {
        return Err(format!("'{}' ismli ishtirokchi allaqachon mavjud!", full_name));
    }

    let now = DateTime::now();
    
    let thumb = thumbnail_url
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| image_url.clone()); // use image_url as default if thumb is missing

    let document = doc! {
        "full_name": full_name,
        "image_url": image_url,
        "thumbnail_url": thumb,
        "description": description.filter(|s| !s.trim().is_empty()),
        "created_at": now.clone(),
        "updated_at": now,
    };

    let result = collection
        .insert_one(document, None)
        .await
        .map_err(|e| e.to_string())?;

    match result.inserted_id.as_object_id() {
        Some(id) => Ok(id.to_hex()),
        None => Err("Failed to get inserted id".into()),
    }
}

#[tauri::command]
pub async fn list_performances() -> Result<Vec<Performance>, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;

    let collection = db.collection::<mongodb::bson::Document>("Performance");

    let mut cursor = collection
        .find(None, None)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    while let Some(doc) = cursor.try_next().await.map_err(|e| e.to_string())? {
        result.push(document_to_performance(&doc));
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_performance(id: String) -> Result<Performance, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let object_id = ObjectId::parse_str(&id).map_err(|_| "Invalid performance id".to_string())?;

    let collection = db.collection::<mongodb::bson::Document>("Performance");
    let filter = doc! {"_id": object_id};

    let result = collection
        .find_one(filter, None)
        .await
        .map_err(|e| e.to_string())?;

    match result {
        Some(doc) => Ok(document_to_performance(&doc)),
        None => Err("Performance not found".into()),
    }
}

#[tauri::command]
pub async fn update_performance(
    id: String,
    data: UpdatePerformance,
) -> Result<Performance, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let object_id = ObjectId::parse_str(&id).map_err(|_| "Invalid performance id".to_string())?;

    let collection = db.collection::<mongodb::bson::Document>("Performance");

    let mut update_doc = Document::new();

    if let Some(full_name) = data.full_name {
        // Check for unique full_name excluding the current id
        if let Ok(Some(existing)) = collection.find_one(doc! { "full_name": &full_name }, None).await {
            let existing_id = existing.get_object_id("_id").map(|oid| oid.to_hex()).unwrap_or_default();
            if existing_id != id {
                return Err(format!("'{}' ismli ishtirokchi allaqachon mavjud!", full_name));
            }
        }
        update_doc.insert("full_name", full_name);
    }
    if let Some(image_url) = data.image_url {
        update_doc.insert("image_url", image_url);
    }
    if let Some(thumbnail_url) = data.thumbnail_url {
        update_doc.insert("thumbnail_url", thumbnail_url);
    }
    if let Some(description) = data.description {
        update_doc.insert("description", description);
    }

    if update_doc.is_empty() {
        return Err("No update fields provided".into());
    }

    update_doc.insert("updated_at", DateTime::now());

    let collection = db.collection::<mongodb::bson::Document>("Performance");
    let filter = doc! {"_id": object_id};

    let options = FindOneAndUpdateOptions::builder()
        .return_document(ReturnDocument::After)
        .build();

    let updated = collection
        .find_one_and_update(filter, doc! {"$set": update_doc}, options)
        .await
        .map_err(|e| e.to_string())?;

    match updated {
        Some(doc) => Ok(document_to_performance(&doc)),
        None => Err("Performance not found".into()),
    }
}

#[tauri::command]
pub async fn delete_performance(id: String) -> Result<Performance, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let object_id = ObjectId::parse_str(&id).map_err(|_| "Invalid performance id".to_string())?;

    let collection = db.collection::<mongodb::bson::Document>("Performance");
    let filter = doc! {"_id": object_id};

    let deleted = collection
        .find_one_and_delete(filter, None)
        .await
        .map_err(|e| e.to_string())?;

    match deleted {
        Some(doc) => Ok(document_to_performance(&doc)),
        None => Err("Performance not found".into()),
    }
}

#[tauri::command]
pub async fn proxy_eporner(url: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .header("Referer", "https://www.eporner.com/")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Network error ({}): {}", url, e))?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!("HTTP {} from {}", status, url));
    }

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    Ok(json)
}

#[tauri::command]
pub async fn save_video(mut video: SavedVideo) -> Result<(), String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let collection = db.collection::<mongodb::bson::Document>("SavedVideo");

    // Check if video is already saved
    let filter = doc! { "video_id": &video.video_id };
    if let Ok(Some(_)) = collection.find_one(filter.clone(), None).await {
        return Ok(());
    }

    video.created_at = Some(DateTime::now().to_string());

    let doc_to_insert = doc! {
        "video_id": &video.video_id,
        "title": &video.title,
        "default_thumb": &video.default_thumb,
        "length_min": &video.length_min,
        "views": &video.views,
        "rate": &video.rate,
        "created_at": DateTime::now(),
    };

    collection
        .insert_one(doc_to_insert, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn unsave_video(video_id: String) -> Result<(), String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let collection = db.collection::<mongodb::bson::Document>("SavedVideo");

    let filter = doc! { "video_id": &video_id };
    collection
        .delete_one(filter, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_video_save_status(video_id: String) -> Result<bool, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let collection = db.collection::<mongodb::bson::Document>("SavedVideo");

    let filter = doc! { "video_id": &video_id };
    let result = collection.find_one(filter, None).await.map_err(|e| e.to_string())?;
    Ok(result.is_some())
}

#[tauri::command]
pub async fn list_saved_videos() -> Result<Vec<SavedVideo>, String> {
    let db = get_db().await.map_err(|e| e.to_string())?;
    let collection = db.collection::<mongodb::bson::Document>("SavedVideo");

    let mut cursor = collection
        .find(None, None)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    while let Some(doc) = cursor.try_next().await.map_err(|e| e.to_string())? {
        let video_id = doc.get_str("video_id").unwrap_or("").to_string();
        let title = doc.get_str("title").unwrap_or("").to_string();
        let default_thumb = doc.get_str("default_thumb").unwrap_or("").to_string();
        let length_min = doc.get_str("length_min").unwrap_or("").to_string();
        let views = doc.get_str("views").unwrap_or("").to_string();
        let rate = doc.get_str("rate").unwrap_or("").to_string();
        let created_at = match doc.get("created_at") {
            Some(mongodb::bson::Bson::DateTime(dt)) => {
                dt.try_to_rfc3339_string().unwrap_or_else(|_| dt.to_string())
            }
            Some(mongodb::bson::Bson::String(s)) => s.clone(),
            _ => "".to_string(),
        };

        result.push(SavedVideo {
            video_id,
            title,
            default_thumb,
            length_min,
            views,
            rate,
            created_at: Some(created_at),
        });
    }

    Ok(result)
}
