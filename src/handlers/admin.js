import { getStats, getAllUsers } from "../db.js";

const ADMIN_ID = parseInt(process.env.ADMIN_ID);

function isAdmin(ctx) {
    return ctx.from?.id === ADMIN_ID;
}

export function registerAdminHandlers(bot) {
    bot.command("stats", async (ctx) => {
        if (!isAdmin(ctx)) return;
        const s = getStats();
        await ctx.reply(
            `📊 <b>Статистика</b>\n\n` +
                `👥 Пользователей: <b>${s.users}</b>\n` +
                `🔑 Ключей выдано: <b>${s.keys}</b>\n` +
                `💳 Успешных платежей: <b>${s.paid}</b>\n` +
                `  ⭐ Stars: ${s.stars}\n` +
                `  💎 Крипта: ${s.crypto}`,
            { parse_mode: "HTML" },
        );
    });

    bot.command("users", async (ctx) => {
        if (!isAdmin(ctx)) return;
        const users = getAllUsers();
        if (!users.length) {
            await ctx.reply("Пользователей нет.");
            return;
        }
        const lines = users
            .slice(0, 30)
            .map(
                (u) =>
                    `• ${u.full_name || "—"} (@${u.username || "—"}) [${u.telegram_id}]`,
            );
        await ctx.reply(
            `👥 <b>Пользователи (${users.length})</b>\n\n` + lines.join("\n"),
            { parse_mode: "HTML" },
        );
    });

    bot.command("broadcast", async (ctx) => {
        if (!isAdmin(ctx)) return;
        const text = ctx.message.text.replace("/broadcast", "").trim();
        if (!text) {
            await ctx.reply("Использование: /broadcast текст");
            return;
        }
        const users = getAllUsers();
        let sent = 0,
            failed = 0;
        for (const user of users) {
            try {
                await ctx.api.sendMessage(user.telegram_id, text, {
                    parse_mode: "HTML",
                });
                sent++;
                await new Promise((r) => setTimeout(r, 50));
            } catch {
                failed++;
            }
        }
        await ctx.reply(
            `✅ Рассылка завершена\nОтправлено: ${sent}\nОшибок: ${failed}`,
        );
    });

    bot.command("admin", async (ctx) => {
        if (!isAdmin(ctx)) return;
        await ctx.reply(
            `🔧 <b>Команды администратора</b>\n\n` +
                `/stats — статистика\n` +
                `/users — список пользователей\n` +
                `/broadcast текст — рассылка`,
            { parse_mode: "HTML" },
        );
    });
}
