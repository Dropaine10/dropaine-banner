require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const PUBLIC_DIR = path.join(ROOT, "public");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "dropaine-banner.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brand_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  brand_name TEXT DEFAULT 'Dropaine Vídeo',
  phone TEXT DEFAULT '',
  logo_path TEXT DEFAULT '/dropaine-logo.png',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  image_path TEXT NOT NULL,
  caption TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const existingBrand = db.prepare("SELECT id FROM brand_settings WHERE id=1").get();
if (!existingBrand) {
  db.prepare("INSERT INTO brand_settings (id, brand_name, phone, logo_path) VALUES (1, ?, ?, ?)")
    .run("Dropaine Vídeo", "", "/dropaine-logo.png");
}

const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "troque-esta-senha";
const existingUser = db.prepare("SELECT id FROM users WHERE username=?").get(adminUser);
if (!existingUser) {
  const hash = bcrypt.hashSync(adminPass, 12);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(adminUser, hash);
  console.log(`[Dropaine Banner] Usuário inicial criado: ${adminUser}`);
}

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

app.use(session({
  secret: process.env.SESSION_SECRET || "dropaine-banner-altere-esta-chave",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 12
  }
}));

function esc(s="") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function auth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function layout(title, body, user=true) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} - Dropaine Banner</title>
<style>
:root{
  --bg:#0d0d14;--card:#171725;--card2:#202033;--text:#f7f7fb;--muted:#b6b6c7;
  --orange:#ff6a00;--pink:#ef0b6f;--purple:#6816b8;--line:#303044;--ok:#1fbf75;
}
*{box-sizing:border-box} body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:
radial-gradient(circle at top left,rgba(104,22,184,.24),transparent 34%),
radial-gradient(circle at top right,rgba(255,106,0,.18),transparent 30%),var(--bg);color:var(--text)}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:auto;padding:22px}
.top{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:54px;height:54px;object-fit:contain;background:white;border-radius:14px;padding:4px}
.brand h1{font-size:22px;margin:0}.brand small{display:block;color:var(--muted);margin-top:3px}
.nav{display:flex;gap:9px;flex-wrap:wrap}
.btn,.nav a,button{border:0;border-radius:12px;padding:11px 15px;background:var(--card2);color:white;cursor:pointer;font-weight:700}
.btn.primary,button.primary{background:linear-gradient(90deg,var(--orange),var(--pink),var(--purple))}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.card{background:rgba(23,23,37,.94);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 12px 30px rgba(0,0,0,.22)}
.card h2,.card h3{margin-top:0}.muted{color:var(--muted)}
.icon{font-size:34px;margin-bottom:12px}
input,select,textarea{width:100%;background:#10101a;color:white;border:1px solid var(--line);border-radius:12px;padding:12px;margin:7px 0 14px;font:inherit}
label{font-size:13px;color:var(--muted);font-weight:700}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.result{display:grid;grid-template-columns:100px 1fr auto;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.result img{width:100px;height:145px;object-fit:cover;border-radius:12px;background:#242436}
.badge{display:inline-block;border:1px solid #3b3b53;border-radius:999px;padding:5px 9px;color:#d6d6e5;font-size:12px}
.preview{max-width:430px;width:100%;border-radius:18px;border:1px solid var(--line)}
.flash{padding:12px 15px;border-radius:12px;background:#143728;border:1px solid #1d6b47;margin-bottom:16px}
@media(max-width:850px){.grid{grid-template-columns:1fr}.row{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.result{grid-template-columns:76px 1fr}.result img{width:76px;height:110px}.result .action{grid-column:1/-1}}
</style>
</head>
<body>
<div class="wrap">
${user ? `<div class="top">
  <a class="brand" href="/">
    <img src="/dropaine-logo.png" alt="Dropaine">
    <div><h1>Dropaine Banner</h1><small>Filmes • Séries • Futebol</small></div>
  </a>
  <div class="nav">
    <a href="/">Início</a>
    <a href="/brand">Minha Marca</a>
    <a href="/arts">Minhas Artes</a>
    <a href="/logout">Sair</a>
  </div>
</div>` : ""}
${body}
</div>
</body></html>`;
}

app.get("/health", (req, res) => res.json({ ok: true, app: "Dropaine Banner" }));

app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  const err = req.query.err ? `<div class="flash" style="background:#3b171b;border-color:#7a272f">Usuário ou senha inválidos.</div>` : "";
  res.send(layout("Login", `
  <div style="max-width:430px;margin:8vh auto">
    <div class="card" style="text-align:center">
      <img src="/dropaine-logo.png" style="width:150px;max-width:60%;background:#fff;border-radius:22px;padding:8px" alt="Dropaine">
      <h2 style="margin-bottom:4px">Dropaine Banner</h2>
      <p class="muted">Entre para criar suas artes.</p>
      ${err}
      <form method="post" action="/login" style="text-align:left">
        <label>Usuário</label>
        <input name="username" autocomplete="username" required>
        <label>Senha</label>
        <input type="password" name="password" autocomplete="current-password" required>
        <button class="primary" style="width:100%;margin-top:5px">Entrar</button>
      </form>
    </div>
  </div>`, false));
});

app.post("/login", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(req.body.username);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password_hash)) {
    return res.redirect("/login?err=1");
  }
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/", auth, (req, res) => {
  res.send(layout("Painel", `
    <div class="card" style="margin-bottom:18px">
      <span class="badge">Versão inicial 0.1</span>
      <h2 style="margin-bottom:6px">O que vamos criar hoje?</h2>
      <p class="muted">Pesquise um filme, uma série ou veja os jogos do dia. O banner já pode sair com sua marca e telefone.</p>
    </div>
    <div class="grid">
      <a class="card" href="/movies"><div class="icon">🎬</div><h3>Filmes</h3><p class="muted">Pesquisar filmes e criar banner + legenda.</p></a>
      <a class="card" href="/series"><div class="icon">📺</div><h3>Séries</h3><p class="muted">Pesquisar séries e criar arte de divulgação.</p></a>
      <a class="card" href="/football"><div class="icon">⚽</div><h3>Futebol</h3><p class="muted">Jogos do dia, horário e banner.</p></a>
      <a class="card" href="/brand"><div class="icon">🎨</div><h3>Minha Marca</h3><p class="muted">Logo, telefone e nome exibidos nas artes.</p></a>
      <a class="card" href="/arts"><div class="icon">🖼️</div><h3>Minhas Artes</h3><p class="muted">Histórico das imagens geradas.</p></a>
    </div>
  `));
});

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.get("/brand", auth, (req, res) => {
  const b = db.prepare("SELECT * FROM brand_settings WHERE id=1").get();
  const saved = req.query.saved ? `<div class="flash">Configurações salvas.</div>` : "";
  res.send(layout("Minha Marca", `
    ${saved}
    <div class="card">
      <h2>Minha Marca</h2>
      <p class="muted">Esses dados serão usados automaticamente nas novas artes.</p>
      <div class="row">
        <div>
          <img src="${esc(b.logo_path)}?v=${Date.now()}" style="max-width:230px;max-height:230px;background:white;border-radius:18px;padding:8px">
        </div>
        <form method="post" action="/brand" enctype="multipart/form-data">
          <label>Nome da marca</label>
          <input name="brand_name" value="${esc(b.brand_name)}" required>
          <label>WhatsApp / Telefone</label>
          <input name="phone" value="${esc(b.phone)}" placeholder="Ex.: (11) 97578-3082">
          <label>Trocar logo</label>
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp">
          <button class="primary">Salvar configurações</button>
        </form>
      </div>
    </div>
  `));
});

app.post("/brand", auth, upload.single("logo"), async (req, res) => {
  const current = db.prepare("SELECT * FROM brand_settings WHERE id=1").get();
  let logoPath = current.logo_path;

  if (req.file) {
    const out = path.join(UPLOAD_DIR, "brand-logo.png");
    await sharp(req.file.path).png().toFile(out);
    fs.unlinkSync(req.file.path);
    logoPath = "/uploads/brand-logo.png";
  }

  db.prepare(`
    UPDATE brand_settings SET brand_name=?, phone=?, logo_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=1
  `).run(req.body.brand_name || "Dropaine Vídeo", req.body.phone || "", logoPath);

  res.redirect("/brand?saved=1");
});

async function tmdbSearch(kind, query) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { missingKey: true, results: [] };
  const endpoint = kind === "movie" ? "movie" : "tv";
  const { data } = await axios.get(`https://api.themoviedb.org/3/search/${endpoint}`, {
    params: { api_key: key, query, language: "pt-BR", include_adult: false }
  });
  return { missingKey: false, results: data.results || [] };
}

function searchPage(type, title, icon) {
  const endpoint = type === "movie" ? "/movies" : "/series";
  return async (req, res) => {
    const q = (req.query.q || "").trim();
    let info = null;
    let results = [];
    if (q) {
      try {
        const r = await tmdbSearch(type, q);
        info = r.missingKey ? "Para pesquisar de verdade, adicione TMDB_API_KEY no EasyPanel." : null;
        results = r.results;
      } catch (e) {
        info = "Não foi possível consultar a TMDB agora. Confira a chave/API.";
      }
    }

    const list = results.map(item => {
      const name = type === "movie" ? item.title : item.name;
      const date = type === "movie" ? item.release_date : item.first_air_date;
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "";
      const backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : poster;
      return `<div class="result">
        <div>${poster ? `<img src="${poster}">` : `<div style="width:100px;height:145px;background:#242436;border-radius:12px"></div>`}</div>
        <div>
          <strong>${esc(name || "Sem título")}</strong>
          <div class="muted" style="margin:6px 0">${esc((date || "").slice(0,4))}</div>
          <div class="muted">${esc((item.overview || "").slice(0,180))}${(item.overview || "").length > 180 ? "…" : ""}</div>
        </div>
        <form class="action" method="post" action="/generate">
          <input type="hidden" name="type" value="${type}">
          <input type="hidden" name="title" value="${esc(name || "")}">
          <input type="hidden" name="year" value="${esc((date || "").slice(0,4))}">
          <input type="hidden" name="image_url" value="${esc(backdrop || poster || "")}">
          <input type="hidden" name="overview" value="${esc(item.overview || "")}">
          <button class="primary">Gerar arte</button>
        </form>
      </div>`;
    }).join("");

    res.send(layout(title, `
      <div class="card">
        <div class="icon">${icon}</div>
        <h2>${title}</h2>
        <form method="get" action="${endpoint}">
          <label>Digite o nome</label>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px">
            <input name="q" value="${esc(q)}" placeholder="${type === "movie" ? "Ex.: Vingadores Ultimato" : "Ex.: Stranger Things"}" style="margin:0">
            <button class="primary">Pesquisar</button>
          </div>
        </form>
        ${info ? `<p class="muted">${esc(info)}</p>` : ""}
        ${q && !results.length && !info ? `<p class="muted">Nenhum resultado encontrado.</p>` : ""}
        <div style="margin-top:16px">${list}</div>
      </div>
    `));
  };
}

app.get("/movies", auth, searchPage("movie", "Filmes", "🎬"));
app.get("/series", auth, searchPage("tv", "Séries", "📺"));

app.get("/football", auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  let games = [], info = null;
  if (process.env.APISPORTS_KEY) {
    try {
      const { data } = await axios.get("https://v3.football.api-sports.io/fixtures", {
        params: { date, timezone: "America/Sao_Paulo" },
        headers: { "x-apisports-key": process.env.APISPORTS_KEY }
      });
      games = data.response || [];
    } catch (e) {
      info = "Não foi possível consultar os jogos. Confira APISPORTS_KEY.";
    }
  } else {
    info = "Adicione APISPORTS_KEY no EasyPanel para carregar os jogos do dia automaticamente.";
  }

  const htmlGames = games.slice(0,60).map(g => {
    const when = new Date(g.fixture.date);
    const time = when.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit", timeZone:"America/Sao_Paulo"});
    const title = `${g.teams.home.name} x ${g.teams.away.name}`;
    return `<div class="result">
      <div style="display:flex;gap:6px;align-items:center">
        <img src="${g.teams.home.logo}" style="width:46px;height:46px;object-fit:contain">
        <img src="${g.teams.away.logo}" style="width:46px;height:46px;object-fit:contain">
      </div>
      <div><strong>${esc(title)}</strong><div class="muted">${esc(g.league.name)} • ${esc(time)}</div></div>
      <form class="action" method="post" action="/generate">
        <input type="hidden" name="type" value="football">
        <input type="hidden" name="title" value="${esc(title)}">
        <input type="hidden" name="year" value="${esc(time)}">
        <input type="hidden" name="overview" value="${esc(g.league.name)}">
        <label>Canal</label>
        <input name="channel" placeholder="Ex.: Premiere">
        <button class="primary">Gerar arte</button>
      </form>
    </div>`;
  }).join("");

  res.send(layout("Futebol", `
    <div class="card">
      <div class="icon">⚽</div>
      <h2>Futebol do dia</h2>
      <form method="get" action="/football">
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px">
          <input type="date" name="date" value="${esc(date)}" style="margin:0">
          <button class="primary">Carregar jogos</button>
        </div>
      </form>
      ${info ? `<p class="muted">${esc(info)}</p>` : ""}
      ${htmlGames}
    </div>
  `));
});

function wrapText(text, max=28) {
  const words = String(text).split(/\s+/);
  let lines = [], line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0,4);
}

function xmlEsc(s="") {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

async function makeBanner({title, subtitle, imageUrl, type, channel}) {
  const W = 1080, H = 1350;
  let bg;
  if (imageUrl) {
    try {
      const resp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 12000 });
      bg = await sharp(Buffer.from(resp.data)).resize(W,H,{fit:"cover"}).jpeg({quality:90}).toBuffer();
    } catch {}
  }
  if (!bg) {
    bg = await sharp({
      create: { width: W, height: H, channels: 3, background: {r:20,g:20,b:32} }
    }).jpeg().toBuffer();
  }

  const brand = db.prepare("SELECT * FROM brand_settings WHERE id=1").get();
  const logoFs = brand.logo_path.startsWith("/uploads/")
    ? path.join(ROOT, brand.logo_path)
    : path.join(PUBLIC_DIR, "dropaine-logo.png");

  let logoBuffer = null;
  try {
    logoBuffer = await sharp(logoFs).resize({ width: 180, height: 180, fit: "inside" }).png().toBuffer();
  } catch {}

  const titleLines = wrapText(title, 24);
  const titleSvg = titleLines.map((line, i) =>
    `<text x="70" y="${870 + i*76}" fill="white" font-size="66" font-weight="800"
      font-family="Arial, sans-serif">${xmlEsc(line)}</text>`).join("");

  let details = subtitle || "";
  if (type === "football" && channel) details = `${details} • ${channel}`;

  const phone = brand.phone ? `WhatsApp: ${xmlEsc(brand.phone)}` : "";
  const svg = Buffer.from(`
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity=".05"/>
        <stop offset="45%" stop-color="#000" stop-opacity=".12"/>
        <stop offset="100%" stop-color="#000" stop-opacity=".92"/>
      </linearGradient>
      <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ff6a00"/>
        <stop offset="50%" stop-color="#ef0b6f"/>
        <stop offset="100%" stop-color="#6816b8"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <rect x="70" y="820" width="250" height="8" rx="4" fill="url(#brand)"/>
    ${titleSvg}
    <text x="72" y="1205" fill="#eeeeee" font-size="34" font-family="Arial, sans-serif">${xmlEsc(details)}</text>
    <text x="72" y="1265" fill="#ffffff" font-size="30" font-weight="700" font-family="Arial, sans-serif">${phone}</text>
  </svg>`);

  const comps = [{ input: svg, top: 0, left: 0 }];
  if (logoBuffer) comps.push({ input: logoBuffer, top: 48, left: 850 });

  const outName = `arte-${Date.now()}.jpg`;
  const outPath = path.join(UPLOAD_DIR, outName);

  await sharp(bg).composite(comps).jpeg({quality:92}).toFile(outPath);
  return `/uploads/${outName}`;
}

async function captionFor(data) {
  const base = data.type === "football"
    ? `⚽ ${data.title}\n⏰ ${data.year || ""}${data.channel ? `\n📺 ${data.channel}` : ""}\n\n🔥 Futebol é aqui!`
    : `${data.type === "movie" ? "🎬" : "📺"} ${data.title}${data.year ? ` (${data.year})` : ""}\n\n${data.overview ? data.overview.slice(0,300) : "Conteúdo disponível para você aproveitar."}\n\n🍿 Prepare a pipoca!`;

  const hook = process.env.N8N_CAPTION_WEBHOOK_URL;
  if (!hook) return base;
  try {
    const { data: out } = await axios.post(hook, {
      type: data.type,
      title: data.title,
      year: data.year,
      overview: data.overview,
      channel: data.channel
    }, { timeout: 15000 });
    if (typeof out === "string" && out.trim()) return out.trim();
    if (out && typeof out.caption === "string" && out.caption.trim()) return out.caption.trim();
  } catch {}
  return base;
}

app.post("/generate", auth, async (req, res) => {
  const data = {
    type: req.body.type || "movie",
    title: req.body.title || "Sem título",
    year: req.body.year || "",
    overview: req.body.overview || "",
    imageUrl: req.body.image_url || "",
    channel: req.body.channel || ""
  };

  try {
    const imagePath = await makeBanner({
      title: data.title,
      subtitle: data.type === "football" ? `${data.overview} • ${data.year}` : data.year,
      imageUrl: data.imageUrl,
      type: data.type,
      channel: data.channel
    });
    const caption = await captionFor(data);
    const result = db.prepare("INSERT INTO arts(type,title,image_path,caption) VALUES(?,?,?,?)")
      .run(data.type, data.title, imagePath, caption);
    res.redirect(`/art/${result.lastInsertRowid}`);
  } catch (e) {
    console.error(e);
    res.status(500).send(layout("Erro", `<div class="card"><h2>Não foi possível gerar a arte.</h2><p class="muted">${esc(e.message)}</p><a class="btn" href="/">Voltar</a></div>`));
  }
});

app.get("/arts", auth, (req, res) => {
  const arts = db.prepare("SELECT * FROM arts ORDER BY id DESC LIMIT 100").all();
  const cards = arts.map(a => `<a class="card" href="/art/${a.id}">
    <img src="${a.image_path}" style="width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:14px">
    <h3>${esc(a.title)}</h3><span class="badge">${esc(a.type)}</span>
  </a>`).join("");
  res.send(layout("Minhas Artes", `<div class="grid">${cards || `<div class="card"><p class="muted">Nenhuma arte criada ainda.</p></div>`}</div>`));
});

app.get("/art/:id", auth, (req, res) => {
  const a = db.prepare("SELECT * FROM arts WHERE id=?").get(req.params.id);
  if (!a) return res.status(404).send("Arte não encontrada");
  res.send(layout(a.title, `
    <div class="row">
      <div class="card"><img class="preview" src="${a.image_path}"></div>
      <div class="card">
        <h2>${esc(a.title)}</h2>
        <label>Legenda</label>
        <textarea id="caption" rows="14">${esc(a.caption || "")}</textarea>
        <button class="primary" onclick="navigator.clipboard.writeText(document.getElementById('caption').value);this.textContent='Copiado!'">Copiar legenda</button>
        <a class="btn" href="${a.image_path}" target="_blank" style="display:inline-block;margin-left:8px">Abrir imagem</a>
      </div>
    </div>
  `));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Dropaine Banner] rodando na porta ${PORT}`);
});
