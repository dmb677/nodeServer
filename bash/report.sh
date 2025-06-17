#!/bin/bash
iplist=$(cat bash/ips/log.txt)
dirs=$(ls bash/ips)
for word in $dirs
do 
    if [[ $word != "log.txt" ]]
    then
        echo "<h1>IP Address:"$word"</h1><p>" 
        while IFS= read -r line
        do
            echo "$line"
            echo "<p>"
        done < bash/ips/$word
        echo "<p>"
        echo "count:  "
        echo "$iplist" | grep -c $word
        echo "<p>"
    fi
done

cat httpdocs/app.txt | grep -B 6 "URL" | grep "rq" 
