#!/bin/bash

#Install NVM
#curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion


nodeV=$(npm pkg get engines.node)
nodeV=$(echo $nodeV | tr -d '\"')
nvm list-remote > /dev/null 2>&1
nvm ls
nvm install $nodeV
nvm use $nodeV
nvm alias default $nodeV

#Remove links to node
sudo rm -f /usr/bin/node
sudo rm -f /usr/bin/npm

#create links to nvm current version
sudo ln -s $(nvm which current) /usr/bin/node
sudo ln -s $(dirname $(nvm which current))/npm /usr/bin/npm

nvm ls
node -v

echo "You may need to reload bash"
#list services
#ls /etc/systemd/system
#journalctl -u <service> -f