import { InlineKeyboard } from "grammy";
import { rublesToStars } from "./payments.js";

export const MAX_KEYS = 5;

export const PLANS = [
    { id: "1m", label: "1 месяц", months: 1, days: 30, amount: 200 },
    { id: "3m", label: "3 месяца", months: 3, days: 90, amount: 540 },
    { id: "6m", label: "6 месяцев", months: 6, days: 180, amount: 1110 },
];

export function plansKeyboard() {
    const kb = new InlineKeyboard();
    for (const plan of PLANS) {
        const stars = rublesToStars(plan.amount);
        kb.text(
            `${plan.label} — ${plan.amount} ₽ / ${stars} ⭐`,
            `plan_${plan.id}`,
        ).row();
    }
    kb.text("⬅️ Назад", "back_to_menu");
    return kb;
}

export function paymentMethodKeyboard(planId) {
    return new InlineKeyboard()
        .text("⭐ Telegram Stars", `pay_stars_${planId}`)
        .row()
        .text("💎 USDT / Крипта (CryptoBot)", `pay_crypto_${planId}`)
        .row()
        .text("⬅️ Назад", "back_to_menu");
}

export function cryptoPayKeyboard(payUrl, invoiceId) {
    return new InlineKeyboard()
        .url("💎 Оплатить криптой", payUrl)
        .row()
        .text("✅ Я оплатил", `check_crypto_${invoiceId}`)
        .row()
        .text("❌ Отмена", "back_to_menu");
}

export function keysKeyboard(keys, totalCount) {
    const kb = new InlineKeyboard();
    for (const key of keys) {
        const expired = new Date(key.expires_at) < new Date();
        const icon = expired ? "❌" : "✅";
        kb.text(`${icon} Ключ #${key.key_number}`, `key_${key.id}`).row();
    }
    if (totalCount < MAX_KEYS) {
        kb.text(
            `➕ Получить ещё ключ (${totalCount}/${MAX_KEYS})`,
            "get_key",
        ).row();
    } else {
        kb.text(
            `🔒 Лимит достигнут (${MAX_KEYS}/${MAX_KEYS})`,
            "keys_limit",
        ).row();
        kb.text("💳 Купить ещё подписку", "show_plans").row();
    }
    kb.text("⬅️ Назад", "back_to_menu");
    return kb;
}

export function keyDetailKeyboard(keyId) {
    return new InlineKeyboard().text("⬅️ К списку ключей", "my_keys");
}

export function backToMenuKeyboard() {
    return new InlineKeyboard().text("⬅️ Главное меню", "back_to_menu");
}
