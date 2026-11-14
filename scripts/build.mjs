#!/usr/bin/env node
/**
 * Profil görsellerini üretir: stats.svg + cards/*.svg
 * Palet selimyalinkilic.me ile aynı. GitHub API'sinden gelen sayılar her gün tazelenir.
 *
 *   Yerelde:  node scripts/build.mjs      (gh auth token kullanır)
 *   Action'da: GITHUB_TOKEN ortam değişkeni
 */

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGIN = "selimyalinkilic";

/* ---------------------------------------------------------------- tema */

const C = {
  bg0: "#0A0F24",
  bg1: "#151D44",
  line: "#2A3560",
  hair: "#1E2749",
  white: "#FFFFFF",
  text: "#A9B2D6",
  muted: "#7D8AAE",
  faint: "#5F6B90",
  pink: "#FF6B9A",
  amber: "#FFB547",
  blue: "#5B8CFF",
  green: "#2FBF7A",
};

const sans = `"Rubik", Helvetica Neue, Helvetica, Arial, sans-serif`;
const mono = `"JetBrains Mono", ui-monospace, Menlo, monospace`;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmt = (n) => new Intl.NumberFormat("en-US").format(n);

/** Kart iskeleti: zemin, kenarlık ve tipografi sınıfları. */
function shell({ w, h, radius = 20, body, label }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bg0}"/>
      <stop offset="1" stop-color="${C.bg1}"/>
    </linearGradient>
    <style>
      .label { font-family: ${mono}; font-size: 11px; letter-spacing: 2.4px; fill: ${C.muted}; }
      .value { font-family: ${sans}; font-size: 40px; font-weight: 800; letter-spacing: -1.2px; fill: ${C.white}; }
      .hint  { font-family: ${mono}; font-size: 11.5px; fill: ${C.faint}; }
      .stamp { font-family: ${mono}; font-size: 10.5px; letter-spacing: 1.1px; fill: #4C5679; }
    </style>
  </defs>

  <rect width="${w}" height="${h}" rx="${radius}" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${radius - 0.5}" fill="none" stroke="${C.line}"/>
${body}
</svg>
`;
}

/* -------------------------------------------------------------- veri */

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error("GITHUB_TOKEN yok ve `gh auth token` çalışmadı.");
  }
}

const TOKEN = token();

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "selimyalinkilic-profile-stats",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function collect() {
  const { data } = await api("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ($login: String!) {
        user(login: $login) {
          createdAt
          followers { totalCount }
          repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
        }
      }`,
      variables: { login: LOGIN },
    }),
  });

  let stars = 0;
  for (let page = 1; ; page += 1) {
    const repos = await api(`/users/${LOGIN}/repos?per_page=100&type=owner&page=${page}`);
    if (!repos.length) break;
    stars += repos.reduce((sum, r) => sum + r.stargazers_count, 0);
    if (repos.length < 100) break;
  }

  return {
    since: new Date(data.user.createdAt).getFullYear(),
    repositories: data.user.repositories.totalCount,
    stars,
    followers: data.user.followers.totalCount,
  };
}

/* ------------------------------------------------------ istatistik şeridi */

function renderStats({ since, repositories, stars, followers }, date) {
  const w = 1280;
  const h = 158;
  const pad = 44;
  const cells = [
    { label: "SINCE", value: String(since), hint: "on GitHub" },
    { label: "PUBLIC REPOS", value: fmt(repositories), hint: "and private ones" },
    { label: "STARS", value: fmt(stars), hint: "earned" },
    { label: "FOLLOWERS", value: fmt(followers), hint: "and counting" },
  ];

  const step = (w - pad * 2) / cells.length;
  const body = cells
    .map((cell, i) => {
      const x = pad + i * step;
      const divider =
        i === 0
          ? ""
          : `    <line x1="${(x - 26).toFixed(1)}" y1="42" x2="${(x - 26).toFixed(1)}" y2="${h - 42}" stroke="${C.hair}"/>\n`;
      return `${divider}    <g transform="translate(${x.toFixed(1)} 0)">
      <text y="58" class="label">${cell.label}</text>
      <text y="106" class="value">${cell.value}</text>
      <text y="130" class="hint">${cell.hint}</text>
    </g>`;
    })
    .join("\n");

  const stamp = date
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    })
    .toUpperCase();

  return shell({
    w,
    h,
    label: `GitHub: ${repositories} public repositories, ${stars} stars, ${followers} followers`,
    body: `${body}

  <g>
    <circle cx="${w - pad - 92}" cy="34" r="4" fill="${C.pink}"/>
    <circle cx="${w - pad - 76}" cy="34" r="4" fill="${C.amber}"/>
    <circle cx="${w - pad - 60}" cy="34" r="4" fill="${C.green}"/>
    <text x="${w - pad}" y="58" class="stamp" text-anchor="end">UPDATED ${stamp}</text>
  </g>`,
  });
}

/* ---------------------------------------------------------- proje kartı */

const PROJECTS = [
  {
    repo: "ecommerce-rest-api",
    index: "01",
    title: "ecommerce-rest-api",
    desc: ["The behind-the-scenes part of an online store:", "products, accounts, sign-in."],
    tag: "BUILT END TO END",
    accent: C.pink,
  },
  {
    repo: "next-countries",
    index: "02",
    title: "next-countries",
    desc: ["A small app to browse countries", "and their details."],
    tag: "WEEKEND PROJECT",
    accent: C.amber,
  },
  {
    repo: "blog-frontend",
    index: "03",
    title: "blog-frontend",
    desc: ["The reader-facing side of a blog:", "posts, lists, reading."],
    tag: "EARLY PROJECT",
    accent: C.blue,
  },
  {
    repo: null,
    index: "04",
    title: "more on GitHub →",
    desc: ["Smaller experiments, older work", "and things I keep tinkering with."],
    tag: "ALWAYS TINKERING",
    accent: C.green,
  },
];

function renderCard(p) {
  const w = 620;
  const h = 186;

  const body = `  <rect x="0" y="0" width="5" height="${h}" rx="2.5" fill="${p.accent}" opacity="0.9"/>
  <text x="31" y="42" font-family='${mono}' font-size="10.5" letter-spacing="2" fill="${C.faint}">PROJECT ${p.index}</text>
  <circle cx="${w - 34}" cy="38" r="3" fill="${p.accent}" opacity="0.75"/>

  <text x="30" y="84" font-family='${sans}' font-size="25" font-weight="700" letter-spacing="-0.5" fill="${C.white}">${esc(p.title)}</text>

  <text x="31" y="116" font-family='${mono}' font-size="14" fill="${C.text}">${esc(p.desc[0])}</text>
  <text x="31" y="138" font-family='${mono}' font-size="14" fill="${C.text}">${esc(p.desc[1])}</text>

  <line x1="31" y1="155" x2="${w - 31}" y2="155" stroke="${C.hair}"/>
  <text x="31" y="175" font-family='${mono}' font-size="10.5" letter-spacing="1.8" fill="${p.accent}" opacity="0.85">${p.tag}</text>`;

  return shell({
    w,
    h,
    radius: 16,
    label: `${p.title} — ${p.desc.join(" ")}`,
    body,
  });
}

/* -------------------------------------------------------------- çalıştır */

async function main() {
  const stats = await collect();
  await writeFile(join(ROOT, "stats.svg"), renderStats(stats, new Date()), "utf8");

  await mkdir(join(ROOT, "cards"), { recursive: true });
  for (const project of PROJECTS) {
    const name = project.repo || "more";
    await writeFile(join(ROOT, "cards", `${name}.svg`), renderCard(project), "utf8");
  }

  console.log(
    `stats.svg + ${PROJECTS.length} kart yazıldı — ${stats.repositories} repo, ${stats.stars} yıldız, ${stats.followers} takipçi`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
