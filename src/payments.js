import axios from "axios";

const CRYPTOBOT_TOKEN = process.env.CRYPTOBOT_TOKEN;
const CRYPTOBOT_API = "https://pay.crypt.bot/api";

// Курс Stars: 1 звезда ≈ 0.013 USD, корректируй по необходимости
const STARS_PER_RUBLE = 1.5; // примерно 1.5 звезды за рубль

export const PAYMENT_METHODS = {
    stars: "Telegram Stars",
    crypto: "CryptoBot (USDT)",
};

// ─── Конвертация рублей в Stars ──────────────────────────────

export function rublesToStars(rubles) {
    return Math.ceil(rubles * STARS_PER_RUBLE);
}

// ─── CryptoBot API ───────────────────────────────────────────

async function cryptobotRequest(method, params = {}) {
    const res = await axios.get(`${CRYPTOBOT_API}/${method}`, {
        params,
        headers: { "Crypto-Pay-API-Token": CRYPTOBOT_TOKEN },
    });

    if (!res.data.ok) {
        throw new Error(
            `CryptoBot error: ${res.data.error?.name || "Unknown"}`,
        );
    }

    return res.data.result;
}

/**
 * Создать инвойс в CryptoBot
 * @param {number} amountRub - сумма в рублях
 * @param {string} description - описание
 * @param {string} payload - метаданные (userId:months)
 */
export async function createCryptoInvoice(amountRub, description, payload) {
    // Конвертируем рубли в USDT (примерный курс, можно получать динамически)
    const usdAmount = (amountRub / 90).toFixed(2); // ~90 руб за доллар

    const invoice = await cryptobotRequest("createInvoice", {
        currency_type: "fiat",
        fiat: "USD",
        accepted_assets: "USDT,TON,BTC,ETH",
        amount: usdAmount,
        description,
        payload,
        expires_in: 3600, // 1 час
    });

    return {
        invoiceId: invoice.invoice_id,
        payUrl: invoice.pay_url,
        amount: usdAmount,
    };
}

/**
 * Проверить статус инвойса CryptoBot
 */
export async function checkCryptoInvoice(invoiceId) {
    const result = await cryptobotRequest("getInvoices", {
        invoice_ids: String(invoiceId),
    });

    const invoice = result.items?.[0];
    if (!invoice) throw new Error("Инвойс не найден");

    return invoice.status; // active | paid | expired
}

/**
 * Верифицировать вебхук от CryptoBot
 */
export function verifyCryptobotWebhook(body, signature) {
    import("crypto").then(({ createHmac }) => {
        const secret = createHmac("sha256", "WebAppData")
            .update(CRYPTOBOT_TOKEN)
            .digest();
        const check = createHmac("sha256", secret)
            .update(JSON.stringify(body))
            .digest("hex");
        return check === signature;
    });
}
