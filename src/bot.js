import "dotenv/config";
import { Bot } from "grammy";

import { registerStartHandler } from "./handlers/start.js";
import { registerKeysHandlers } from "./handlers/keys.js";
import { registerPaymentHandlers } from "./handlers/payment.js";
import { registerAdminHandlers } from "./handlers/admin.js";

const bot = new Bot(process.env.BOT_TOKEN);

if (process.env.NODE_ENV !== "production") {
    bot.use(async (ctx, next) => {
        const type = ctx.updateType;
        const from = ctx.from?.username || ctx.from?.id || "?";
        const text = ctx.message?.text || ctx.callbackQuery?.data || "";
        console.log(`[${type}] @${from}: ${text}`);
        await next();
    });
}

registerStartHandler(bot);
registerKeysHandlers(bot);
registerPaymentHandlers(bot);
registerAdminHandlers(bot);

bot.on("callback_query", async (ctx) => {
    await ctx.answerCallbackQuery();
});

bot.catch((err) => {
    console.error("Ошибка бота:", err.message);
});

bot.start({
    onStart: (info) => {
        console.log(`✅ Бот @${info.username} запущен`);
        console.log(`💳 Оплата: Telegram Stars + CryptoBot`);
        console.log(`👤 Admin ID: ${process.env.ADMIN_ID}`);
    },
});
