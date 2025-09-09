
function fileModifiedMessage(file) {
    const time = new Date(file.modifiedTime).toLocaleString();
    return `🤖\n${file.name} modified at ${time}.\n\nhttps://docs.google.com/spreadsheets/d/${file.id}\n---`;
}


function unreadUpdatesMessage(unviewedFiles) {
    let message = '🤖 Unread updates:\n\n';
    for (const file of unviewedFiles) {
        const time = new Date(file.modifiedTime).toLocaleString();
        message += `${file.name} modified at ${time}.\n\nhttps://docs.google.com/spreadsheets/d/${file.id}\n---\n\n`;
    }
    return message;
}

module.exports = {
    fileModifiedMessage,
    unreadUpdatesMessage,
};
