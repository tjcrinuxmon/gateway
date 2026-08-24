const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const PORT = process.env.GATEWAY_PORT || 3000
const isProd = process.env.NODE_ENV !== 'development'

// Pre-create proxy instances
const mkProxy = (target, opts = {}) =>
  createProxyMiddleware({ target, changeOrigin: true, ...opts })

// Targets configurables por env (defaults = puertos de prod). Permite levantar un
// staging en el mismo servidor con otros puertos (p.ej. TARGET_PORTAL=http://localhost:3104).
const pPortal   = mkProxy(process.env.TARGET_PORTAL       || 'http://localhost:3004')
const pTareas2  = mkProxy(process.env.TARGET_TAREAS2      || 'http://localhost:3005')
const pDil      = mkProxy(process.env.TARGET_DIL          || 'http://localhost:3002')
const pOf       = mkProxy(process.env.TARGET_OFICIOS      || 'http://localhost:3003')
const pRelev    = mkProxy(process.env.TARGET_RELEVANTES   || 'http://localhost:3007')
const pPortalV  = mkProxy(process.env.TARGET_PORTAL_VITE  || 'http://localhost:5174', { ws: true })
const pTareas2V = mkProxy(process.env.TARGET_TAREAS2_VITE || 'http://localhost:5175', { ws: true })

// Rutas de API únicas de oficios (no necesitan prefijo /of)
const OF_PATHS = ['/api/oficios', '/api/firmantes', '/api/anios', '/api/exportar']

// Usar UN SOLO middleware raíz para que Express NO quite el prefijo del path
app.use((req, res, next) => {
  const url = req.url

  /* ── API: Tareas2 (/api/t2/*) → :3005, rewrite /api/t2 → /api ─────── */
  if (url.startsWith('/api/t2/') || url === '/api/t2') {
    req.url = '/api' + url.slice('/api/t2'.length)
    return pTareas2(req, res, next)
  }

  /* ── Uploads: Tareas2 (/uploads/t2/*) → :3005 ──────────────────────── */
  if (url.startsWith('/uploads/t2/')) {
    req.url = '/uploads' + url.slice('/uploads/t2'.length)
    return pTareas2(req, res, next)
  }

  /* ── API: Diligencias (/api/dil/*) → :3002, rewrite /api/dil → /api ── */
  if (url.startsWith('/api/dil/') || url === '/api/dil') {
    req.url = '/api' + url.slice('/api/dil'.length)
    return pDil(req, res, next)
  }

  /* ── API: Oficios (/api/of/*) → :3003, rewrite /api/of → /api ────── */
  if (url.startsWith('/api/of/') || url === '/api/of') {
    req.url = '/api' + url.slice('/api/of'.length)
    return pOf(req, res, next)
  }

  /* ── API: Relevantes (/api/rel/*) → :3006, rewrite /api/rel → /api ── */
  if (url.startsWith('/api/rel/') || url === '/api/rel') {
    req.url = '/api' + url.slice('/api/rel'.length)
    return pRelev(req, res, next)
  }

  /* ── Uploads: Relevantes (/uploads/rel/*) → :3006 ──────────────────── */
  if (url.startsWith('/uploads/rel/')) {
    req.url = '/uploads' + url.slice('/uploads/rel'.length)
    return pRelev(req, res, next)
  }

  /* ── API: Oficios rutas únicas (no tienen conflicto) ──────────────── */
  if (OF_PATHS.some(p => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'))) {
    return pOf(req, res, next)
  }

  /* ── API: Diligencias ruta única (/api/diligencias) ──────────────── */
  if (url === '/api/diligencias' || url.startsWith('/api/diligencias/') || url.startsWith('/api/diligencias?')) {
    return pDil(req, res, next)
  }

  /* ── API: Portal (auth, sso, usuarios — todo lo demás bajo /api) ──── */
  if (url.startsWith('/api/') || url === '/api') {
    return pPortal(req, res, next)
  }

  /* ── Frontend: Diligencias /diligencias/* → :3002 (sin el prefijo) ── */
  if (url === '/diligencias' || url.startsWith('/diligencias/') || url.startsWith('/diligencias?')) {
    const rest = url.slice('/diligencias'.length)
    req.url = rest.startsWith('/') ? rest : ('/' + rest)
    return pDil(req, res, next)
  }

  /* ── Frontend: Oficios /oficios/* → :3003 (sin el prefijo) ────────── */
  if (url === '/oficios' || url.startsWith('/oficios/') || url.startsWith('/oficios?')) {
    const rest = url.slice('/oficios'.length)
    req.url = rest.startsWith('/') ? rest : ('/' + rest)
    return pOf(req, res, next)
  }

  /* ── Frontend: Relevantes /relevantes/* → :3006 (sin el prefijo) ──── */
  if (url === '/relevantes' || url.startsWith('/relevantes/') || url.startsWith('/relevantes?')) {
    const rest = url.slice('/relevantes'.length)
    req.url = rest.startsWith('/') ? rest : ('/' + rest)
    return pRelev(req, res, next)
  }

  /* ── Frontend: Tareas2 /tareas2/* ───────────────────────────────────── */
  if (url === '/tareas2' || url.startsWith('/tareas2/') || url.startsWith('/tareas2?')) {
    return (isProd ? pTareas2 : pTareas2V)(req, res, next)
  }

  /* ── Frontend: Portal (catch-all) ───────────────────────────────────── */
  return (isProd ? pPortal : pPortalV)(req, res, next)
})

const server = app.listen(PORT, '0.0.0.0', () =>
  console.log(`\n  INE DEAJ Gateway → http://localhost:${PORT}\n`)
)

// Redirigir WebSocket upgrades al Vite correcto
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/tareas2')) {
    pTareas2V.upgrade(req, socket, head)
  } else {
    pPortalV.upgrade(req, socket, head)
  }
})
