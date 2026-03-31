const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const BASE_URL = "https://v3.kirmzi.space";
const ALBA_BASE = "https://w.shadwo.pro/albaplayer";
const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "ar,en-US;q=0.8,en;q=0.5"
};

const manifest = {
    id: "community.kirmzi.abdulluhx",
    version: "1.0.0",
    name: "Kirmzi by Abdulluh.X",
    description: "مسلسلات تركية بترجمة عربية من قرمزي",
    logo: "https://raw.githubusercontent.com/hfip/arabic-providers/main/IMG_5223.jpeg",
    resources: ["stream"],
    types: ["series"],
    catalogs: [],
    idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

async function fetchText(url) {
    try {
        const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
        if (!res.ok) return "";
        return await res.text();
    } catch (e) {
        console.log(`[Kirmzi] fetch error: ${e.message}`);
        return "";
    }
}

async function getTmdbMeta(tmdbId) {
    try {
        const [arRes, enRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&language=ar-SA`),
            fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`)
        ]);
        const arData = await arRes.json();
        const enData = await enRes.json();
        return {
            arabicTitle: arData.name || "",
            englishTitle: enData.name || "",
            originalTitle: enData.original_name || ""
        };
    } catch (e) {
        return { arabicTitle: "", englishTitle: "", originalTitle: "" };
    }
}

function buildEpisodeUrl(arabicTitle, episode) {
    const slug = `مسلسل-${arabicTitle.replace(/\s+/g, "-")}-الحلقة-${episode}`;
    return `${BASE_URL}/episode/${encodeURIComponent(slug)}/`;
}

function extractAlbaUrl(html) {
    const match = html.match(/iframe[^>]*src="([^"]*albaplayer\/[^"]*)"/i);
    if (!match) return "";
    const parts = match[1].split("albaplayer/");
    const slug = parts[parts.length - 1].replace(/\/$/, "");
    return slug ? `${ALBA_BASE}/${slug}/` : "";
}

function unpackPACK(packed) {
    try {
        const match = packed.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:[^'\\]|\\.)*)',\s*(\d+)\s*,\s*(\d+)\s*,'((?:[^'\\]|\\.)*)'.split\('\|'\)/);
        if (!match) return "";
        let [, p, a, c, k] = match;
        a = parseInt(a); c = parseInt(c); k = k.split("|");
        const dict = {};
        while (c--) {
            const key = c.toString(a > 10 ? 36 : 10);
            dict[key] = k[c] || key;
        }
        return p.replace(/\b(\w+)\b/g, m => dict[m] !== undefined ? dict[m] : m);
    } catch (e) { return ""; }
}

async function extractM3u8FromEmbed(embedUrl) {
    const html = await fetchText(embedUrl);
    if (!html) return null;
    const packed = html.match(/eval\(function\(p,a,c,k,e,d\)/)?.[0];
    if (packed) {
        const unpacked = unpackPACK(html);
        const m3u8 = unpacked.match(/(?:file|src)\s*:\s*"(https​​​​​​​​​​​​​​​​
