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

const auth = admin.auth();

const superAdminEmails = [
    "shwetank.chauhan17@gmail.com",
    "shwetank.chauhan3@gmail.com",
    "code4sarthak@gmail.com"
];

async function mapEmailsToUids() {
    console.log("Mapping Super Admin Emails to UIDs...");
    for (const email of superAdminEmails) {
        try {
            const userRecord = await auth.getUserByEmail(email);
            console.log(`${email} => ${userRecord.uid}`);
        } catch (error) {
            console.log(`${email} => NOT FOUND`);
        }
    }
}

mapEmailsToUids().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
