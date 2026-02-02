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

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    })
});

const db = admin.firestore();

const uids = [
    "EaQfCv1r6xXUP8sqxISittV1Yni2",
    "VOvnGk4jdLbnEmCpXJlaoyQrowY2"
];

async function checkUserProfiles() {
    console.log("Checking User Profiles...");
    for (const uid of uids) {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            console.log(`${uid} => Name: ${data.name}, Email: ${data.email}, Role: ${data.role}`);
        } else {
            console.log(`${uid} => NOT FOUND`);
        }
    }
}

checkUserProfiles().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
