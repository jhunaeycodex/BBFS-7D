#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-/var/www/bbfs-7d}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Jalankan sebagai root atau pakai sudo."
  echo "Contoh: sudo bash /var/www/bbfs-7d/deploy/update-vps.sh"
  exit 1
fi

if [ ! -d "${SITE_DIR}/.git" ]; then
  echo "ERROR: ${SITE_DIR} bukan folder git repo."
  exit 1
fi

echo "==> Update website dari GitHub"
git -C "${SITE_DIR}" fetch --all
git -C "${SITE_DIR}" reset --hard origin/main

chown -R www-data:www-data "${SITE_DIR}"
find "${SITE_DIR}" -type d -exec chmod 755 {} \;
find "${SITE_DIR}" -type f -exec chmod 644 {} \;

nginx -t
systemctl reload nginx

echo "SELESAI: website sudah update dari GitHub."
