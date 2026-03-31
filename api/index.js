const fetch = require(“node-fetch”);
const cheerio = require(“cheerio”);

const BASE_URL = “https://v3.kirmzi.space”;
const ALBA_BASE = “https://w.shadwo.pro/albaplayer”;
const TMDB_KEY = “439c478a771f35c05022f9feabcca01c”;

const HEADERS = {
“User-Agent”: “Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36”,
“Accept-Language”: “ar,en-US;q=0.8,en;q=0.5”
};

const manifest = {
id: “community.kirmzi.abdulluhx”,
version: “1.0.0”,
name: “Kirmzi by Abdulluh.X”,
description: “مسلسلات تركية بترجمة عربية من قرمزي”,
resources: [“stream”],
types: [“series”],
catalogs: [],
idPrefixes: [“tt”]
};

async function fetchText(url) {
try {
const res = await fetch(url, { headers: HEADERS });
if (!res.ok) return “”;
return await res.text();
} catch (e) {
return “”;
}
}

async function getTmdbMeta(tmdbId) {
try {
const arRes = await fetch(“https://api.themoviedb.org/3/tv/” + tmdbId + “?api_key=” + TMDB_KEY + “&language=ar-SA”);
const enRes = await fetch(“https://api.themoviedb.org/3/tv/” + tmdbId + “?api_key=” + TMDB_KEY + “&language=en-US”);
const arData = await arRes.json();
const enData = await enRes.json();
return {
arabicTitle: arData.name || “”,
englishTitle: enData.name || “”,
originalTitle: enData.original_name || “”
};
} catch (e) {
return { arabicTitle: “”, englishTitle: “”, originalTitle: “” };
}
}

function buildEpisodeUrl(arabicTitle, episode) {
var slug = “\u0645\u0633\u0644\u0633\u0644-” + arabicTitle.replace(/\s+/g, “-”) + “-\u0627\u0644\u062d\u0644\u0642\u0629-” + episode;
return BASE_URL + “/episode/” + encodeURIComponent(slug) + “/”;
}

function extractAlbaUrl(html) {
var match = html.match(/iframe[^>]*src=”([^”]*albaplayer/[^”]*)”/i);
if (!match) return “”;
var parts = match[1].split(“albaplayer/”);
var slug = parts[parts.length - 1].replace(//$/, “”);
return slug ? ALBA_BASE + “/” + slug + “/” : “”;
}

function unpackPACK(html) {
try {
var match = html.match(/eval(function(p,a,c,k,e,d){[\s\S]*?}(’((?:[^’\]|\.)*)’,\s*(\d+)\s*,\s*(\d+)\s*,’((?:[^’\]|\.)*)’.split(’|’)/);
if (!match) return “”;
var p = match[1], a = parseInt(match[2]), c = parseInt(match[3]), k = match[4].split(”|”);
var dict = {};
while (c–) {
var key = c.toString(a > 10 ? 36 : 10);
dict[key] = k[c] || key;
}
return p.replace(/\b(\w+)\b/g, function(m) { return dict[m] !== undefined ? dict[m] : m; });
} catch (e) { return “”; }
}

async function extractM3u8FromEmbed(embedUrl) {
var html = await fetchText(embedUrl);
if (!html) return null;
if (html.includes(“eval(function(p,a,c,k,e,d)”)) {
var unpacked = unpackPACK(html);
var m3u8match = unpacked.match(/(?:file|src)\s*:\s*”(https?://[^”]*.m3u8[^”]*)”/);
if (m3u8match) return { url: m3u8match[1], embedUrl: embedUrl };
}
var direct = html.match(/(?:file|src)\s*:\s*[”’](https?://[^"']*.m3u8[^"']*)[”’]/);
if (direct) return { url: direct[1], embedUrl: embedUrl };
return null;
}

async function extractFromAlba(albaUrl) {
var html = await fetchText(albaUrl);
if (!html) return null;
var iframeMatch = html.match(/iframe[^>]*src=”(https?://[^”]*embed[^”]*)”/i);
if (!iframeMatch) return null;
return await extractM3u8FromEmbed(iframeMatch[1]);
}

async function searchForEpisode(meta, episode) {
var terms = [meta.arabicTitle, meta.englishTitle, meta.originalTitle].filter(Boolean);
for (var t = 0; t < terms.length; t++) {
var html = await fetchText(BASE_URL + “/?s=” + encodeURIComponent(terms[t]));
if (!html) continue;
var $ = cheerio.load(html);
var found = “”;
$(“a[href*=’/episode/’]”).each(function(_, el) {
var href = $(el).attr(“href”) || “”;
var decoded = decodeURIComponent(href);
var epMatch = decoded.match(/\u0627\u0644\u062d\u0644\u0642\u0629-(\d+)/);
if (epMatch && parseInt(epMatch[1]) === parseInt(episode)) {
found = href;
}
});
if (found) return found;
}
return “”;
}

async function getStreams(type, id) {
try {
var parts = id.split(”:”);
var tmdbId = parts[0];
var episode = parts[2];
if (!episode) return [];

```
    var meta = await getTmdbMeta(tmdbId);
    var albaUrl = "";

    if (meta.arabicTitle) {
        var epUrl = buildEpisodeUrl(meta.arabicTitle, episode);
        var html = await fetchText(epUrl);
        if (html) albaUrl = extractAlbaUrl(html);
    }

    if (!albaUrl) {
        var searchedUrl = await searchForEpisode(meta, episode);
        if (searchedUrl) {
            var html2 = await fetchText(searchedUrl);
            if (html2) albaUrl = extractAlbaUrl(html2);
        }
    }

    if (!albaUrl) return [];

    var result = await extractFromAlba(albaUrl);
    if (!result) return [];

    return [{
        name: "Kirmzi by Abdulluh.X",
        title: "\u0642\u0631\u0645\u0632\u064a | \u0645\u062a\u0631\u062c\u0645 \u0639\u0631\u0628\u064a",
        url: result.url,
        behaviorHints: {
            notWebReady: false,
            headers: {
                "Referer": result.embedUrl,
                "User-Agent": HEADERS["User-Agent"]
            }
        }
    }];
} catch (e) {
    return [];
}
```

}

module.exports = async function(req, res) {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Content-Type”, “application/json”);

```
var url = req.url || "/";

if (url === "/" || url.indexOf("/manifest.json") !== -1) {
    return res.end(JSON.stringify(manifest));
}

var streamMatch = url.match(/\/stream\/(series|movie)\/(.+)\.json/);
if (streamMatch) {
    var streams = await getStreams(streamMatch[1], streamMatch[2]);
    return res.end(JSON.stringify({ streams: streams }));
}

res.statusCode = 404;
res.end(JSON.stringify({ error: "Not found" }));
```

};
