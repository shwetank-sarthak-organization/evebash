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

async function checkUser() {
    const email = 'newone1@email.com';
    console.log(`Searching for user with email: ${email}`);
    const snapshot = await db.collection('users').where('email', '==', email).get();
    
    if (snapshot.empty) {
        console.log('No user found with that email in the "users" collection.');
    } else {
        snapshot.forEach(doc => {
            console.log(`Found UID: ${doc.id}`);
            console.log('Data:', doc.data());
        });
    }
}

checkUser().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
