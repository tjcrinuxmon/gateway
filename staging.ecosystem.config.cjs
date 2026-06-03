// PM2 ecosystem para el entorno de STAGING (pruebas) en el mismo servidor de prod.
// Levanta gateway + portal + oficios en puertos +100, aislados de prod.
//
// Ajusta STAGING_ROOT si tu ruta es distinta.  Uso:  pm2 start staging.ecosystem.config.cjs
//
// Aislamiento:
//   - Carpeta:   /home/usuario/staging/{gateway,portal,oficio-generator}
//   - Puertos:   gateway 3100, oficios 3103, portal 3104  (prod usa 3000/3003/3004)
//   - Procesos:  *-staging
//   - BD:        relativas a cada carpeta → propias de staging (no tocan prod)
//   - portal/oficios leen su propio .env (puertos + secretos); el gateway recibe
//     su config por el bloque env de aquí (no lee .env).

const STAGING_ROOT = '/home/usuario/staging'

module.exports = {
  apps: [
    {
      name: 'gateway-staging',
      cwd: `${STAGING_ROOT}/gateway`,
      script: 'server.js',
      env: {
        NODE_ENV: 'production',          // sirve el portal compilado (dist), no vite
        GATEWAY_PORT: '3100',
        TARGET_PORTAL:  'http://localhost:3104',
        TARGET_OFICIOS: 'http://localhost:3103',
        // Tareas2/Diligencias NO están en staging: apuntan a puertos no usados
        // (fallan seguro) para no filtrar tráfico a prod.
        TARGET_TAREAS2: 'http://localhost:3105',
        TARGET_DIL:     'http://localhost:3102',
      },
    },
    {
      name: 'portal-staging',
      cwd: `${STAGING_ROOT}/portal`,
      script: 'server.js',
      // Lee staging/portal/.env (PORT=3104 + secretos + ADMIN_SEED_PASSWORD)
    },
    {
      name: 'oficios-staging',
      cwd: `${STAGING_ROOT}/oficio-generator`,
      script: 'server.js',
      // Lee staging/oficio-generator/.env (PORT=3103 + secretos)
    },
  ],
}
