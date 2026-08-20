import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, 'src-tauri', '.env') });

const uri = process.env.MONGODB_URL;
if (!uri) {
  console.error("❌ MONGODB_URL not found in .env file");
  process.exit(1);
}

const DB_NAME = "Yolnoma";
const COLLECTION_NAME = "users";

const ADMIN_EMAIL = "hexjasur@yolnoma.uz";
const ADMIN_PASSWORD = "Pholosophy@hexjasur";

async function run() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected successfully to MongoDB server");

    const db = client.db(DB_NAME);
    const usersCollection = db.collection(COLLECTION_NAME);

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: ADMIN_EMAIL });
    
    if (existingUser) {
      console.log(`⚠️ User ${ADMIN_EMAIL} already exists in ${DB_NAME}.${COLLECTION_NAME}. Exiting...`);
      return;
    }

    // Hash the password
    const saltRounds = 10;
    console.log("⏳ Hashing password...");
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

    // Create user document
    const newUser = {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      created_at: new Date(),
      role: "admin"
    };

    // Insert user
    const result = await usersCollection.insertOne(newUser);
    
    if (result.acknowledged) {
      console.log(`🎉 Successfully created user ${ADMIN_EMAIL} with ID: ${result.insertedId}`);
      console.log(`🔑 You can now login using:\nEmail: ${ADMIN_EMAIL}\nPassword: ${ADMIN_PASSWORD}`);
    } else {
      console.error("❌ Failed to insert user");
    }

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

run().catch(console.dir);
