# Staging (entorno de pruebas) — Gateway + Portal + Oficios

Levanta un staging **en el mismo servidor de prod**, aislado, para que tus
compañeros prueben los cambios **sin tocar producción**.

| | Prod | Staging |
|---|---|---|
| Carpeta | `/home/usuario/{gateway,portal,oficio-generator}` | `/home/usuario/staging/...` |
| Gateway | 3000 | **3100** |
| Oficios | 3003 | **3103** |
| Portal  | 3004 | **3104** |
| Procesos PM2 | `gateway`, `portal`, `oficios` | `*-staging` |
| Bases de datos | reales | **vacías** (se crean solas, en la carpeta de staging) |
| Rama | tags estables | **desarrollo** (`v2-desarrollo` / `master`) |

> Las BD son relativas a cada carpeta, así que al estar en `staging/` son
> automáticamente independientes de prod. El portal siembra un admin al arrancar
> con BD vacía.

## 1) Clonar las apps (ramas de desarrollo)

```bash
mkdir -p /home/usuario/staging && cd /home/usuario/staging

git clone https://github.com/tjcrinuxmon/gateway.git
git clone https://github.com/tjcrinuxmon/portal.git
git clone https://github.com/tjcrinuxmon/oficio-generator.git

# Ramas de desarrollo (lo nuevo a probar):
( cd gateway          && git checkout master )
( cd portal           && git checkout master )
( cd oficio-generator && git checkout v2-desarrollo )
```

## 2) Configurar el `.env` de cada app (copiar de prod y cambiar el puerto)

La forma más simple y segura: copia el `.env` de prod (así los secretos coinciden
y el SSO funciona) y solo cambia el `PORT`.

```bash
# Portal
cp /home/usuario/portal/.env /home/usuario/staging/portal/.env
#   edita: PORT=3104   y agrega:  ADMIN_SEED_PASSWORD=Staging1234!

# Oficios
cp /home/usuario/oficio-generator/.env /home/usuario/staging/oficio-generator/.env
#   edita: PORT=3103
```

> El **gateway no usa `.env`**: su configuración (puertos +100) ya está en
> `staging.ecosystem.config.cjs`.

## 3) Instalar dependencias y COMPILAR el portal

```bash
( cd /home/usuario/staging/gateway          && npm ci )
( cd /home/usuario/staging/oficio-generator && npm ci )
( cd /home/usuario/staging/portal           && npm ci && npm run build )   # ← el portal es compilado
```

## 4) Arrancar con PM2

```bash
pm2 start /home/usuario/staging/gateway/staging.ecosystem.config.cjs
pm2 save
pm2 logs gateway-staging portal-staging oficios-staging --lines 20
```

En los logs del portal verás: `👤 Admin portal creado: admin@ine.mx / Staging1234!`
(o la contraseña que pusiste en `ADMIN_SEED_PASSWORD`).

## 5) Abrir el puerto del gateway de staging en el firewall del server (Linux)

```bash
sudo ufw allow 3100/tcp        # si usas ufw
# o iptables, según tu distro
```

## 6) Acceder

Tus compañeros entran a:

```
http://<IP-del-servidor>:3100/
```

Login: `admin@ine.mx` / `Staging1234!`. Como las redirecciones del portal son
**relativas**, al dar *Acceder* a **Gestión Documental** se quedan en
`<IP>:3100/oficios`.

---

## Actualizar el staging cuando haya cambios nuevos

```bash
cd /home/usuario/staging/oficio-generator && git pull origin v2-desarrollo
cd /home/usuario/staging/portal && git pull origin master && npm run build
cd /home/usuario/staging/gateway && git pull origin master
pm2 restart gateway-staging portal-staging oficios-staging --update-env
```

## Empezar de cero (BD limpias)

```bash
pm2 stop portal-staging oficios-staging
rm -f /home/usuario/staging/portal/*.sqlite* /home/usuario/staging/portal/*.db
rm -f /home/usuario/staging/oficio-generator/*.sqlite*
pm2 restart portal-staging oficios-staging
```

## Notas

- **Tareas y Diligencias** no están en staging: si un usuario les da clic, el
  módulo no cargará (es esperado; sus targets apuntan a puertos no usados para
  no filtrar tráfico a prod).
- Staging **reutiliza los secretos de prod** (al copiar el `.env`). Eso mantiene
  el SSO funcionando. Si prefieres secretos distintos, recuerda que el
  `OFICIOS_SECRET` del portal debe ser igual al `PORTAL_SSO_SECRET` de oficios.
- Prod no se toca en ningún momento: otras carpetas, otros puertos, otras BD,
  otros procesos PM2.
