#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-jhunaey.my.id}"
SITE_DIR="${2:-/var/www/bbfs-7d}"
EMAIL="${3:-admin@jhunaey.my.id}"
BASE_INSTALL_URL="https://raw.githubusercontent.com/jhunaeycodex/BBFS-7D/main/deploy/install-vps-nginx.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Jalankan sebagai root atau pakai sudo."
  echo "Contoh: sudo bash /tmp/install-domain-ssl.sh jhunaey.my.id /var/www/bbfs-7d admin@jhunaey.my.id"
  exit 1
fi

if [ -z "${DOMAIN}" ] || [ "${DOMAIN}" = "_" ]; then
  echo "ERROR: Domain wajib diisi untuk mode SSL."
  exit 1
fi

echo "==> Install website Nginx untuk domain: ${DOMAIN}"
curl -fsSL "${BASE_INSTALL_URL}" -o /tmp/install-bbfs-nginx.sh
bash /tmp/install-bbfs-nginx.sh "${DOMAIN}" "${SITE_DIR}"

echo "==> Install Certbot"
apt update
apt install -y certbot python3-certbot-nginx

echo "==> Request SSL Let's Encrypt"
certbot --nginx \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  --redirect

echo "==> Test auto-renew"
certbot renew --dry-run

nginx -t
systemctl reload nginx

echo ""
echo "SELESAI"
echo "Website HTTPS: https://${DOMAIN}"
echo "Folder       : ${SITE_DIR}"
echo "Update nanti : sudo bash ${SITE_DIR}/deploy/update-vps.sh"
