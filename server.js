const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const PORT = process.env.GATEWAY_PORT || 3000
const isProd = process.env.NODE_ENV === 'production'

// Pre-create proxy instances
const mkProxy = (target, opts = {}) =>
  createProxyMiddleware({ target, changeOrigin: true, ...opts })

const pPortal  = mkProxy('http://localhost:3004')
const pTareas  = mkProxy('http://localhost:3001')
const pDil     = mkProxy('http://localhost:3002')
const pOf      = mkProxy('http://localhost:3003')
const pTareasV = mkProxy('http://localhost:5173', { ws: true })
const pPortalV = mkProxy('http://localhost:5174', { ws: true })

// Rutas de API únicas de tareas
const TAREAS_PATHS = [
  '/api/tasks', '/api/notifications', '/api/report',
  '/api/admin', '/api/inhabil-days', '/api/users', '/uploads',
  '/api/convenios', '/api/enlace', '/api/daily-reports', '/api/dal',
]

// Rutas de API únicas de oficios (no necesitan prefijo /of)
const OF_PATHS = ['/api/oficios', '/api/firmantes', '/api/anios', '/api/exportar']

// Usar UN SOLO middleware raíz para que Express NO quite el prefijo del path
app.use((req, res, next) => {
  const url = req.url

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

  /* ── API: Oficios rutas únicas (no tienen conflicto) ──────────────── */
  if (OF_PATHS.some(p => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'))) {
    return pOf(req, res, next)
  }

  /* ── API: Diligencias ruta única (/api/diligencias) ──────────────── */
  if (url === '/api/diligencias' || url.startsWith('/api/diligencias/') || url.startsWith('/api/diligencias?')) {
    return pDil(req, res, next)
  }

  /* ── API: Tareas rutas únicas ─────────────────────────────────────── */
  if (TAREAS_PATHS.some(p => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'))) {
    return pTareas(req, res, next)
  }

  /* ── API: POST /api/auth/sso → tareas (único: solo tareas tiene POST) */
  if (url.startsWith('/api/auth/sso') && req.method === 'POST') {
    return pTareas(req, res, next)
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

  /* ── Frontend: Tareas /tareas/* ─────────────────────────────────────── */
  if (url === '/tareas' || url.startsWith('/tareas/') || url.startsWith('/tareas?')) {
    return (isProd ? pTareas : pTareasV)(req, res, next)
  }

  /* ── Frontend: Portal (catch-all) ───────────────────────────────────── */
  return (isProd ? pPortal : pPortalV)(req, res, next)
})

const server = app.listen(PORT, () =>
  console.log(`\n  INE DEAJ Gateway → http://localhost:${PORT}\n`)
)

// Redirigir WebSocket upgrades al Vite correcto
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/tareas')) {
    pTareasV.upgrade(req, socket, head)
  } else {
    pPortalV.upgrade(req, socket, head)
  }
})
