const express = require("express")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const cookieParser = require("cookie-parser")
const multer = require("multer")

const envPaths = [path.join(__dirname, "..", ".env"), path.join(__dirname, ".env")]
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const t = line.trim()
      if (t && !t.startsWith("#") && t.includes("=")) {
        const idx = t.indexOf("=")
        process.env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "")
      }
    }
    break
  }
}

const PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PORT, 10) || 8080
const HOST = process.env.HOST || "0.0.0.0"
const DIR = __dirname
const AUTH_USERNAME = process.env.AUTH_USERNAME || "info@smartiqo.com"
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "Smartiqo@7772"
const SESSION_TOKEN = "secure_smartiqo_session_token_xyz"


const app = express()
const USERS_FILE = path.join(DIR, "users.json")
const CONFIG_FILE = path.join(DIR, "config.json")

function loadUsers() {
  if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"))
  const defaultUsers = [{name: "Admin User", email: "admin@smartiqo.com", password: "Admin@7772", role: "admin"}]
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2))
  return defaultUsers
}
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)) }

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
  const def = {googleSheetUrl: ""}
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(def, null, 2))
  return def
}
function saveConfig(cfg) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)) }


const ORDERS_FILE = path.join(DIR, "orders.json")

function loadOrders() {
  if (fs.existsSync(ORDERS_FILE)) return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"))
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2))
  return []
}
function saveOrders(orders) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2)) }

app.post("/api/admin/orders", (req, res) => {
  const email = req.cookies.auth_email || req.body.email || "guest@smartiqo.com";
  const orders = loadOrders();
  const payload = req.body.payload || req.body;
  
  // Create order object with user mapping
  const orderEntry = {
    id: payload.orderId || "ORD-" + Date.now(),
    userEmail: email,
    timestamp: new Date().toISOString(),
    details: payload
  };
  
  // Check if updating
  if (payload.status === "Updated" && payload.productId) {
    const idx = orders.findIndex(o => o.details.productId === payload.productId && o.userEmail === email);
    if (idx !== -1) {
      orders[idx] = orderEntry;
    } else {
      orders.push(orderEntry);
    }
  } else {
    orders.push(orderEntry);
  }
  
  saveOrders(orders);
  res.json({success: true});
});

app.get("/api/admin/orders", (req, res) => {
  // if (req.cookies.auth_role !== "admin") return res.status(403).json({error: "Admin only"});
  res.json({orders: loadOrders()});
});

app.post("/api/admin/users", (req, res) => {
  const users = loadUsers()
  if (users.find(u => u.email === req.body.email)) return res.status(400).json({error: "User exists"})
  users.push({
    name: req.body.name, email: req.body.email,
    password: req.body.password, role: req.body.role || "user"
  })
  saveUsers(users)
  res.json({success: true})
})

app.get("/api/admin/users", (req, res) => {
  const users = loadUsers().map(u => ({name: u.name, email: u.email, role: u.role}))
  res.json({users})
})

app.delete("/api/admin/users", (req, res) => {
  const email = req.query.email
  let users = loadUsers()
  users = users.filter(u => u.email !== email)
  saveUsers(users)
  res.json({success: true})
})

app.get("/api/config/google-sheet-url", (req, res) => {
  res.json({url: loadConfig().googleSheetUrl})
})

app.post("/api/config/google-sheet-url", (req, res) => {
  const cfg = loadConfig()
  cfg.googleSheetUrl = req.body.url
  saveConfig(cfg)
  res.json({success: true})
})


app.disable("x-powered-by")

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cookieParser())

app.use((req, res, next) => {
  const start = Date.now()
  res.on("finish", () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
  })
  next()
})

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
  if (req.method === "OPTIONS") return res.sendStatus(200)
  next()
})

const ASSET_PREFIXES = ["/_next/", "/assets/", "/icon/", "/Image/", "/image/", "/favicon.png", "/india.png"]
app.use((req, res, next) => {
  for (const prefix of ASSET_PREFIXES) {
    if (req.path.includes(prefix) && !req.path.startsWith(prefix)) {
      req.url = prefix + req.path.split(prefix)[1]
      break
    }
  }
  next()
})

const ASSET_EXTS = [".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2", ".ttf"]

function isAuthenticated(req) {
  return req.cookies?.session_token === SESSION_TOKEN
}

function isAssetPath(p) {
  if (["/_next/", "/assets/", "/icon/", "/Image/", "/image/"].some(pre => p.startsWith(pre))) return true
  if (p === "/favicon.png" || p === "/india.png") return true
  if (p.toLowerCase().includes("custom-cart-sync.js")) return true
  return ASSET_EXTS.some(e => p.toLowerCase().endsWith(e))
}

app.use((req, res, next) => {
  if (req.method !== "GET") return next()
  const p = req.path
  if (isAssetPath(p) || p.startsWith("/api/")) return next()
  if (p.toLowerCase().startsWith("/login")) {
    if (isAuthenticated(req)) {
      res.setHeader("Set-Cookie", [
        `session_token=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
        "logged_in=yes; Path=/; SameSite=Lax"
      ])
      return res.redirect("/")
    }
    return next()
  }
  if (p.toLowerCase().startsWith("/admin")) return next()
  if (!isAuthenticated(req)) return res.redirect("/Login")
  next()
})

function sendJson(res, status, data) {
  res.status(status).json(data)
}

function serveHtml(res, filePath) {
  let html = fs.readFileSync(filePath, "utf-8")
  if (!html.includes("<base ")) {
    html = html.replace("<head>", '<head><base href="/">')
  }
  res.type("html").send(html)
}

const mimeMap = {
  ".js": "application/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".mp4": "video/mp4", ".webm": "video/webm", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".pdf": "application/pdf"
}

const ICON_DIR = path.join(DIR, "icon", "dynamic", "My_Icons")
const META_FILE = path.join(ICON_DIR, "metadata.json")

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(ICON_DIR, { recursive: true }); cb(null, ICON_DIR) },
    filename: (req, file, cb) => {
      const ext = [".svg", ".png", ".jpg", ".jpeg"].includes(path.extname(file.originalname).toLowerCase())
        ? path.extname(file.originalname).toLowerCase() : ".svg"
      cb(null, `custom_${crypto.randomUUID().slice(0, 8)}${ext}`)
    }
  })
}).single("icon")

app.post("/api/icons/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err || !req.file) return sendJson(res, 400, { error: err ? err.message : "No file uploaded" })
    const category = req.body.category || "Decorative lights"
    const cleanName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    const newId = crypto.randomUUID()
    const fileName = req.file.filename
    let metadata = {}
    if (fs.existsSync(META_FILE)) {
      try { metadata = JSON.parse(fs.readFileSync(META_FILE, "utf-8")) } catch (e) { /* skip */ }
    }
    metadata[fileName] = { id: newId, name: cleanName, category }
    fs.mkdirSync(path.dirname(META_FILE), { recursive: true })
    fs.writeFileSync(META_FILE, JSON.stringify(metadata, null, 2))
    const iconUrl = `/icon/dynamic/My_Icons/${fileName}`
    sendJson(res, 200, { id: newId, category, url: iconUrl, name: cleanName, imageUrl: iconUrl })
  })
})

app.delete("/api/icons/upload", (req, res) => {
  const iconId = req.query.id
  if (iconId && fs.existsSync(META_FILE)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(META_FILE, "utf-8"))
      let foundFile = null
      for (const [fn, info] of Object.entries(metadata)) {
        if (info.id === iconId) { foundFile = fn; break }
      }
      if (foundFile) {
        delete metadata[foundFile]
        fs.writeFileSync(META_FILE, JSON.stringify(metadata, null, 2))
        const fp = path.join(ICON_DIR, foundFile)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      }
    } catch (e) { /* skip */ }
  }
  sendJson(res, 200, { success: true })
})

function resolveApiJson(apiPath) {
  const nested = path.join(DIR, "api-static", apiPath + ".json")
  if (fs.existsSync(nested)) return nested
  const flatName = `vdplshop.in_api_${apiPath.replace(/\//g, "_")}.json`
  for (const dir of [path.join(DIR, "api-static"), path.join(DIR, "pages")]) {
    const fp = path.join(dir, flatName)
    if (fs.existsSync(fp)) return fp
  }
  const last = apiPath.split("/").pop()
  const direct = path.join(DIR, "api-static", last + ".json")
  if (fs.existsSync(direct)) return direct
  if (apiPath.toLowerCase().includes("usersettings")) {
    for (const dir of [path.join(DIR, "api-static"), path.join(DIR, "pages")]) {
      if (fs.existsSync(dir)) {
        const match = fs.readdirSync(dir).find(f => f.includes("vdplshop.in_api_userSettings_") && f.endsWith(".json"))
        if (match) return path.join(dir, match)
      }
    }
  }
  return null
}

function findUser(email, password) {
  // Check users.json first
  const users = loadUsers()
  const found = users.find(u => u.email === email && u.password === password)
  if (found) return found
  // Fallback to hardcoded env credentials
  if (email === AUTH_USERNAME && password === AUTH_PASSWORD) {
    return { name: "Admin", email: AUTH_USERNAME, role: "admin" }
  }
  return null
}

function handleAuthPost(req, res, body) {
  const p = req.originalUrl.toLowerCase()
  if (p.includes("/api/auth/precheck")) {
    const email = body.email
    const password = body.password
    const user = findUser(email, password)
    return sendJson(res, 200, { code: user ? "OK" : "INVALID" })
  }
  if (p.includes("/api/auth/signin") || p.includes("/api/auth/callback")) {
    let email = body.email, password = body.password
    const user = findUser(email, password)
    if (user) {
      const host = req.get("Host") || `localhost:${PORT}`
      const proto = req.get("X-Forwarded-Proto") === "https" ? "https" : "http"
      // Determine redirect URL: use callbackUrl from body, default to userDashboard
      let callbackUrl = body.callbackUrl || `${proto}://${host}/`
      // Make sure callbackUrl is absolute
      if (callbackUrl && !callbackUrl.startsWith("http")) {
        callbackUrl = `${proto}://${host}${callbackUrl.startsWith('/') ? '' : '/'}${callbackUrl}`
      }
      res.setHeader("Set-Cookie", [
        `session_token=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
        `next-auth.session-token=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
        `logged_in=yes; Path=/; SameSite=Lax`,
        `auth_email=${user.email}; Path=/; SameSite=Lax`,
        `auth_role=${user.role || "user"}; Path=/; SameSite=Lax`
      ])
      // next-auth client checks d.ok === true to trigger redirect
      return sendJson(res, 200, { ok: true, url: callbackUrl, error: null })
    }
    // Return 200 with ok:false so next-auth client shows error (not a network error)
    return sendJson(res, 200, { ok: false, error: "CredentialsSignin", url: null })
  }
  if (p.includes("/api/auth/signout") || p.includes("/api/auth/logout")) {
    const clear = "; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    res.setHeader("Set-Cookie", [
      `session_token=${clear}`, `next-auth.session-token=${clear}`,
      "logged_in=; Path=/; Max-Age=0; SameSite=Lax"
    ])
    return sendJson(res, 200, { url: "/Login" })
  }
  return false
}

function handleApiBody(req, res, body) {
  const p = req.originalUrl.toLowerCase()
  const method = req.method
  if (p.includes("coupons/validate")) return sendJson(res, 200, { valid: true, discount: 10, message: "Coupon applied" })
  if ((method === "PUT" || method === "PATCH") && p.includes("prices/")) return sendJson(res, 200, { success: true, ...body })
  if ((method === "PUT" || method === "PATCH") && p.includes("admin/orders/")) return sendJson(res, 200, { success: true, status: "updated" })
  if ((method === "PUT" || method === "PATCH") && p.includes("usersettings/")) return sendJson(res, 200, { success: true, ...body })
  if (p.includes("sendpanelemail") || p.includes("sendpanel")) return sendJson(res, 200, { success: true, message: "Email sent" })
  if (p.includes("orders") && method === "POST") {
    const orderId = "ORD-" + crypto.createHash("md5").update(JSON.stringify(body)).digest("hex").slice(0, 8)
    return sendJson(res, 200, { success: true, orderId, message: "Order created" })
  }
  if (p.includes("notifications") && p.includes("/status")) return sendJson(res, 200, { success: true })
  if (p.includes("offers") && (p.includes("/impression") || p.includes("/action"))) return sendJson(res, 200, { success: true })
  if (p.includes("update-company-name")) return sendJson(res, 200, { success: true, companyName: body.companyName || "" })
  if (p.includes("activity/update") || p.includes("/logs")) return sendJson(res, 200, { success: true })
  return sendJson(res, 200, { success: true })
}

function handleAuthGet(req, res) {
  const p = req.originalUrl.toLowerCase()
  if (p.includes("/api/auth/providers")) {
    return sendJson(res, 200, {
      credentials: {
        id: "credentials", name: "Credentials", type: "credentials",
        signinUrl: "/api/auth/signin/credentials",
        callbackUrl: "/api/auth/callback/credentials"
      }
    })
  }
  if (p.includes("/api/auth/csrf")) return sendJson(res, 200, { csrfToken: "smartiqo_secure_csrf_token" })
  if (p.includes("/api/auth/session")) {
    if (isAuthenticated(req)) {
      const authRole = req.cookies.auth_role || "user"
      const authEmail = req.cookies.auth_email || AUTH_USERNAME
      return sendJson(res, 200, {
        user: {
          id: "user1", name: "User", email: authEmail,
          role: authRole, isPremium: false, parentUserId: null
        },
        expires: "2026-12-31T23:59:59.999Z"
      })
    }
    return sendJson(res, 200, {})
  }
  return false
}

app.all("/api/*", (req, res) => {
  const body = req.body || {}
  const method = req.method

  if (method === "POST") {
    const result = handleAuthPost(req, res, body)
    if (result !== false) return
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    handleApiBody(req, res, body)
    return
  }

  if (method === "GET") {
    const result = handleAuthGet(req, res)
    if (result !== false) return
    if (req.path === "/api/icons") {
      let iconsData = []
      const staticPath = path.join(DIR, "api-static", "icons.json")
      if (fs.existsSync(staticPath)) {
        try { iconsData = JSON.parse(fs.readFileSync(staticPath, "utf-8")) } catch (e) { /* skip */ }
      }
      const custom = []
      if (fs.existsSync(META_FILE)) {
        try {
          const meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"))
          for (const [fn, info] of Object.entries(meta)) {
            if (fs.existsSync(path.join(ICON_DIR, fn))) {
              custom.push({
                id: info.id, categoryId: "custom-icons-category",
                categoryLabel: info.category || "Decorative lights",
                name: info.name || "Custom Icon",
                imageUrl: `/icon/dynamic/My_Icons/${fn}`
              })
            }
          }
        } catch (e) { /* skip */ }
      }
      if (custom.length) {
        const byCat = {}
        for (const ic of custom) { (byCat[ic.categoryLabel] ||= []).push(ic) }
        for (const [label, icons] of Object.entries(byCat)) {
          const existing = iconsData.find(c => c.categoryLabel === label)
          if (existing) {
            const ids = new Set((existing.icons || []).map(i => i.id))
            for (const ic of icons) { if (!ids.has(ic.id)) existing.icons.push(ic) }
          } else {
            iconsData.push({
              categoryId: crypto.createHash("md5").update(label).digest("hex"),
              categoryLabel: label, sortOrder: 99, icons
            })
          }
        }
      }
      return sendJson(res, 200, iconsData)
    }
    const jsonFile = resolveApiJson(req.path.replace(/^\/api\//, ""))
    if (jsonFile) {
      const ext = path.extname(jsonFile).toLowerCase()
      if (mimeMap[ext]) res.type(mimeMap[ext])
      return res.sendFile(jsonFile)
    }
    const p = req.originalUrl.toLowerCase()
    if (p.includes("/api/orders")) return sendJson(res, 200, { orders: [], total: 0, page: 1, limit: 10 })
    if (p.includes("/api/logs")) return sendJson(res, 200, { logs: [], total: 0 })
    if (p.includes("/api/auth/precheck")) return sendJson(res, 200, { exists: false })
    if (p.includes("/api/register")) return sendJson(res, 200, { success: true, message: "Registration mock" })
    if (p.includes("/api/sendpanelemail") || p.includes("/api/sendpanel")) return sendJson(res, 200, { success: true, message: "Email sent (mock)" })
    if (p.includes("/api/user/update-company-name")) return sendJson(res, 200, { success: true })
    return sendJson(res, 200, {})
  }
  sendJson(res, 405, { error: "Method not allowed" })
})

app.get("/_next/image", (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) return sendJson(res, 400, { error: "Missing url parameter" })
  const clean = path.join(DIR, decodeURIComponent(targetUrl).replace(/^\//, ""))
  if (fs.existsSync(clean)) {
    const ext = path.extname(clean).toLowerCase()
    if (mimeMap[ext]) res.type(mimeMap[ext])
    return res.sendFile(clean)
  }
  res.status(404).send("Image not found")
})


app.get("/admin", (req, res) => {
  const adminPath = path.join(DIR, "admin.html")
  if (fs.existsSync(adminPath)) return res.sendFile(adminPath)
  res.status(404).send("Admin dashboard not found")
})

app.use((req, res, next) => {
  if (req.method !== "GET") return next()
  const filePath = path.join(DIR, req.path)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return next()
  if (req.path.split("/").pop().includes(".")) return next()
  const routeKey = req.path.replace(/^\//, "").replace(/\//g, "_")
  for (const candidate of [
    path.join(DIR, "pages", `vdplshop.in_${routeKey}.html`),
    path.join(DIR, "pages", `vdplshop.in_${routeKey.toLowerCase()}.html`)
  ]) {
    if (fs.existsSync(candidate)) return serveHtml(res, candidate)
  }
  const indexPath = path.join(DIR, "index.html")
  if (fs.existsSync(indexPath)) return serveHtml(res, indexPath)
  next()
})

app.use(express.static(DIR, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    if (mimeMap[ext]) res.setHeader("Content-Type", mimeMap[ext])
  }
}))

app.use((req, res) => { res.status(404).type("text").send("Not found") })

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] [ERROR]`, err.stack || err.message)
  res.status(500).type("text").send("Internal Server Error")
})

const server = app.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] [INFO] Serving at http://${HOST}:${PORT}`)
  console.log(`[${new Date().toISOString()}] [INFO] Open http://localhost:${PORT}`)
  console.log("[INFO] Press Ctrl+C to stop")
})

const shutdown = () => {
  console.log(`\n[${new Date().toISOString()}] [INFO] Shutting down...`)
  server.close(() => process.exit(0))
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

