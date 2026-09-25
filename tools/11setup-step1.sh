#!/bin/bash

lsb_release -a
sudo apt update
sudo apt upgrade -y
sudo apt install nodejs npm -y
sudo apt install npm -y
sudo apt install nginx -y
sudo apt install net-tools -y
sudo apt install certbot python3-certbot-nginx -y
sudo apt install openssh-server -y


[ ! -f ~/.ssh/id_ed25519 ] && ssh-keygen -t ed25519 -C "danny.m.bates@gmail.com" -f ~/.ssh/id_ed25519 -N "" || echo "Key already exists! Skipping."
cat ~/.ssh/id_ed25519.pub
read -n 1 -s -r -p "Add the public key to your GitHub account, then press any key to continue..."
git clone git@github.com:dmb677/nodeServer.git /home/nodeServer.git


npm install --prefix /home/nodeServer.git

/home/nodeServer.git/tools/siteSetup.sh "DieWhenYouDie2026" "8080" "DieWhenYouDie.org"
/home/nodeServer.git/tools/siteSetup.sh "DieWhenYouDie2025" "8081" "2025.DieWhenYouDie.org"
/home/nodeServer.git/tools/siteSetup.sh "DieWhenYouDie" "8082" "2024.DieWhenYouDie.org"




npm run test --prefix /home/nodeServer.git

