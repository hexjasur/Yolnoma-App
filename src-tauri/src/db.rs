use dotenvy::dotenv;
use mongodb::{Client, Database};
use std::env;

pub async fn get_db() -> mongodb::error::Result<Database> {
    dotenv().ok();

    let uri = env::var("MONGODB_URL")
        .expect("MONGODB_URL not found");

    let client = Client::with_uri_str(uri).await?;

    Ok(client.database("Performance"))
}