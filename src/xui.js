import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import https from "https";

const BASE_URL = process.env.XUI_URL;
const USERNAME = process.env.XUI_USERNAME;
const PASSWORD = process.env.XUI_PASSWORD;
const INBOUND_ID = parseInt(process.env.XUI_INBOUND_ID);

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

let sessionCookie = null;

async function login() {
    const res = await client.post("/login", {
        username: USERNAME,
        password: PASSWORD,
    });
    const cookies = res.headers["set-cookie"];
    if (!cookies) throw new Error("XUI: нет cookie после логина");
    sessionCookie = cookies.map((c) => c.split(";")[0]).join("; ");
}

async function request(method, url, data = null) {
    if (!sessionCookie) await login();
    try {
        const res = await client.request({
            method,
            url,
            data,
            headers: { Cookie: sessionCookie },
        });
        return res.data;
    } catch (err) {
        if (err.response?.status === 401) {
            sessionCookie = null;
            await login();
            const res = await client.request({
                method,
                url,
                data,
                headers: { Cookie: sessionCookie },
            });
            return res.data;
        }
        throw err;
    }
}

export async function createClient(username, keyNumber, days) {
    const uuid = uuidv4();
    const email = `client-${username}-${keyNumber}`;
    const expiryMs = Date.now() + days * 24 * 60 * 60 * 1000;

    const res = await request("post", "/panel/api/inbounds/addClient", {
        id: INBOUND_ID,
        settings: JSON.stringify({
            clients: [
                {
                    id: uuid,
                    flow: "",
                    email,
                    limitIp: 1,
                    totalGB: 0,
                    expiryTime: expiryMs,
                    enable: true,
                    tgId: "",
                    subId: "",
                },
            ],
        }),
    });

    if (!res.success) throw new Error(`XUI addClient failed: ${res.msg}`);

    const inboundRes = await request(
        "get",
        `/panel/api/inbounds/get/${INBOUND_ID}`,
    );
    if (!inboundRes.success)
        throw new Error("XUI: не удалось получить данные инбоунда");

    const inbound = inboundRes.obj;
    const streamSettings = JSON.parse(inbound.streamSettings || "{}");
    const host = new URL(BASE_URL).hostname;
    const port = inbound.port;
    const network = streamSettings.network || "tcp";
    const security = streamSettings.security || "none";

    let link = "";

    if (inbound.protocol === "vless") {
        const params = new URLSearchParams();
        params.set("type", network);
        params.set("security", security);

        if (network === "ws") {
            const ws = streamSettings.wsSettings || {};
            params.set("path", ws.path || "/");
            if (ws.headers?.Host) params.set("host", ws.headers.Host);
        }

        if (network === "xhttp" || network === "splithttp") {
            const xhttp =
                streamSettings.xhttpSettings ||
                streamSettings.splithttpSettings ||
                {};
            params.set("path", xhttp.path || "/");
        }

        if (security === "reality") {
            const r = streamSettings.realitySettings || {};
            params.set("pbk", r.publicKey || "");
            params.set("fp", r.fingerprint || "chrome");
            params.set("sni", (r.serverNames || [])[0] || host);
            params.set("sid", (r.shortIds || [])[0] || "");
            params.set("spx", r.spiderX || "/");
        }

        if (security === "tls") {
            const tls = streamSettings.tlsSettings || {};
            params.set("sni", tls.serverName || host);
        }

        link = `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(email)}`;
    }

    return { uuid, email, link, expiresAt: new Date(expiryMs).toISOString() };
}
