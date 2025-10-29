module.exports = function (params) {
    const router = require('express').Router();
    const exec = require('util').promisify(require('child_process').exec);
    const fs = require('fs'); // 
    const fsp = require('fs').promises;
    const http = require('http');

    const computername = "";
    const start = Date.now();
    let reqnum = 0;

    exec("hostname")
        .then(d => {
            computername = d.stdout.trim();
        })
        .catch(error => {
            console.log("Could not get hostname: " + error);
        });

    const {
        logFilePath,
        IPPath,
        userDBpath,
        deleteLogOnRestart,
        servicename
    } = params;
    const logFile = logFilePath;
    const logIPFiles = IPPath + "/IPs";


    //log paths
    //const logFile = params.logFilePath;
    //const logIPFiles = params.IPPath + "/IPs";

    if (!fs.existsSync(logIPFiles)) {
        fs.mkdirSync(logIPFiles);
    }

    if (deleteLogOnRestart === "true") {
        console.log("deleting log....");
        if (fs.existsSync(logFile)) {
            exec("mv " + logFile + " " + logFile + Date.now(), (err, stdout, stderr) => {
                if (err) {
                    console.log(err);
                }
            });
        }
        exec("rm " + logIPFiles + "/*", (err, stdout, stderr) => {});
    }


    //utils
    function prettyDate(dt) {
        var seconds = (dt) / 1000;
        var d = Math.floor(seconds / (3600 * 24));
        var h = Math.floor(seconds % (3600 * 24) / 3600);
        var m = Math.floor(seconds % 3600 / 60);
        var s = Math.floor(seconds % 60);
        var ret = (d > 0 ? d + "d" : "") + (h > 0 ? h + "h" : "") + (m > 0 ? m + "m" : "") + (s > 0 ? s + "s" : "");
        ret = (ret == "" ? "0s" : ret);
        return ret;
    }

    function simplifyIP(ip) {
        var ipArray = ip.split(":");
        if (ipArray.length >= 3) {
            ip = ipArray[3];
        }
        if (!ip) {
            ip = "noIP";
        }
        return ip;
    }


    function writeIPFile(ip) {
        if (!fs.existsSync(logIPFiles + "/" + ip)) {
            var options = {
                host: 'ip-api.com',
                port: 80,
                path: '/json/' + ip,
                method: 'GET'
            };
            http.request(options, function (res) {
                res.on('data', function (d) {
                    fs.writeFile(logIPFiles + "/" + ip, d, (err) => {

                        if (err) {
                            console.log(err);
                        }
                    });
                });
            }).end();
        }
    }

    function readIPFiles(d) {
        var ipAddresses = {};
        for (i = 0; i < d.length; i++) {
            var item = d[i];
            if (!ipAddresses[item.IP]) {
                ipAddresses[item.IP] = {
                    "hits": 1,
                    "URLs": {
                        [item["URL"]]: 1
                    },
                    "session": {
                        [item["session"]]: 1
                    },
                    "user": {
                        [item["user"]]: 1
                    }
                };

            } else {
                ipAddresses[item.IP]["hits"]++;
                if (ipAddresses[item.IP]["URLs"][item["URL"]]) {
                    ipAddresses[item.IP]["URLs"][item["URL"]]++;
                } else {
                    ipAddresses[item.IP]["URLs"][item["URL"]] = 1;

                };
                if (ipAddresses[item.IP]["session"][item["session"]]) {
                    ipAddresses[item.IP]["session"][item["session"]]++;
                } else {
                    ipAddresses[item.IP]["session"][item["session"]] = 1;

                };
                if (ipAddresses[item.IP]["user"][item["user"]]) {
                    ipAddresses[item.IP]["user"][item["user"]]++;
                } else {
                    ipAddresses[item.IP]["user"][item["user"]] = 1;

                };

            }
        }
        const promiseArray = [];
        for (i = 0; i < Object.keys(ipAddresses).length; i++) {
            var itemIP = Object.keys(ipAddresses)[i];
            /*
            try {
                tmp = fs.readFileSync(logIPFiles + "/" + itemIP, 'utf8');
                tmp = JSON.parse(tmp);
                ipAddresses[itemIP].ipData = tmp;
            } catch (e) {
                ipAddresses[itemIP].ipData = "Error in IP Address";
            }
                */
            var tmp = fsp.readFile(logIPFiles + "/" + itemIP, 'utf8')
                .then((d) => {
                    d = JSON.parse(d);
                    ipAddresses[itemIP].ipData = d;
                })
                .catch(error => {
                    ipAddresses[itemIP].ipData = "Error in IP Address";
                });

            promiseArray.push(tmp);
        }

        return Promise.all(promiseArray)
            .then(results => {
                return ipAddresses;
            })
            .catch(error => {
                return "error reading IP Addresses";
            });

    }


    //log request
    router.use((req, res, next) => {
        req.date = Date.now();
        req.orignalURL = req.url;
        req.reqnum = reqnum;
        reqnum++;
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        req.simpleIP = simplifyIP(ip);
        res.on('finish', async () => {
            var logData = {
                "rq": req.reqnum,
                "date": req.date,
                "at": prettyDate(req.date - start),
                "URL": req.orignalURL,
                "IP": req.simpleIP,
                "took": `${Date.now() - req.date}` + 'mS',
                "session": req.session.id,
                "user": req.session.user,
                "computer": computername,
                "err": req.hasError ? 'URL Not Found\n' : 'None'
            };
            fs.appendFile(logFile, JSON.stringify(logData, null, 2) + ',', function (err) {
                if (err) {
                    console.log(err);
                }
            });
            writeIPFile(req.simpleIP);
        });
        next();
    });

    router.get('/get-diag-data', (req, res) => {
        if (req.session.user && req.session.admin) {
            //var ret = "{";
            ret = {};

            //var cc = `systemctl status ${params.servicename}.service | grep active`;
            var cc = `ls -l`;

            const getCommand = exec(cc)
                .then((d) => {
                    if (d.stdout) {
                        //ret += `"command": "${d.stdout.replace(/(\r\n|\n|\r)/gm, "")}",`;
                        ret.command = d.stdout.replace(/(\r\n|\n|\r)/gm, "");
                    }
                })
                .catch(error => {
                    console.log(error);
                    //ret += `"command": "${error.stderr.replace(/(\r\n|\n|\r)/gm, "")}",`;
                    ret.command = error.stderr.replace(/(\r\n|\n|\r)/gm, "");
                });

            const getLog = fsp.readFile(logFile, 'utf8')
                .then(d => {
                    d = '[' + d.slice(0, -1) + ']';
                    //ret += `"log":${d},`;
                    ret.log = JSON.parse(d);
                    return readIPFiles(ret.log);
                })
                .then(d => {
                    //ret += `"IPs": ${JSON.stringify(d)},`;
                    ret.IPs = d;
                })
                .catch(error => {
                    console.log(error);
                    //ret += `"log": "Error Reading log",`;
                });

            // get rid of params
            const getUsers = fsp.readFile(userDBpath, 'utf8').then((d) => {
                    //ret += `"Users": ${d},`;
                    ret.Users = JSON.parse(d);
                })
                .catch(error => {
                    console.log(error);
                    //ret += `"Users": "Error Reading User Data",`;
                });


            Promise.all([getLog, getUsers, getCommand]).then((results) => {
                ret.Node = process.version;
                res.send(ret);
            });

        } else {
            res.send('{"msg": "You need to be logged in as admin"}');
        }
    });

    router.get('/log/server', (req, res, next) => {
        if (req.session.user && req.session.admin) {
            fs.readFile(logFile, 'utf8', (err, d) => {
                res.setHeader('content-type', 'text/plain');
                res.send(d);
            });
        } else {
            res.send("You need to be logged in as admin to see this page");
        }
    });


    router.get('/log/failedURLs', (req, res, next) => {
        if (req.session.user && req.session.admin) {
            fs.readFile(logFile, 'utf8', (err, d) => {
                if (d == null) {
                    res.send("no log exists");
                } else {
                    var output = "";
                    var data = JSON.parse('[' + d.substring(0, d.length - 1) + ']'); //parse data
                    for (var element in data) {
                        if (data[element].err === 'URL Not Found\n') {
                            output += data[element].URL + ' by: ' + data[element].IP + '\n';
                        }
                    }
                    res.setHeader('content-type', 'text/plain');
                    res.send(output);
                }
            });
        } else {
            res.send("You need to be logged in as admin to see this page");
        }
    });

    router.get('/log/userDB', (req, res, next) => {
        if (req.session.user && req.session.admin) {
            fs.readFile(userDBpath, 'utf8', (err, d) => {
                res.setHeader('content-type', 'text/plain');
                res.send(d);
            });
        } else {
            res.send("You need to be logged in as admin to see this page");
        }
    });

    router.get('/log/getNodeV', (req, res) => {
        res.send(process.version);
    });

    router.get('/log/systemctl', (req, res, next) => {
        if (req.session.user && req.session.admin) {
            exec(`systemctl status ${servicename}.service | grep active`, (err, stdout, stderr) => {
                if (err) {
                    return res.status(400).send('Error Getting systemctl');
                } else {
                    res.send(stdout);
                }
            });
        } else {
            res.send("not logged in");
        }
    });

    router.get('/log/Ips', (req, res, next) => {
        if (req.session.user && req.session.admin) {
            fs.readFile(logFile, 'utf8', (err, d) => {
                if (err) {
                    console.log("cannot find file");
                    next();
                } else {

                    d = JSON.parse('[' + d.slice(0, -1) + ']');
                    var ipAddresses = {};
                    for (i = 0; i < d.length; i++) {
                        var item = d[i];
                        if (!ipAddresses[item.IP]) {
                            ipAddresses[item.IP] = {
                                "hits": 1,
                                "URLs": {
                                    [item["URL"]]: 1
                                },
                                "session": {
                                    [item["session"]]: 1
                                },
                                "user": {
                                    [item["user"]]: 1
                                }
                            };

                        } else {
                            ipAddresses[item.IP]["hits"]++;
                            if (ipAddresses[item.IP]["URLs"][item["URL"]]) {
                                ipAddresses[item.IP]["URLs"][item["URL"]]++;
                            } else {
                                ipAddresses[item.IP]["URLs"][item["URL"]] = 1;

                            };
                            if (ipAddresses[item.IP]["session"][item["session"]]) {
                                ipAddresses[item.IP]["session"][item["session"]]++;
                            } else {
                                ipAddresses[item.IP]["session"][item["session"]] = 1;

                            };
                            if (ipAddresses[item.IP]["user"][item["user"]]) {
                                ipAddresses[item.IP]["user"][item["user"]]++;
                            } else {
                                ipAddresses[item.IP]["user"][item["user"]] = 1;

                            };

                        }
                    }
                    for (i = 0; i < Object.keys(ipAddresses).length; i++) {
                        var itemIP = Object.keys(ipAddresses)[i];
                        try {
                            tmp = fs.readFileSync(logIPFiles + "/" + itemIP, 'utf8');
                            tmp = JSON.parse(tmp);
                            ipAddresses[itemIP].ipData = tmp;
                        } catch (e) {
                            ipAddresses[itemIP].ipData = "Error in IP Address";
                        }
                    }
                    res.send(ipAddresses);
                }
            });
        } else {
            res.send("You need to be logged in as admin to see this page");
        }
    });

    return router;
};