#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-_}"
SITE_DIR="${2:-/var/www/bbfs-7d}"
REPO_URL="https://github.com/jhunaeycodex/BBFS-7D.git"
NGINX_CONF="/etc/nginx/sites-available/bbfs-7d.conf"
NGINX_LINK="/etc/nginx/sites-enabled/bbfs-7d.conf"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Jalankan sebagai root atau pakai sudo."
  echo "Contoh: sudo bash deploy/install-vps-nginx.sh domain.com"
  exit 1
fi

echo "==> Install dependency"
apt update
apt install -y nginx git ca-certificates

echo "==> Siapkan folder website: ${SITE_DIR}"
mkdir -p "${SITE_DIR}"

git config --global --add safe.directory "${SITE_DIR}" || true

if [ -d "${SITE_DIR}/.git" ]; then
  echo "==> Update repo existing"
  git -C "${SITE_DIR}" config --global --add safe.directory "${SITE_DIR}" || true
  git -C "${SITE_DIR}" fetch --all
  git -C "${SITE_DIR}" reset --hard origin/main
else
  echo "==> Clone repo"
  rm -rf "${SITE_DIR:?}"/*
  git clone "${REPO_URL}" "${SITE_DIR}"
fi

chown -R www-data:www-data "${SITE_DIR}"
find "${SITE_DIR}" -type d -exec chmod 755 {} \;
find "${SITE_DIR}" -type f -exec chmod 644 {} \;

git config --global --add safe.directory "${SITE_DIR}" || true

if [ "${DOMAIN}" = "_" ]; then
  SERVER_NAME="_"
else
  SERVER_NAME="${DOMAIN} www.${DOMAIN}"
fi

echo "==> Buat konfigurasi Nginx untuk server_name: ${SERVER_NAME}"
cat > "${NGINX_CONF}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};

    root ${SITE_DIR};
    index index.html;

    access_log /var/log/nginx/bbfs-7d.access.log;
    error_log /var/log/nginx/bbfs-7d.error.log;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|json|png|jpg|jpeg|gif|svg|webp|ico)$ {
        try_files \$uri =404;
        expires 1h;
        add_header Cache-Control "public";
    }

    location ~ /\. {
        deny all;
    }

    location ~* /(server|logs)/ {
        deny all;
        return 403;
    }
}
NGINX

ln -sfn "${NGINX_CONF}" "${NGINX_LINK}"

if [ -L /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi

echo "==> Test dan reload Nginx"
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "SELESAI"
echo "Folder website : ${SITE_DIR}"
echo "Repo           : ${REPO_URL}"
echo "Domain         : ${DOMAIN}"
echo "Cek via browser: http://${DOMAIN}"
echo ""
echo "Untuk update dari GitHub nanti jalankan:"
echo "sudo bash ${SITE_DIR}/deploy/update-vps.sh"
