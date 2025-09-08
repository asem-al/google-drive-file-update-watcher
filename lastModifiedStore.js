const fsp = require("fs/promises");
const fs = require("fs");

const LAST_MODIFIED = "lastModified.json";

let lastModified = {};

(async function initialize() {
    if (fs.existsSync(LAST_MODIFIED)) {
        try {
            const data = fs.readFileSync(LAST_MODIFIED, "utf-8");
            const parsed = JSON.parse(data);

            // Clear the object and copy values
            for (const key in lastModified) delete lastModified[key];
            for (const key in parsed) lastModified[key] = parsed[key];

        } catch (err) {
            console.error("❌ Failed to read lastModified.json, resetting:", err);
            for (const key in lastModified) delete lastModified[key];
            await fsp.writeFile(LAST_MODIFIED, JSON.stringify(lastModified, null, 2));
        }
    } else {
        fs.writeFileSync(LAST_MODIFIED, JSON.stringify({}, null, 2));
    }
    console.log("✅ lastModified store initialized");
})();

async function saveLastModified() {
    await fsp.writeFile(LAST_MODIFIED, JSON.stringify(lastModified, null, 2));
}

module.exports = {
    lastModified,
    saveLastModified,
};
