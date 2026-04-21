## First steps Clone repository
[ ! -f ~/.ssh/id_ed25519 ] && ssh-keygen -t ed25519 -C "danny.m.bates@gmail.com" -f ~/.ssh/id_ed25519 -N "" || echo "Key already exists! Skipping."
cat ~/.ssh/id_ed25519.pub
git clone git@github.com:dmb677/nodeServer.git /home/server
## copy to git hub

### install GitHub cli and grab bashrc file
sudo apt install gh
gh auth login ## follow prompts
gh gist clone 1232976272984d632beba997dc44ed09 my-gist
cp my-gist/gistfile0.txt ~/.bashrc
bash
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --all"