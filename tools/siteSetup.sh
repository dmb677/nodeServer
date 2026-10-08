#!/usr/bin/env bash
set -euo pipefail

# Example: siteSetup.sh "wesleyBates" "8080" "wesleybates-graduates.com"

if [[ $# -ne 3 ]]; then
    echo "Usage: $0 <site-name> <port> <domain>" >&2
    exit 2
fi

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
site_name="$1"
port="$2"
domain="$3"
site_dir="$repo_dir/sites/$site_name"

if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    echo "Invalid port: $port" >&2
    exit 2
fi

if [[ ! "$domain" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "Invalid domain: $domain" >&2
    exit 2
fi

## create .env and populate all template placeholders
mkdir -p "$site_dir"
sed \
    -e "s|varport|$port|g" \
    -e "s|varservername|$site_name|g" \
    "$repo_dir/tools/example.env" > "$site_dir/.env"
cat "$site_dir/.env"

# put admin in userfile
mkdir -p "/home/$site_name"
cp "$repo_dir/tools/userDB.json" "/home/$site_name/userDB.json"

service_file="/etc/systemd/system/$site_name.service"
cp "$repo_dir/tools/node.service" "$service_file"
sed -i "s/varservername/$site_name/g" "$service_file"
cat "$service_file"
systemctl daemon-reload
systemctl enable "$site_name.service"
systemctl start "$site_name.service"

## configure nginx to route the prompted domain to this site's port
cp "$repo_dir/tools/nginx.conf" /etc/nginx/nginx.conf
nginx_site="/etc/nginx/sites-available/$domain"
cp "$repo_dir/tools/nginx-site.conf" "$nginx_site"
sed -i \
    -e "s|varport|$port|g" \
    -e "s|varURL1|$domain|g" \
    "$nginx_site"
ln -s "$nginx_site" "/etc/nginx/sites-enabled/$domain"
cat "$nginx_site"

## request a certificate for the prompted domain and its www hostname
certbot --nginx -d "$domain" -d "www.$domain"

nginx -t
systemctl reload nginx
systemctl restart nginx
