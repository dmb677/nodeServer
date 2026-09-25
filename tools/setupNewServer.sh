#!/usr/bin/env bash
set -euo pipefail

# Run as root on a fresh Debian/Ubuntu server. Ensure each prompted domain's
# DNS points to this server before continuing to the certificate setup.
repo_dir=/home/nodeServer.git
repo_ssh_url=git@github.com:dmb677/nodeServer.git
first_port=8080

if [[ $EUID -ne 0 ]]; then
    echo "Run this script as root: sudo bash tools/setupNewServer.sh" >&2
    exit 1
fi

if [[ -e "$repo_dir" ]]; then
    echo "$repo_dir already exists; refusing to overwrite it." >&2
    exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git gnupg nginx net-tools sudo \
    certbot python3-certbot-nginx openssh-server

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
chmod a+r /etc/apt/keyrings/nodesource.gpg
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' \
    "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs

ssh_key=/root/.ssh/id_ed25519
if [[ ! -f "$ssh_key" ]]; then
    install -d -m 0700 /root/.ssh
    ssh-keygen -t ed25519 -C "nodeServer deployment $(hostname)" -f "$ssh_key" -N ""
fi

echo "Add this public key to an account with access to dmb677/nodeServer:"
cat "${ssh_key}.pub"
read -r -p "Press Enter after adding the key to GitHub and confirming this server can access the repository..."

git clone "$repo_ssh_url" "$repo_dir"
npm ci --prefix "$repo_dir"

mapfile -d '' site_dirs < <(
    find "$repo_dir/sites" -mindepth 1 -maxdepth 1 -type d \
        ! -name any -print0 | sort -z
)

if [[ ${#site_dirs[@]} -eq 0 ]]; then
    echo "No site directories found under $repo_dir/sites." >&2
    exit 1
fi

domains=()
ports=()
for index in "${!site_dirs[@]}"; do
    site_name="$(basename "${site_dirs[$index]}")"
    port=$((first_port + index))

    if (( port > 65535 )); then
        echo "Too many sites for the port range starting at $first_port." >&2
        exit 1
    fi

    while :; do
        assigned=false
        for used_port in "${ports[@]}"; do
            if (( used_port == port )); then
                assigned=true
                break
            fi
        done

        if [[ "$assigned" == false ]] && ! ss -H -ltn "sport = :$port" | grep -q .; then
            break
        fi

        port=$((port + 1))
        if (( port > 65535 )); then
            echo "No available port found for $site_name." >&2
            exit 1
        fi
    done

    printf -v prompt 'Domain for %s (will also request www.%s): ' "$site_name" "$site_name"
    read -r -p "$prompt" domain
    if [[ ! "$domain" =~ ^[A-Za-z0-9.-]+$ ]]; then
        echo "Invalid domain: $domain" >&2
        exit 1
    fi

    domains+=("$domain")
    ports+=("$port")
    printf '%s -> %s on port %s\n' "$site_name" "$domain" "$port"
done

read -r -p "Continue with site setup and HTTPS certificates? [y/N] " confirmation
if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
    echo "Setup cancelled. The repository and dependencies have already been installed."
    exit 1
fi

for index in "${!site_dirs[@]}"; do
    site_name="$(basename "${site_dirs[$index]}")"
    "$repo_dir/tools/siteSetup.sh" "$site_name" "${ports[$index]}" "${domains[$index]}"
done

npm test --prefix "$repo_dir"
echo "Server setup complete."
