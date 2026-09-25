#!/usr/bin/env bash
set -euo pipefail

#example usage: siteSetup.sh "wesleyBates" "8080" "wesleybates-graduates.com"

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <site-name> <port> [domain]" >&2
    exit 2
fi

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
site_name="$1"
port="$2"
site_dir="$repo_dir/sites/$site_name"

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


cp /home/nodeServer.git/tools/node.service /etc/systemd/system/$1.service
sed -i "s/varservername/$1/g" /etc/systemd/system/$1.service
cat /etc/systemd/system/$1.service
systemctl daemon-reload
systemctl enable $1.service
systemctl start $1.service

##setup nginx site
cp /home/nodeServer.git/tools/nginx.conf /etc/nginx/nginx.conf
cp /home/nodeServer.git/tools/nginx-site.conf /etc/nginx/sites-available/$3
sudo ln -s /etc/nginx/sites-available/$3 /etc/nginx/sites-enabled/
sed -i "s/varport/$2/g" /etc/nginx/sites-available/$3
sed -i "s/varURL1/$3/g" /etc/nginx/sites-available/$3
#sed -i "s/varURL2/$siteURL2/g" /etc/nginx/sites-available/$siteURL
cat /etc/nginx/sites-available/$3

##set up certbot
##Before this step confirm DNS is updated
sudo certbot --nginx -d $3 -d www.$3


sudo systemctl reload nginx
sudo systemctl restart nginx
sudo nginx -t #check ngnix