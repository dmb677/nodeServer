
#!/bin/bash

#example usage: launchDroplet.sh "wesleyBates" "8080" "wesleybates-graduates.com"

    ## create .env
    cp /home/nodeServer.git/tools/example.env /home/nodeServer.git/sites/$1/.env
    sed -i "s/varport/$2/g" /home/nodeServer.git/sites/$1/.env
    sed -i "s/varservername/$1/g" /home/nodeServer.git/sites/$1/.env
    cat /home/nodeServer.git/sites/$1/.env

    # put admin in userfile
    mkdir /home/$1
    cp /home/nodeServer.git/tools/userDB.json /home/$1/userDB.json

    ## create service file
    cp /home/nodeServer.git/tools/node.service /etc/systemd/system/$1.service
    sed -i "s/varservername/$1/g" /etc/systemd/system/$1.service
    cat /etc/systemd/system/$1.service
    systemctl daemon-reload
    systemctl enable $1.service
    systemctl start $1.service

    ##You can now test that the site is running if you disable ufw and url:port

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





##Variables
#servername="wesleyBates" #enter app server names
#port="8080"
#siteURL="wesleybates-graduates.com" #enter new URLs
#siteURL2="www.wesleybates-graduates.com" #enter new URLs

