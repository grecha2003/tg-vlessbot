import { upsertUser, getUser, getUserKeys, getTotalKeysCount } from "../db.js";
import { plansKeyboard, keysKeyboard } from "../keyboards.js";

async function sendWelcome(ctx) {
    const { id, username, first_name, last_name } = ctx.from;
    const fullName = [first_name, last_name].filter(Boolean).join(" ");
    upsertUser(id, username, fullName);

    await ctx.reply(
        `👋 Привет, <b>${fullName}</b>!\n\n` +
            `⚡️ <b>DatoVPN_bot</b> 🇬🇪 — надёжный VPN\n\n` +
            `• До <b>5 устройств</b> на одну подписку\n` +
            `• Без ограничений по скорости\n` +
            `Оплата: ⭐ Telegram Stars или 💎 Криптовалюта\n\n` +
            `👇👇👇 Используйте это меню для навигации`,
        { parse_mode: "HTML" },
    );
}

export function registerStartHandler(bot) {
    bot.command("start", async (ctx) => {
        await sendWelcome(ctx);
    });

    bot.command("buy", async (ctx) => {
        await ctx.reply(
            `💳 <b>Выберите период подписки</b>\n\n` +
                `⭐ Telegram Stars\n` +
                `💎 USDT / TON / BTC через CryptoBot`,
            { parse_mode: "HTML", reply_markup: plansKeyboard() },
        );
    });

    bot.command("keys", async (ctx) => {
        const userId = ctx.from.id;
        const keys = getUserKeys(userId);
        const total = getTotalKeysCount(userId);

        await ctx.reply(
            keys.length === 0
                ? `🔑 <b>Мои ключи</b>\n\nУ вас пока нет ключей.\n\nИспользуйте /buy для покупки подписки.`
                : `🔑 <b>Мои ключи</b> (${total}/5)\n\nВыберите ключ:`,
            { parse_mode: "HTML", reply_markup: keysKeyboard(keys, total) },
        );
    });

    bot.command("help", async (ctx) => {
        await ctx.reply(
            `🆘 <b>Поддержка</b>\n\n` +
                `По всем вопросам обращайтесь к администратору.\n\n` +
                `<b>Способы оплаты:</b>\n` +
                `⭐ <b>Telegram Stars</b> — покупаются в любом магазине Telegram\n` +
                `💎 <b>Крипта</b> (USDT/TON/BTC) — через @CryptoBot\n\n` +
                `<b>Команды:</b>\n` +
                `/start — приветствие\n` +
                `/buy — купить подписку\n` +
                `/keys — мои ключи`,
            { parse_mode: "HTML" },
        );
    });

    // Кнопка "Назад / Главное меню" из любого экрана
    bot.callbackQuery("back_to_menu", async (ctx) => {
        await ctx.answerCallbackQuery();
        try {
            await ctx.deleteMessage();
        } catch {}
        await sendWelcome(ctx);
    });

    // Показать тарифы из inline кнопки
    bot.callbackQuery("show_plans", async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
            `💳 <b>Выберите период подписки</b>\n\n` +
                `⭐ Telegram Stars\n` +
                `💎 USDT / TON / BTC через CryptoBot`,
            { parse_mode: "HTML", reply_markup: plansKeyboard() },
        );
    });

    // Мои ключи из inline кнопки
    bot.callbackQuery("my_keys", async (ctx) => {
        await ctx.answerCallbackQuery();
        const userId = ctx.from.id;
        const keys = getUserKeys(userId);
        const total = getTotalKeysCount(userId);

        await ctx.editMessageText(
            keys.length === 0
                ? `🔑 <b>Мои ключи</b>\n\nУ вас пока нет ключей.`
                : `🔑 <b>Мои ключи</b> (${total}/5)\n\nВыберите ключ:`,
            { parse_mode: "HTML", reply_markup: keysKeyboard(keys, total) },
        );
    });
}
