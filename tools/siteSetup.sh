
#!/bin/bash

#example usage: siteSetup.sh "wesleyBates" "8080" "wesleybates-graduates.com"

    ## create .env
    cp /home/nodeServer.git/tools/example.env /home/nodeServer.git/sites/$1/.env
    sed -i "s/varport/$2/g" /home/nodeServer.git/sites/$1/.env
    sed -i "s/varservername/$1/g" /home/nodeServer.git/sites/$1/.env
    cat /home/nodeServer.git/sites/$1/.env

    # put admin in userfile
    mkdir /home/$1
    cp /home/nodeServer.git/tools/userDB.json /home/$1/userDB.json
