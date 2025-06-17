#!/bin/bash
touch bash/ips/$1
count=$(cat bash/ips/log.txt | grep -c $1)
echo "$count"
echo $1 >> bash/ips/log.txt
if [ $count == 0 ]
then
    tmp1=$(whois $1)
    # change from whois to http://ip-api.com/json/{ip address}
    echo "$tmp1" | grep -m 1 City | cut -d ":" -f 2 | awk '{$1=$1;print}'
    echo "$tmp1" | grep -m 1 OrgName | cut -d ":" -f 2 | awk '{$1=$1;print}'
    echo "$tmp1" | grep -m 1 City | cut -d ":" -f 2 | awk '{$1=$1;print}' >> bash/ips/$1
    echo "$tmp1" | grep -m 1 OrgName | cut -d ":" -f 2 | awk '{$1=$1;print}' >> bash/ips/$1
else
    cat bash/ips/$1
fi




