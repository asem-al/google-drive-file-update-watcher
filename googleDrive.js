const { google } = require("googleapis");
const fs = require("fs");

let drive = null;

// ---- Load credentials ----
let credentials;
try {
    if (!fs.existsSync("credentials.json")) {
        throw new Error("Missing credentials.json");
    }
    credentials = JSON.parse(fs.readFileSync("credentials.json"));
} catch (err) {
    console.error("❌ Could not load credentials.json:", err.message);
    console.error(`
    To use this script, you need OAuth 2.0 credentials from Google:

    1. Go to https://console.cloud.google.com/
    2. Create a new project (or select an existing one).
    3. Navigate to "APIs & Services" → "Credentials".
    4. Click "Create Credentials" → "OAuth client ID".
    5. Choose "Web App" as the application type.
       And add http://localhost:3000/oauth2callback
       as an Authorized redirect URI in the Google Cloud Console.
    6. Download the JSON file and save it as "credentials.json" 
       in the same folder as this script.
    7. From "OAuth consent screen" → "Audience", Add test users.
    `);
    process.exit(1);
}

const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
);

async function initDrive() {
    console.log('⏳ Initializing google dirve ...');

    function startAuthServer() {
        return new Promise((resolve, reject) => {
            const express = require("express");
            const app = express();

            const server = app.listen(3000, () => {
                console.log('\n', "Auth server running on http://localhost:3000");
                const authUrl = oauth2Client.generateAuthUrl({
                    access_type: "offline",
                    prompt: "consent",
                    scope: ["https://www.googleapis.com/auth/drive.readonly"],
                });
                console.log('\n', "Authorize this app by visiting:", authUrl);
            });

            app.get("/oauth2callback", async (req, res) => {
                try {
                    const { code } = req.query;
                    const { tokens } = await oauth2Client.getToken(code);
                    oauth2Client.setCredentials(tokens);
                    fs.writeFileSync("tokens.json", JSON.stringify(tokens));
                    drive = google.drive({ version: "v3", auth: oauth2Client });
                    res.send("✅ Authentication successful! You can close this tab.");
                    server.close(() => console.log("✅ Auth server closed."));
                    resolve(drive);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    if (fs.existsSync("tokens.json")) {
        try {
            const tokens = JSON.parse(fs.readFileSync("tokens.json"));
            oauth2Client.setCredentials(tokens);
            // Check if access token is still valid or can be refreshed
            await oauth2Client.getAccessToken();
            drive = google.drive({ version: "v3", auth: oauth2Client });
            console.log("✅ Using existing tokens.");
        } catch (err) {
            console.error("❌ Stored tokens are invalid or expired:");
            // fs.unlinkSync("tokens.json");
            return await startAuthServer();
        }
    } else {
        return await startAuthServer();
    }
}

// async function getFiles(fileIds) {
//     const result = {};
//     for (const fileId of fileIds) {
//         try {
//             const res = await drive.files.get({
//                 fileId,
//                 fields: "id, name, modifiedTime"
//             });
//             result[fileId] = {
//                 id: res.data.id,
//                 name: res.data.name,
//                 modifiedTime: res.data.modifiedTime,
//             };
//         } catch (err) {
//             console.error(err.message);
//             return;
//         }
//     }
//     return result;
// }


async function getFiles(fileIds, fields = 'id,name,mimeType,modifiedTime,viewedByMeTime') {
    if (!drive) throw new Error("Drive not initialized. Call initDrive() first.");

    if (fileIds.length === 0) return {};

    const auth = drive.context._options.auth;
    // const { token } = await auth.getAccessToken();
    const token = await ensureValidToken();
    if (!token) throw new Error('No access token');

    const boundary = 'batch_' + Math.random().toString(36).slice(2);
    const bodyParts = [];
    const encodedFields = encodeURIComponent(fields);

    fileIds.forEach((fileId, index) => {
        bodyParts.push(
            `--${boundary}\r\n` +
            `Content-Type: application/http\r\n` +
            `Content-ID: ${index + 1}\r\n\r\n` +
            `GET /drive/v3/files/${fileId}?fields=${encodedFields}\r\n\r\n`
        );
    });
    bodyParts.push(`--${boundary}--\r\n`);
    const body = bodyParts.join('');

    const https = require('https');
    const Buffer = require("buffer").Buffer;

    return new Promise((resolve, reject) => {
        const req = https.request({
            method: 'POST',
            hostname: 'www.googleapis.com',
            path: '/batch/drive/v3',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/mixed; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Batch request failed with status ${res.statusCode}: ${data}`));
                    return;
                }

                const result = {};

                const match = res.headers['content-type'].match(/boundary=(.*)/);
                if (!match) {
                    reject(new Error('No boundary in response'));
                    return;
                }
                const respBoundary = match[1];

                const parts = data.split(`--${respBoundary}`);
                for (let i = 1; i < parts.length - 1; i++) {
                    let part = parts[i].trim();

                    const idMatch = part.match(/Content-ID:\s*response-(\d+)/);
                    if (!idMatch) continue;

                    const reqIndex = parseInt(idMatch[1]) - 1;
                    const fileId = fileIds[reqIndex];

                    const httpStart = part.indexOf('HTTP/1.1');
                    if (httpStart === -1) continue;
                    part = part.slice(httpStart);

                    const statusMatch = part.match(/^HTTP\/1.1 (\d+) /);
                    if (!statusMatch) continue;
                    const status = parseInt(statusMatch[1]);

                    if (status !== 200) {
                        const bodyStart = part.indexOf('\r\n\r\n') + 4;
                        const errBody = part.slice(bodyStart);
                        console.error(`Error for file ${fileId}: ${status} ${errBody}`);
                        continue;
                    }

                    const headerEnd = part.indexOf('\r\n\r\n');
                    if (headerEnd === -1) continue;
                    const bodyStr = part.slice(headerEnd + 4);

                    let resData;
                    try {
                        resData = JSON.parse(bodyStr);
                    } catch (e) {
                        console.error(`Parse error for file ${fileId}:`, e);
                        continue;
                    }

                    result[fileId] = { ...resData }
                }
                resolve(result);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function ensureValidToken() {
    try {
        const { token } = await oauth2Client.getAccessToken();
        if (!token) throw new Error("No access token available");
        return token;
    } catch (err) {
        console.log("⚠️ Token expired or invalid, re-authenticating...");
        if (fs.existsSync("tokens.json")) fs.unlinkSync("tokens.json");
        await initDrive(); // will start auth server if needed
        const { token } = await oauth2Client.getAccessToken();
        return token;
    }
}

module.exports = {
    initDrive,
    getFiles,
};
