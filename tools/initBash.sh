##Get desktop
sudo apt update && sudo apt upgrade -y
# requires reboot

adduser dbates
sudo usermod -aG sudo dbates

#install chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f

#install Tor
sudo apt install flatpak -y
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install flathub org.torproject.torbrowser-launcher -y
flatpak run org.torproject.torbrowser-launcher


## software to install
lsb_release -a
sudo apt update
sudo apt upgrade
sudo apt install nodejs npm -y
sudo apt install nginx -y
sudo apt install net-tools -y
sudo apt install certbot python3-certbot-nginx -y
sudo apt install openssh-server -y

## create websocket
sudo apt install -y novnc python3-websockify python3-numpy

sudo bash -c "cat <<EOF > /etc/systemd/system/websockify.service
[Unit]
Description=noVNC Websockify Proxy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/websockify --web /usr/share/novnc/ 6080 localhost:5900
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable websockify
sudo systemctl start websockify

sudo ufw allow 6080/tcp


su dbates

###--- When logged in as dbates ---###
gsettings set org.gnome.shell favorite-apps "[]"
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'





## First steps Clone repository
[ ! -f ~/.ssh/id_ed25519 ] && ssh-keygen -t ed25519 -C "danny.m.bates@gmail.com" -f ~/.ssh/id_ed25519 -N "" || echo "Key already exists! Skipping."
cat ~/.ssh/id_ed25519.pub
## add to github account and then clone repo

git clone git@github.com:dmb677/nodeServer.git ~/nodeServer.git
## copy to git hub

### install GitHub cli and grab bashrc file
sudo apt install gh
gh auth login ## follow prompts
gh gist clone 1232976272984d632beba997dc44ed09 my-gist
cp my-gist/gistfile0.txt ~/.bashrc
bash
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --all"




#setup ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
npm install --prefix ~/nodeServer.git ## not done locally
sudo cp -r ~/nodeServer.git /home/server 