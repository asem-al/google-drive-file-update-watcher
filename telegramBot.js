const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function sendTelegramMessage(message) {
    return bot.sendMessage(process.env.CHAT_ID, message);
}

module.exports = {
    sendTelegramMessage,
};

// bot.sendMessage(process.env.CHAT_ID, 'Hello, group!');

// bot.on('message', (msg) => {
//     const chatId = msg.chat.id;

//     bot.sendMessage(chatId, chatId);
// });