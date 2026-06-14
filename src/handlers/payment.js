import {
    createCryptoInvoice,
    checkCryptoInvoice,
    rublesToStars,
} from "../payments.js";
import {
    PLANS,
    MAX_KEYS,
    plansKeyboard,
    paymentMethodKeyboard,
    cryptoPayKeyboard,
    backToMenuKeyboard,
} from "../keyboards.js";
import { createPayment, getPayment, updatePaymentStatus } from "../db.js";
import { issueKey } from "./keys.js";

export function registerPaymentHandlers(bot) {
    bot.callbackQuery("buy", async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
            `💳 <b>Выберите период подписки</b>\n\n⭐ Telegram Stars\n💎 USDT / TON / BTC через CryptoBot`,
            { parse_mode: "HTML", reply_markup: plansKeyboard() },
        );
    });

    bot.callbackQuery(/^plan_(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        const plan = PLANS.find((p) => p.id === ctx.match[1]);
        if (!plan) return;
        const stars = rublesToStars(plan.amount);
        await ctx.editMessageText(
            `📦 <b>${plan.label}</b>\n\nСтоимость: <b>${plan.amount} ₽</b>\nили <b>${stars} ⭐ Stars</b>\n\nВыберите способ оплаты:`,
            {
                parse_mode: "HTML",
                reply_markup: paymentMethodKeyboard(plan.id),
            },
        );
    });

    bot.callbackQuery(/^pay_stars_(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        const plan = PLANS.find((p) => p.id === ctx.match[1]);
        if (!plan) return;
        const stars = rublesToStars(plan.amount);
        const userId = ctx.from.id;
        const paymentId = `stars_${userId}_${Date.now()}`;
        createPayment(userId, paymentId, plan.amount, plan.months, "stars");
        try {
            await ctx.deleteMessage();
        } catch {}
        await ctx.api.sendInvoice(
            ctx.chat.id,
            `🇬🇪 VPN — ${plan.label}`,
            `Доступ к VPN на ${plan.months} мес. До ${MAX_KEYS} устройств. Без ограничений скорости.`,
            paymentId,
            "XTR",
            [{ label: `VPN ${plan.label}`, amount: stars }],
        );
        await ctx.api.sendMessage(
            ctx.chat.id,
            `Если хотите выбрать другой способ оплаты или тариф:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Отмена", callback_data: "back_to_menu" }],
                    ],
                },
            },
        );
    });

    bot.on("pre_checkout_query", async (ctx) => {
        await ctx.answerPreCheckoutQuery(true);
    });

    bot.on("message:successful_payment", async (ctx) => {
        const paymentId = ctx.message.successful_payment.invoice_payload;
        const dbPayment = getPayment(paymentId);
        if (!dbPayment || dbPayment.status === "succeeded") return;
        updatePaymentStatus(paymentId, "succeeded");
        await issueKey(ctx, ctx.from.id, dbPayment.months * 30);
    });

    bot.callbackQuery(/^pay_crypto_(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        const plan = PLANS.find((p) => p.id === ctx.match[1]);
        if (!plan) return;
        const userId = ctx.from.id;
        await ctx.editMessageText("⏳ Создаю счёт...");
        try {
            const invoice = await createCryptoInvoice(
                plan.amount,
                `VPN ${plan.label}`,
                `${userId}:${plan.months}:${plan.amount}`,
            );
            createPayment(
                userId,
                String(invoice.invoiceId),
                plan.amount,
                plan.months,
                "crypto",
            );
            await ctx.editMessageText(
                `💎 <b>Оплата криптовалютой</b>\n\nТариф: <b>${plan.label}</b>\nСумма: <b>~${invoice.amount} USD</b>\nПринимаем: USDT, TON, BTC, ETH\n\n1. Нажмите <b>«Оплатить криптой»</b>\n2. Оплатите в CryptoBot\n3. Нажмите <b>«Я оплатил»</b>`,
                {
                    parse_mode: "HTML",
                    reply_markup: cryptoPayKeyboard(
                        invoice.payUrl,
                        invoice.invoiceId,
                    ),
                },
            );
        } catch (err) {
            console.error("CryptoBot error:", err.message);
            await ctx.editMessageText(
                "❌ Не удалось создать счёт. Попробуйте позже.",
                { reply_markup: backToMenuKeyboard() },
            );
        }
    });

    bot.callbackQuery(/^check_crypto_(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery("Проверяю...");
        const invoiceId = ctx.match[1];
        const dbPayment = getPayment(invoiceId);
        if (!dbPayment) {
            await ctx.answerCallbackQuery("Платёж не найден", {
                show_alert: true,
            });
            return;
        }
        if (dbPayment.status === "succeeded") {
            await ctx.answerCallbackQuery("Уже обработан ✅", {
                show_alert: true,
            });
            return;
        }
        try {
            const status = await checkCryptoInvoice(invoiceId);
            if (status === "paid") {
                updatePaymentStatus(invoiceId, "succeeded");
                await issueKey(ctx, ctx.from.id, dbPayment.months * 30);
            } else if (status === "expired") {
                updatePaymentStatus(invoiceId, "canceled");
                await ctx.editMessageText(
                    "❌ Счёт истёк. Создайте новый через /buy",
                    { reply_markup: backToMenuKeyboard() },
                );
            } else {
                await ctx.answerCallbackQuery(
                    "⏳ Оплата ещё не поступила. Попробуйте снова.",
                    { show_alert: true },
                );
            }
        } catch (err) {
            console.error("Check invoice error:", err.message);
            await ctx.answerCallbackQuery(
                "Ошибка проверки. Попробуйте позже.",
                { show_alert: true },
            );
        }
    });
}
