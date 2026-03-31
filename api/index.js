const { getRouter } = require("stremio-addon-sdk");
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
    resources: ["stream"],
    types: ["series"],
    catalogs: [],
    idPrefixes: ["tt"]
};

async function fetchText(url) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return "";
        return await res.text();
    } catch (e) {
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

function unpackPACK(html) {
    try {
        const match = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:[^'\\]|\\.)*)',\s*(\d+)\s*,\s*(\d+)\s*,'((?:[^'\\]|\\.)*)'.split\('\|'\)/);
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
    if (html.includes("eval(function(p,a,c,k,e,d)")) {
        const unpacked = unpackPACK(html);
        const m3u8 = unpacked.match(/(?:file|src)\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/)?.[1];
        if (m3u8) return { url: m3u8, embedUrl };
    }
    const direct = html.match(/(?:file|src)\s*:\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/)?.[1];
    if (direct) return { url: direct, embedUrl };
    return null;
}

async function extractFromAlba(albaUrl) {
    const html = await fetchText(albaUrl);
    if (!html) return null;
    const iframeMatch = html.match(/iframe[^>]*src="(https?:\/\/[^"]*embed[^"]*)"/i);
    if (!iframeMatch) return null;
    return await extractM3u8FromEmbed(iframeMatch[1]);
}

async function searchForEpisode(meta, episode) {
    const terms = [meta.arabicTitle, meta.englishTitle, meta.originalTitle].filter(Boolean);
    for (const term of terms) {
        const html = await fetchText(`${BASE_URL}/?s=${encodeURIComponent(term)}`);
        if (!html) continue;
        const $ = cheerio.load(html);
        let found = "";
        $("a[href*='/episode/']").each((_, el) => {
            const href = $(el).attr("href") || "";
            const decoded = decodeURIComponent(href);
            const epMatch = decoded.match(/الحلقة-(\d+)/);
            if (epMatch && parseInt(epMatch[1]) === parseInt(episode)) {
                found = href;
            }
        });
        if (found) return found;
    }
    return "";
}

async function getStreams(type, id) {
    try {
        const parts = id.split(":");
        const tmdbId = parts[0];
        const season = parts[1] || "1";
        const episode = parts[2];
        if (!episode) return [];

        const meta = await getTmdbMeta(tmdbId);

        let albaUrl = "";
        if (meta.arabicTitle) {
            const epUrl = buildEpisodeUrl(meta.arabicTitle, episode);
            const html = await fetchText(epUrl);
            if (html) albaUrl = extractAlbaUrl(html);
        }
