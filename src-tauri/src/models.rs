use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Performance {
    pub id: String,
    pub full_name: String,
    pub image_url: String,
    pub thumbnail_url: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedVideo {
    #[serde(rename = "videoId")]
    pub video_id: String,
    pub title: String,
    #[serde(rename = "defaultThumb")]
    pub default_thumb: String,
    #[serde(rename = "lengthMin")]
    pub length_min: String,
    pub views: String,
    pub rate: String,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: Option<bson::oid::ObjectId>,
    pub email: String,
    pub password_hash: String,
    pub role: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub is_private: Option<bool>,
}
