### install GitHub cli and grab bashrc file
sudo apt install gh
gh auth login ## follow prompts
gh gist clone 1232976272984d632beba997dc44ed09 my-gist
cp my-gist/gistfile0.txt ~/.bashrc
bash
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --all"

## software to install
lsb_release -a
sudo apt update
sudo apt install nodejs npm -y
sudo apt install nginx -y
sudo apt install net-tools -y
sudo apt install certbot python3-certbot-nginx -y

#setup ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo uft allow ssh
sudo ufw enable


## Clone repository
git clone git@github.com:dmb677/nodeServer.git /home/server
npm install --prefix /home/server


servername="DieWhenYouDie2025" #enter app server names

## create .env
cp /home/server/tools/example.env /home/server/sites/$servername/.env
vim /home/server/sites/$servername/.env

## create service file
cp /home/server/tools/node.service /etc/systemd/system/$servername.service
vim /etc/systemd/system/$servername.service
systemctl daemon-reload
systemctl start $servername.service

##You can now test that the site is running if you disable ufw and url:port

siteURL="diewhenyoudie.org" #enter new URLs
siteURL2="www.diewhenyoudie.org" #enter new URLs

##setup nginx site
cp /home/server/tools/nginx.conf /etc/nginx/nginx.conf
cp /home/server/tools/nginx-site.conf /etc/nginx/sites-available/$siteURL
sudo ln -s /etc/nginx/sites-available/$siteURL /etc/nginx/sites-enabled/
vim /etc/nginx/sites-available/$siteURL
sudo systemctl reload nginx
sudo systemctl restart nginx

##set up certbot
##Before this step confirm DNS is updated
sudo certbot --nginx -d $siteURL -d $siteURL2