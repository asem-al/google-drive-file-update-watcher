const { sendTelegramMessage } = require('./telegramBot');

async function notify(message) {
    const config = require('./config');

    // Telegram strategy
    if (config.NOTIFY_TELEGRAM) {
        await sendTelegramMessage(message);
    }

    // Logging strategy
    if (config.NOTIFY_LOG) {
        console.log('\n🔔 Notification:', message);
    }

    // Example: Email strategy
    // if (config.NOTIFY_EMAIL) {
    //     sendEmailNotification(message);
    // }
}

module.exports = { notify };