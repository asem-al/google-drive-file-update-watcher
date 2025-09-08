const fs = require('fs');

function readFileIds(filePath) {

    if (!fs.existsSync(filePath)) {
        console.error(
            `❌ File IDs file not found.\n` +
            `Please create "files.txt" file with your file IDs, one per line, \n` +
            `or update the IDS_FILE_PATH in config.js to point to an existing file.\n` +
            `file name (optional): file_id`
        );
        process.exit(1);
    }

    const data = fs.readFileSync(filePath, 'utf-8');

    const fileIds = data
        .split('\n')
        .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            const parts = trimmed.split(':');
            return parts.length > 1
                ? parts[1].trim()
                : parts[0].trim();
        })
        .filter(Boolean);

    return fileIds;
}

module.exports = readFileIds;
