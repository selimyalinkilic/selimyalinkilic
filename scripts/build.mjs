#!/usr/bin/env node
/**
 * Profil görsellerini üretir. Her bileşen iki varyantta çıkar:
 *   · geniş  (1280px tasarım, masaüstü)
 *   · mobil  (640px tasarım, <picture> ile 600px altında devreye girer)
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

function shell({ w, h, radius = 20, body, label }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bg0}"/>
      <stop offset="1" stop-color="${C.bg1}"/>
    </linearGradient>
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

/* --------------------------------------------------------- giriş kartı */

function renderIntro(variant) {
  if (variant === "mobil") {
    return shell({
      w: 640,
      h: 330,
      label:
        "Senior frontend developer at Shopier. I turn designs into fast, accessible, slightly-too-polished interfaces — since 2017, from Istanbul.",
      body: `  <rect x="14" y="20" width="5" height="290" rx="2.5" fill="${C.pink}" opacity="0.9"/>
  <text x="40" y="56" font-family='${mono}' font-size="17" letter-spacing="3" fill="${C.pink}" opacity="0.8">HELLO</text>

  <text x="40" y="116" font-family='${sans}' font-size="30" font-weight="500" fill="${C.white}">Senior frontend developer</text>
  <text x="40" y="156" font-family='${sans}' font-size="30" font-weight="500" fill="${C.white}">at <tspan fill="${C.blue}">Shopier</tspan>. I turn designs</text>
  <text x="40" y="196" font-family='${sans}' font-size="30" font-weight="500" fill="${C.white}">into fast, accessible,</text>
  <text x="40" y="236" font-family='${sans}' font-size="30" font-weight="500" fill="${C.white}">slightly-too-polished interfaces.</text>

  <text x="40" y="282" font-family='${mono}' font-size="19" fill="${C.amber}">since 2017 · Istanbul</text>`,
    });
  }

  return shell({
    w: 1280,
    h: 176,
    label:
      "Senior frontend developer at Shopier. I turn designs into fast, accessible, slightly-too-polished interfaces — since 2017, from Istanbul. On the side, I keep making small things.",
    body: `  <rect x="11" y="18" width="4" height="140" rx="2" fill="${C.pink}" opacity="0.9"/>
  <text x="34" y="46" font-family='${mono}' font-size="10.5" letter-spacing="2.6" fill="${C.pink}" opacity="0.8">HELLO</text>

  <text x="34" y="90" font-family='${sans}' font-size="21" font-weight="500" fill="${C.white}">Senior frontend developer at <tspan fill="${C.blue}">Shopier</tspan>. I turn designs into fast, accessible,</text>
  <text x="34" y="120" font-family='${sans}' font-size="21" font-weight="500" fill="${C.white}">slightly-too-polished interfaces — <tspan fill="${C.amber}">since 2017</tspan>, from <tspan fill="${C.pink}">Istanbul</tspan>.</text>

  <line x1="34" y1="140" x2="1246" y2="140" stroke="${C.hair}"/>
  <text x="34" y="160" font-family='${mono}' font-size="12" fill="${C.text}">On the side, I keep making small things.</text>`,
  });
}

/* --------------------------------------------------------- bölüm başlığı */

const SECTIONS = [
  { key: "work", index: "01", title: "SELECTED WORK", accent: C.pink },
  { key: "care", index: "02", title: "WHAT I CARE ABOUT", accent: C.amber },
  { key: "github", index: "03", title: "ON GITHUB", accent: C.green },
  { key: "social", index: "04", title: "SOCIAL", accent: C.blue },
];

function renderSection(section, variant) {
  if (variant === "mobil") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="46" viewBox="0 0 640 46" role="img" aria-label="${esc(section.title.toLowerCase())}">
  <text x="4" y="30" font-family='${mono}' font-size="16" letter-spacing="2.4" fill="${section.accent}" opacity="0.85">${section.index}</text>
  <text x="44" y="30" font-family='${mono}' font-size="16" letter-spacing="2.4" fill="${C.muted}">${section.title}</text>
  <line x1="44" y1="40" x2="636" y2="40" stroke="${C.hair}"/>
</svg>
`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="38" viewBox="0 0 1280 38" role="img" aria-label="${esc(section.title.toLowerCase())}">
  <text x="12" y="26" font-family='${mono}' font-size="10.5" letter-spacing="3" fill="${section.accent}" opacity="0.85">${section.index}</text>
  <text x="42" y="26" font-family='${mono}' font-size="10.5" letter-spacing="3" fill="${C.muted}">${section.title}</text>
  <line x1="${60 + section.title.length * 9.6}" y1="22" x2="1268" y2="22" stroke="${C.hair}"/>
</svg>
`;
}

/* --------------------------------------------------------- değerler paneli */

const CARE = [
  { n: "01", title: "Simple over clever", desc: ["If it needs explaining, it can be simpler."], accent: C.pink },
  { n: "02", title: "Fast by default", desc: ["Speed is part of the design."], accent: C.amber },
  { n: "03", title: "Details matter", desc: ["The small things are the product."], accent: C.blue },
];

function renderCare(variant) {
  if (variant === "mobil") {
    const rows = CARE.map((item, i) => {
      const y = 78 + i * 108;
      return `  <text x="34" y="${y}" font-family='${mono}' font-size="16" letter-spacing="2.4" fill="${item.accent}" opacity="0.9">${item.n}</text>
  <text x="34" y="${y + 34}" font-family='${sans}' font-size="27" font-weight="700" letter-spacing="-0.4" fill="${C.white}">${esc(item.title)}</text>
  <text x="34" y="${y + 64}" font-family='${mono}' font-size="18" fill="${C.text}">${esc(item.desc[0])}</text>`;
    }).join("\n");

    return shell({
      w: 640,
      h: 380,
      label: CARE.map((c) => `${c.title}: ${c.desc.join(" ")}`).join(" · "),
      body: rows,
    });
  }

  const w = 1280;
  const h = 158;
  const step = (w - 88) / CARE.length;

  const body = CARE.map((item, i) => {
    const x = 44 + i * step;
    const divider =
      i === 0
        ? ""
        : `  <line x1="${(x - 30).toFixed(1)}" y1="34" x2="${(x - 30).toFixed(1)}" y2="${h - 34}" stroke="${C.hair}"/>\n`;
    return `${divider}  <g transform="translate(${x.toFixed(1)} 0)">
    <text y="44" font-family='${mono}' font-size="10.5" letter-spacing="2.2" fill="${item.accent}" opacity="0.9">${item.n}</text>
    <text y="80" font-family='${sans}' font-size="20" font-weight="700" letter-spacing="-0.3" fill="${C.white}">${esc(item.title)}</text>
    <text y="110" font-family='${mono}' font-size="12.5" fill="${C.text}">${esc(item.desc[0])}</text>
  </g>`;
  }).join("\n");

  return shell({
    w,
    h,
    label: CARE.map((c) => `${c.title}: ${c.desc.join(" ")}`).join(" · "),
    body,
  });
}

/* ------------------------------------------------------ istatistik şeridi */

function renderStats(stats, date, variant) {
  const cells = [
    { label: "SINCE", value: String(stats.since), hint: "on GitHub" },
    { label: "REPOS", value: fmt(stats.repositories), hint: "public" },
    { label: "STARS", value: fmt(stats.stars), hint: "earned" },
    { label: "FOLLOWERS", value: fmt(stats.followers), hint: "and counting" },
  ];

  if (variant === "mobil") {
    const body = cells
      .map((cell, i) => {
        const x = 34 + (i % 2) * 300;
        const y = i < 2 ? 0 : 130;
        return `  <g transform="translate(${x} ${y})">
    <text y="72" font-family='${mono}' font-size="16" letter-spacing="2.2" fill="${C.muted}">${cell.label}</text>
    <text y="126" font-family='${sans}' font-size="54" font-weight="800" letter-spacing="-1.4" fill="${C.white}">${cell.value}</text>
  </g>`;
      })
      .join("\n");

    return shell({
      w: 640,
      h: 300,
      label: `GitHub: ${stats.repositories} public repositories, ${stats.stars} stars, ${stats.followers} followers`,
      body: `${body}
  <line x1="34" y1="252" x2="606" y2="252" stroke="${C.hair}"/>
  <text x="34" y="278" font-family='${mono}' font-size="14" letter-spacing="1.6" fill="#4C5679">SINCE ${stats.since} · UPDATED ${stampOf(date)}</text>`,
    });
  }

  const w = 1280;
  const h = 158;
  const step = (w - 88) / cells.length;

  const body = cells
    .map((cell, i) => {
      const x = 44 + i * step;
      const divider =
        i === 0
          ? ""
          : `  <line x1="${(x - 26).toFixed(1)}" y1="42" x2="${(x - 26).toFixed(1)}" y2="${h - 42}" stroke="${C.hair}"/>\n`;
      return `${divider}  <g transform="translate(${x.toFixed(1)} 0)">
    <text y="58" font-family='${mono}' font-size="11" letter-spacing="2.4" fill="${C.muted}">${cell.label}</text>
    <text y="106" font-family='${sans}' font-size="40" font-weight="800" letter-spacing="-1.2" fill="${C.white}">${cell.value}</text>
    <text y="130" font-family='${mono}' font-size="11.5" fill="${C.faint}">${cell.hint}</text>
  </g>`;
    })
    .join("\n");

  return shell({
    w,
    h,
    label: `GitHub: ${stats.repositories} public repositories, ${stats.stars} stars, ${stats.followers} followers`,
    body: `${body}

  <g>
    <circle cx="${w - 136}" cy="34" r="4" fill="${C.pink}"/>
    <circle cx="${w - 120}" cy="34" r="4" fill="${C.amber}"/>
    <circle cx="${w - 104}" cy="34" r="4" fill="${C.green}"/>
    <text x="${w - 44}" y="58" font-family='${mono}' font-size="10.5" letter-spacing="1.1" fill="#4C5679" text-anchor="end">UPDATED ${stampOf(date)}</text>
  </g>`,
  });
}

function stampOf(date) {
  return date
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    })
    .toUpperCase();
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

function renderCard(p, variant) {
  if (variant === "mobil") {
    return shell({
      w: 640,
      h: 222,
      radius: 16,
      label: `${p.title} — ${p.desc.join(" ")}`,
      body: `  <rect x="14" y="20" width="5" height="182" rx="2.5" fill="${p.accent}" opacity="0.9"/>
  <text x="40" y="56" font-family='${mono}' font-size="16" letter-spacing="2.2" fill="${C.faint}">PROJECT ${p.index}</text>
  <text x="40" y="104" font-family='${sans}' font-size="31" font-weight="700" letter-spacing="-0.6" fill="${C.white}">${esc(p.title)}</text>
  <text x="40" y="140" font-family='${mono}' font-size="17" fill="${C.text}">${esc(p.desc[0])}</text>
  <text x="40" y="166" font-family='${mono}' font-size="17" fill="${C.text}">${esc(p.desc[1])}</text>
  <text x="40" y="198" font-family='${mono}' font-size="15" letter-spacing="2" fill="${p.accent}" opacity="0.85">${p.tag}</text>`,
    });
  }

  return shell({
    w: 1280,
    h: 118,
    radius: 16,
    label: `${p.title} — ${p.desc.join(" ")}`,
    body: `  <rect x="11" y="18" width="4" height="82" rx="2" fill="${p.accent}" opacity="0.9"/>

  <text x="34" y="40" font-family='${mono}' font-size="10.5" letter-spacing="2" fill="${C.faint}">PROJECT ${p.index}</text>
  <text x="34" y="82" font-family='${sans}' font-size="26" font-weight="700" letter-spacing="-0.5" fill="${C.white}">${esc(p.title)}</text>

  <text x="452" y="62" font-family='${mono}' font-size="13.5" fill="${C.text}">${esc(p.desc[0])}</text>
  <text x="452" y="86" font-family='${mono}' font-size="13.5" fill="${C.text}">${esc(p.desc[1])}</text>

  <text x="1246" y="76" font-family='${mono}' font-size="10.5" letter-spacing="2" fill="${p.accent}" opacity="0.85" text-anchor="end">${p.tag}</text>
  <circle cx="1246" cy="40" r="3" fill="${p.accent}" opacity="0.75"/>`,
  });
}

/* ---------------------------------------------------------- sosyal çipler */

const SOCIAL = [
  { key: "site", label: "selimyalinkilic.me", icon: "globe", accent: C.blue },
  { key: "linkedin", label: "in/selimyalinkilic", icon: "in", accent: C.pink },
  { key: "mail", label: "e-mail", icon: "mail", accent: C.amber },
];

function icon(name, color, { x = 16, y = 19, size = 26, radius = 9, font = 10.5 } = {}) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const box = `x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${color}" opacity="0.12"`;

  if (name === "globe") {
    const r = size * 0.285;
    return `<rect ${box}/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${size * 0.054}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.43}" ry="${r}" fill="none" stroke="${color}" stroke-width="${size * 0.046}" opacity="0.85"/>
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${color}" stroke-width="${size * 0.046}" opacity="0.85"/>`;
  }
  if (name === "in") {
    return `<rect ${box}/>
    <text x="${cx}" y="${cy + font * 0.36}" font-family='${mono}' font-size="${font}" font-weight="700" fill="${color}" text-anchor="middle">in</text>`;
  }
  return `<rect ${box}/>
    <rect x="${x + 3.5}" y="${y + 5.5}" width="${size - 7}" height="${size - 11}" rx="3" fill="none" stroke="${color}" stroke-width="${size * 0.054}"/>
    <path d="M${x + 4.5} ${y + 7.5} L${cx} ${cy + 1} L${x + size - 4.5} ${y + 7.5}" fill="none" stroke="${color}" stroke-width="${size * 0.05}"/>`;
}

function renderSocial(item, variant) {
  if (variant === "mobil") {
    return shell({
      w: 640,
      h: 110,
      radius: 18,
      label: item.label,
      body: `  ${icon(item.icon, item.accent, { x: 26, y: 29, size: 52, radius: 17, font: 21 })}
  <text x="96" y="68" font-family='${mono}' font-size="22" fill="${C.white}">${esc(item.label)}</text>
  <text x="608" y="66" font-family='${mono}' font-size="22" fill="${item.accent}" text-anchor="end" opacity="0.75">↗</text>`,
    });
  }

  return shell({
    w: 1280,
    h: 76,
    radius: 16,
    label: item.label,
    body: `  ${icon(item.icon, item.accent, { x: 20, y: 21, size: 34, radius: 11, font: 13 })}
  <text x="70" y="46" font-family='${mono}' font-size="15" fill="${C.white}">${esc(item.label)}</text>
  <text x="1252" y="45" font-family='${mono}' font-size="15" fill="${item.accent}" text-anchor="end" opacity="0.75">↗</text>`,
  });
}

/* -------------------------------------------------------------- çalıştır */

async function main() {
  const stats = await collect();
  const now = new Date();

  const write = (path, content) => writeFile(join(ROOT, path), content, "utf8");

  await write("intro.svg", renderIntro("genis"));
  await write("intro.mobil.svg", renderIntro("mobil"));

  await write("care.svg", renderCare("genis"));
  await write("care.mobil.svg", renderCare("mobil"));

  await write("stats.svg", renderStats(stats, now, "genis"));
  await write("stats.mobil.svg", renderStats(stats, now, "mobil"));

  for (const dir of ["cards", "social", "sections"]) {
    await mkdir(join(ROOT, dir), { recursive: true });
  }

  for (const project of PROJECTS) {
    const name = project.repo || "more";
    await write(`cards/${name}.svg`, renderCard(project, "genis"));
    await write(`cards/${name}.mobil.svg`, renderCard(project, "mobil"));
  }

  for (const item of SOCIAL) {
    await write(`social/${item.key}.svg`, renderSocial(item, "genis"));
    await write(`social/${item.key}.mobil.svg`, renderSocial(item, "mobil"));
  }

  for (const section of SECTIONS) {
    await write(`sections/${section.key}.svg`, renderSection(section, "genis"));
    await write(`sections/${section.key}.mobil.svg`, renderSection(section, "mobil"));
  }

  console.log(
    `Kartlar hazır — ${stats.repositories} repo, ${stats.stars} yıldız, ${stats.followers} takipçi`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
