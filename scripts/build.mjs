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

  const body = `  <rect x="11" y="18" width="4" height="${h - 36}" rx="2" fill="${p.accent}" opacity="0.9"/>
  <text x="34" y="42" font-family='${mono}' font-size="10.5" letter-spacing="2" fill="${C.faint}">PROJECT ${p.index}</text>
  <circle cx="${w - 34}" cy="38" r="3" fill="${p.accent}" opacity="0.75"/>

  <text x="33" y="84" font-family='${sans}' font-size="25" font-weight="700" letter-spacing="-0.5" fill="${C.white}">${esc(p.title)}</text>

  <text x="34" y="116" font-family='${mono}' font-size="14" fill="${C.text}">${esc(p.desc[0])}</text>
  <text x="34" y="138" font-family='${mono}' font-size="14" fill="${C.text}">${esc(p.desc[1])}</text>

  <line x1="34" y1="155" x2="${w - 31}" y2="155" stroke="${C.hair}"/>
  <text x="34" y="175" font-family='${mono}' font-size="10.5" letter-spacing="1.8" fill="${p.accent}" opacity="0.85">${p.tag}</text>`;

  return shell({
    w,
    h,
    radius: 16,
    label: `${p.title} — ${p.desc.join(" ")}`,
    body,
  });
}

/* --------------------------------------------------------- değerler paneli */

const CARE = [
  {
    n: "01",
    title: "Simple over clever",
    desc: ["If it needs explaining,", "it can be simpler."],
    accent: C.pink,
  },
  {
    n: "02",
    title: "Fast by default",
    desc: ["Speed is part of", "the design."],
    accent: C.amber,
  },
  {
    n: "03",
    title: "Details matter",
    desc: ["The small things", "are the product."],
    accent: C.blue,
  },
];

function renderCare() {
  const w = 1280;
  const h = 158;
  const pad = 44;
  const step = (w - pad * 2) / CARE.length;

  const body = CARE.map((item, i) => {
    const x = pad + i * step;
    const divider =
      i === 0
        ? ""
        : `  <line x1="${(x - 30).toFixed(1)}" y1="34" x2="${(x - 30).toFixed(1)}" y2="${h - 34}" stroke="${C.hair}"/>\n`;
    return `${divider}  <g transform="translate(${x.toFixed(1)} 0)">
    <text y="44" font-family='${mono}' font-size="10.5" letter-spacing="2.2" fill="${item.accent}" opacity="0.9">${item.n}</text>
    <text y="80" font-family='${sans}' font-size="20" font-weight="700" letter-spacing="-0.3" fill="${C.white}">${esc(item.title)}</text>
    <text y="108" font-family='${mono}' font-size="12.5" fill="${C.text}">${esc(item.desc[0])}</text>
    <text y="128" font-family='${mono}' font-size="12.5" fill="${C.text}">${esc(item.desc[1])}</text>
  </g>`;
  }).join("\n");

  return shell({
    w,
    h,
    label: CARE.map((c) => `${c.title}: ${c.desc.join(" ")}`).join(" · "),
    body,
  });
}

/* ---------------------------------------------------------- sosyal çipler */

const SOCIAL = [
  { key: "site", label: "selimyalinkilic.me", icon: "globe", accent: C.blue },
  { key: "linkedin", label: "in/selimyalinkilic", icon: "in", accent: C.pink },
  { key: "mail", label: "e-mail", icon: "mail", accent: C.amber },
];

function icon(name, color) {
  const box = `x="16" y="19" width="26" height="26" rx="9" fill="${color}" opacity="0.12"`;
  if (name === "globe") {
    return `<rect ${box}/>
    <circle cx="29" cy="32" r="7.4" fill="none" stroke="${color}" stroke-width="1.4"/>
    <ellipse cx="29" cy="32" rx="3.2" ry="7.4" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.85"/>
    <line x1="21.6" y1="32" x2="36.4" y2="32" stroke="${color}" stroke-width="1.2" opacity="0.85"/>`;
  }
  if (name === "in") {
    return `<rect ${box}/>
    <text x="29" y="36" font-family='${mono}' font-size="10.5" font-weight="700" fill="${color}" text-anchor="middle">in</text>`;
  }
  return `<rect ${box}/>
    <rect x="19.5" y="24.5" width="19" height="15" rx="3" fill="none" stroke="${color}" stroke-width="1.4"/>
    <path d="M20.5 26.5 L29 32.5 L37.5 26.5" fill="none" stroke="${color}" stroke-width="1.3"/>`;
}

function renderSocial(item) {
  const w = 260;
  const h = 66;

  const body = `  ${icon(item.icon, item.accent)}
  <text x="54" y="39" font-family='${mono}' font-size="12.5" fill="${C.white}">${esc(item.label)}</text>
  <text x="${w - 18}" y="38" font-family='${mono}' font-size="13" fill="${item.accent}" text-anchor="end" opacity="0.75">↗</text>`;

  return shell({
    w,
    h,
    radius: 14,
    label: item.label,
    body,
  });
}

/* --------------------------------------------------------- bölüm başlığı */

const SECTIONS = [
  { key: "work", index: "01", title: "SELECTED WORK", accent: C.pink },
  { key: "care", index: "02", title: "WHAT I CARE ABOUT", accent: C.amber },
  { key: "github", index: "03", title: "ON GITHUB", accent: C.green },
  { key: "social", index: "04", title: "SOCIAL", accent: C.blue },
];

function renderSection(section) {
  const w = 1280;
  const h = 38;
  const pad = 12;

  const body = `  <text x="${pad}" y="26" font-family='${mono}' font-size="10.5" letter-spacing="3" fill="${section.accent}" opacity="0.85">${section.index}</text>
  <text x="${pad + 30}" y="26" font-family='${mono}' font-size="10.5" letter-spacing="3" fill="${C.muted}">${section.title}</text>
  <line x1="${pad + 30 + section.title.length * 9.6 + 18}" y1="22" x2="${w - pad}" y2="22" stroke="${C.hair}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(section.title.toLowerCase())}">
${body}
</svg>
`;
}

/* -------------------------------------------------------------- çalıştır */

async function main() {
  const stats = await collect();
  await writeFile(join(ROOT, "stats.svg"), renderStats(stats, new Date()), "utf8");
  await writeFile(join(ROOT, "care.svg"), renderCare(), "utf8");

  await mkdir(join(ROOT, "cards"), { recursive: true });
  for (const project of PROJECTS) {
    const name = project.repo || "more";
    await writeFile(join(ROOT, "cards", `${name}.svg`), renderCard(project), "utf8");
  }

  await mkdir(join(ROOT, "social"), { recursive: true });
  for (const item of SOCIAL) {
    await writeFile(join(ROOT, "social", `${item.key}.svg`), renderSocial(item), "utf8");
  }

  await mkdir(join(ROOT, "sections"), { recursive: true });
  for (const section of SECTIONS) {
    await writeFile(join(ROOT, "sections", `${section.key}.svg`), renderSection(section), "utf8");
  }

  console.log(
    `stats.svg, care.svg, ${PROJECTS.length} proje kartı, ${SOCIAL.length} sosyal çip yazıldı — ${stats.repositories} repo, ${stats.stars} yıldız, ${stats.followers} takipçi`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
