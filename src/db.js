import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "bot.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id   INTEGER PRIMARY KEY,
    username      TEXT,
    full_name     TEXT,
    trial_used    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS keys (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    xui_uuid      TEXT NOT NULL,
    xui_email     TEXT NOT NULL UNIQUE,
    key_link      TEXT NOT NULL,
    key_number    INTEGER NOT NULL,
    expires_at    TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    payment_id    TEXT UNIQUE NOT NULL,
    amount        REAL NOT NULL,
    months        INTEGER NOT NULL,
    method        TEXT DEFAULT 'unknown',
    status        TEXT DEFAULT 'pending',
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
  );
`);

// ─── Users ───────────────────────────────────────────────────

export function upsertUser(telegramId, username, fullName) {
    db.prepare(
        `
    INSERT INTO users (telegram_id, username, full_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username  = excluded.username,
      full_name = excluded.full_name
  `,
    ).run(telegramId, username ?? null, fullName ?? null);
}

export function getUser(telegramId) {
    return db
        .prepare("SELECT * FROM users WHERE telegram_id = ?")
        .get(telegramId);
}

export function setTrialUsed(telegramId) {
    db.prepare("UPDATE users SET trial_used = 1 WHERE telegram_id = ?").run(
        telegramId,
    );
}

// ─── Keys ────────────────────────────────────────────────────

export function getUserKeys(userId) {
    return db
        .prepare("SELECT * FROM keys WHERE user_id = ? ORDER BY key_number ASC")
        .all(userId);
}

export function getTotalKeysCount(userId) {
    return db
        .prepare("SELECT COUNT(*) as count FROM keys WHERE user_id = ?")
        .get(userId).count;
}

export function getNextKeyNumber(userId) {
    return (
        db
            .prepare("SELECT COUNT(*) as count FROM keys WHERE user_id = ?")
            .get(userId).count + 1
    );
}

export function addKey(
    userId,
    xuiUuid,
    xuiEmail,
    keyLink,
    keyNumber,
    expiresAt,
) {
    return db
        .prepare(
            `
    INSERT INTO keys (user_id, xui_uuid, xui_email, key_link, key_number, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
        )
        .run(userId, xuiUuid, xuiEmail, keyLink, keyNumber, expiresAt);
}

// ─── Payments ────────────────────────────────────────────────

export function createPayment(
    userId,
    paymentId,
    amount,
    months,
    method = "unknown",
) {
    db.prepare(
        `
    INSERT INTO payments (user_id, payment_id, amount, months, method)
    VALUES (?, ?, ?, ?, ?)
  `,
    ).run(userId, paymentId, amount, months, method);
}

export function getPayment(paymentId) {
    return db
        .prepare("SELECT * FROM payments WHERE payment_id = ?")
        .get(paymentId);
}

export function updatePaymentStatus(paymentId, status) {
    db.prepare("UPDATE payments SET status = ? WHERE payment_id = ?").run(
        status,
        paymentId,
    );
}

// ─── Admin ───────────────────────────────────────────────────

export function getAllUsers() {
    return db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
}

export function getStats() {
    return {
        users: db.prepare("SELECT COUNT(*) as c FROM users").get().c,
        keys: db.prepare("SELECT COUNT(*) as c FROM keys").get().c,
        paid: db
            .prepare(
                "SELECT COUNT(*) as c FROM payments WHERE status='succeeded'",
            )
            .get().c,
        stars: db
            .prepare(
                "SELECT COUNT(*) as c FROM payments WHERE status='succeeded' AND method='stars'",
            )
            .get().c,
        crypto: db
            .prepare(
                "SELECT COUNT(*) as c FROM payments WHERE status='succeeded' AND method='crypto'",
            )
            .get().c,
    };
}

export default db;
