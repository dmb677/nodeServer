

## software to install
lsb_release -a
sudo apt update
sudo apt upgrade
sudo apt install nodejs npm -y
sudo apt install nginx -y
sudo apt install net-tools -y
sudo apt install certbot python3-certbot-nginx -y

#setup ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
npm install --prefix /home/server


website-setup() {

    ## create .env
    cp /home/server/tools/example.env /home/server/sites/$1/.env
    sed -i "s/varport/$2/g" /home/server/sites/$1/.env
    sed -i "s/varservername/$1/g" /home/server/sites/$1/.env
    cat /home/server/sites/$1/.env

    # put admin in userfile
    mkdir /home/$1
    cp /home/server/tools/userDB.json /home/$1/userDB.json

    ## create service file
    cp /home/server/tools/node.service /etc/systemd/system/$1.service
    sed -i "s/varservername/$1/g" /etc/systemd/system/$1.service
    cat /etc/systemd/system/$1.service
    systemctl daemon-reload
    systemctl enable $1.service
    systemctl start $1.service

    ##You can now test that the site is running if you disable ufw and url:port

    ##setup nginx site
    cp /home/server/tools/nginx.conf /etc/nginx/nginx.conf
    cp /home/server/tools/nginx-site.conf /etc/nginx/sites-available/$3
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

}



##Variables
#servername="wesleyBates" #enter app server names
#port="8080"
#siteURL="wesleybates-graduates.com" #enter new URLs
#siteURL2="www.wesleybates-graduates.com" #enter new URLs

website-setup "wesleyBates" "8080" "wesleybates-graduates.com"