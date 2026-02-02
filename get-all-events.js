const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Manually load env from .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value;
        }
    });
}

if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("Missing FIREBASE credentials in .env.local");
    process.exit(1);
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    })
});

const db = admin.firestore();

async function listAllEvents() {
    console.log("Fetching all events...");
    const snap = await db.collection('events').get();

    if (snap.empty) {
        console.log("No events found.");
        return;
    }

    console.log("ID | Title | CreatedBy | Type | ParentId");
    console.log("-----------------------------------------");
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`${doc.id} | ${data.title} | ${data.createdBy || 'N/A'} | ${data.type || 'main'} | ${data.parentId || 'None'}`);
    });
}

listAllEvents().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
