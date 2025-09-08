const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });


async function notifyFileChanges(modifiedFiles) {
    for (const file of modifiedFiles) {
        const message = `🤖
${file.name} modified at ${file.modifiedTime}.

https://docs.google.com/spreadsheets/d/${file.id}
---`;

        await bot.sendMessage(process.env.CHAT_ID, message);
    }
}


async function remindOfUnviewedChanges(UnviewedChanges) {
    let message = '🤖 Unread updates:\n\n';
    for (const file of UnviewedChanges) {
        message += `${file.name} modified at ${file.modifiedTime}.

https://docs.google.com/spreadsheets/d/${file.id}
---\n\n`;

        await bot.sendMessage(process.env.CHAT_ID, message);
    }
}


module.exports = {
    notifyFileChanges,
    remindOfUnviewedChanges
};

// bot.sendMessage(process.env.CHAT_ID, 'Hello, group!');

// bot.on('message', (msg) => {
//     const chatId = msg.chat.id;

//     bot.sendMessage(chatId, chatId);
// });