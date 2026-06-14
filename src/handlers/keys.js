import {
    getUser,
    getUserKeys,
    getTotalKeysCount,
    getNextKeyNumber,
    addKey,
    setTrialUsed,
} from "../db.js";
import { createClient } from "../xui.js";
import {
    keysKeyboard,
    keyDetailKeyboard,
    backToMenuKeyboard,
    MAX_KEYS,
} from "../keyboards.js";

function formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function registerKeysHandlers(bot) {
    // Мои ключи
    bot.callbackQuery("my_keys", async (ctx) => {
        await ctx.answerCallbackQuery();
        const userId = ctx.from.id;
        const keys = getUserKeys(userId);
        const total = getTotalKeysCount(userId);

        if (keys.length === 0) {
            await ctx.editMessageText(
                `🔑 <b>Мои ключи</b>\n\nУ вас пока нет ключей.\nПолучите пробный период или купите подписку.`,
                { parse_mode: "HTML", reply_markup: keysKeyboard([], 0) },
            );
            return;
        }

        await ctx.editMessageText(
            `🔑 <b>Мои ключи</b> (${total}/${MAX_KEYS})\n\nВыберите ключ:`,
            { parse_mode: "HTML", reply_markup: keysKeyboard(keys, total) },
        );
    });

    // Просмотр ключа
    bot.callbackQuery(/^key_(\d+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        const keyId = parseInt(ctx.match[1]);
        const keys = getUserKeys(ctx.from.id);
        const key = keys.find((k) => k.id === keyId);
        if (!key) {
            await ctx.answerCallbackQuery("Ключ не найден", {
                show_alert: true,
            });
            return;
        }

        const expired = new Date(key.expires_at) < new Date();
        const status = expired ? "❌ Истёк" : "✅ Активен";

        await ctx.editMessageText(
            `🔑 <b>Ключ #${key.key_number}</b>\n\n` +
                `Статус: ${status}\n` +
                `Действует до: <b>${formatDate(key.expires_at)}</b>\n\n` +
                `<b>Ссылка для подключения:</b>\n` +
                `<code>${key.key_link}</code>\n\n` +
                `Скопируйте ссылку и добавьте в приложение VPN.`,
            { parse_mode: "HTML", reply_markup: keyDetailKeyboard(key.id) },
        );
    });

    // Лимит ключей
    bot.callbackQuery("keys_limit", async (ctx) => {
        await ctx.answerCallbackQuery(`Достигнут лимит ${MAX_KEYS} ключей`, {
            show_alert: true,
        });
    });

    // Получить ещё ключ (для пользователей с активной подпиской)
    bot.callbackQuery("get_key", async (ctx) => {
        await ctx.answerCallbackQuery();
        const userId = ctx.from.id;
        const total = getTotalKeysCount(userId);

        if (total >= MAX_KEYS) {
            await ctx.answerCallbackQuery(
                `Достигнут лимит ${MAX_KEYS} ключей`,
                { show_alert: true },
            );
            return;
        }

        const keys = getUserKeys(userId);
        const hasActive = keys.some((k) => new Date(k.expires_at) > new Date());

        if (!hasActive) {
            await ctx.editMessageText(
                `⚠️ Нет активной подписки.\n\nКупите подписку чтобы получить ещё ключ.`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "💳 Купить подписку",
                                    callback_data: "buy",
                                },
                            ],
                        ],
                    },
                },
            );
            return;
        }

        // Берём срок истечения из последнего активного ключа
        const activeKey = keys
            .filter((k) => new Date(k.expires_at) > new Date())
            .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0];

        const daysLeft = Math.ceil(
            (new Date(activeKey.expires_at) - new Date()) /
                (1000 * 60 * 60 * 24),
        );

        await issueKey(ctx, userId, daysLeft);
    });

    // Пробный период
    bot.callbackQuery("trial", async (ctx) => {
        await ctx.answerCallbackQuery();
        const userId = ctx.from.id;
        const user = getUser(userId);

        if (user.trial_used) {
            await ctx.answerCallbackQuery(
                "Вы уже использовали пробный период",
                { show_alert: true },
            );
            return;
        }

        setTrialUsed(userId);
        await issueKey(ctx, userId, 3, true);
    });
}

/**
 * Создать ключ в XUI и выдать пользователю
 */
export async function issueKey(ctx, userId, days, isTrial = false) {
    const user = getUser(userId);
    const username = user.username || `user${userId}`;
    const keyNumber = getNextKeyNumber(userId);

    let editTarget;
    try {
        editTarget = await ctx.editMessageText("⏳ Создаю ключ, подождите...");
    } catch {
        editTarget = await ctx.reply("⏳ Создаю ключ, подождите...");
    }

    try {
        const { uuid, email, link, expiresAt } = await createClient(
            username,
            keyNumber,
            days,
        );
        addKey(userId, uuid, email, link, keyNumber, expiresAt);

        const total = getTotalKeysCount(userId);
        const trialNote = isTrial ? "🎁 <b>Пробный период: 3 дня</b>\n\n" : "";

        const text =
            `✅ <b>Ключ #${keyNumber} создан!</b>\n\n` +
            trialNote +
            `Действует до: <b>${new Date(expiresAt).toLocaleDateString("ru-RU")}</b>\n\n` +
            `<b>Ссылка для подключения:</b>\n` +
            `<code>${link}</code>\n\n` +
            `Добавьте ссылку в приложение VPN (например happ).`;

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: `🔑 Мои ключи (${total}/${MAX_KEYS})`,
                        callback_data: "my_keys",
                    },
                ],
                [{ text: "⬅️ Главное меню", callback_data: "back_to_menu" }],
            ],
        };

        try {
            await editTarget.editText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
            });
        } catch {
            await ctx.api.sendMessage(userId, text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
            });
        }
    } catch (err) {
        console.error("Ошибка создания ключа:", err);
        const errText =
            "❌ Не удалось создать ключ. Попробуйте позже или обратитесь в поддержку.";
        try {
            await editTarget.editText(errText, {
                reply_markup: backToMenuKeyboard(),
            });
        } catch {
            await ctx.api.sendMessage(userId, errText);
        }
    }
}
