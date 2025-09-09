require('dotenv').config();

const requiredEnv = ['BOT_TOKEN', 'CHAT_ID'];

const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const config = require('./config');

const {
    initDrive,
    getFiles,
} = require("./googleDrive");

let {
    lastModified,
    saveLastModified,
} = require('./lastModifiedStore');

const {
    sendTelegramMessage,
} = require('./telegramBot');

const {
    fileModifiedMessage,
    unreadUpdatesMessage,
} = require('./messageTemplates');

const readFileIds = require('./readFileIds');


(async () => {

    const fileIds = readFileIds(config.IDS_FILE_PATH);

    await initDrive();

    await initializeLastModified(fileIds);

    await checkModifiedFiles(fileIds, lastModified);

    setInterval(async () => {
        return await checkModifiedFiles(fileIds, lastModified);
    }, config.CHECK_INTERVAL_SECONDS * 1000);


    if (config.REMINDER_INTERVAL_MINUTES > 0) {
        setInterval(async () => {
            await sendTelegramMessage(
                unreadUpdatesMessage(
                    getUnviewedChanges(lastModified)
                )
            );
        }, config.REMINDER_INTERVAL_MINUTES * 60000);
    }


    console.log('🟢 App is running ...');
    console.log(`Monitoring ${Object.keys(lastModified).length} files every ${config.CHECK_INTERVAL_SECONDS} second.`);

})();


async function checkModifiedFiles(fileIds, lastModified) {
    try {
        const modifiedFiles = await getModifiedFiles(fileIds, lastModified);

        if (modifiedFiles.length === 0) return;

        for (const file of modifiedFiles) {
            lastModified[file.id] = file;
            await sendTelegramMessage(
                fileModifiedMessage(file)
            );
        }

        await saveLastModified();

    } catch (err) {
        console.error("❌ Error during checkModifiedFiles:", err);
    }
}


async function initializeLastModified(fileIds) {
    const result = await getFiles(fileIds);
    let newFilesCount = 0;
    let deletedCount = 0;

    for (const fileId of Object.keys(result)) {
        if (!lastModified[fileId]) {
            lastModified[fileId] = result[fileId];
            newFilesCount++;
        }
    }

    for (const fileId of Object.keys(lastModified)) {
        if (!fileIds.includes(fileId)) {
            delete lastModified[fileId];
            deletedCount++;
        }
    }

    await saveLastModified();

    console.log(`✅ Initialized lastModified.
    Found ${newFilesCount} new file(s),
    removed ${deletedCount} deleted file(s).
    `);

}


async function getModifiedFiles(fileIds, lastModified) {
    const currentLastModified = await getFiles(fileIds);
    const changedFiles = [];

    for (const fileId of fileIds) {
        const current = currentLastModified[fileId];
        const previous = lastModified[fileId];

        if (previous && current.modifiedTime !== previous.modifiedTime) {
            changedFiles.push(current);
        }
    }

    return changedFiles;
}


function getUnviewedChanges(lastModified) {
    const UnviewedChanges = [];

    for (id in lastModified) {
        const viewedByMeTime = new Date(lastModified[id].viewedByMeTime);
        const modifiedTime = new Date(lastModified[id].modifiedTime);

        if (modifiedTime > viewedByMeTime) {
            UnviewedChanges.push(lastModified[id]);
        }
    }

    return UnviewedChanges;
}
