module.exports = function (params) {
    const router = require('express').Router();
    const exec = require('util').promisify(require('child_process').exec);
    const fs = require('fs'); // 
    const fsp = require('fs').promises;
    const http = require('http');
    const start = Date.now();

    let computername = "";
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

    const maxCachedIPDetails = 1000;
    const maxCachedIPDetailsBytes = 4 * 1024 * 1024;
    const maxConcurrentIPDetailReads = 16;
    const cachedIPDetails = new Map();
    const pendingIPDetailReads = new Map();
    const queuedIPDetailReadSlots = [];
    let activeIPDetailReads = 0;
    let cachedIPDetailsBytes = 0;

    async function acquireIPDetailReadSlot() {
        if (activeIPDetailReads < maxConcurrentIPDetailReads) {
            activeIPDetailReads++;
            return;
        }

        await new Promise(resolve => queuedIPDetailReadSlots.push(resolve));
    }

    function releaseIPDetailReadSlot() {
        const next = queuedIPDetailReadSlots.shift();
        if (next) {
            next();
        } else {
            activeIPDetailReads--;
        }
    }

    async function readIPDetails(ip) {
        const cached = cachedIPDetails.get(ip);
        if (cached) {
            cachedIPDetails.delete(ip);
            cachedIPDetails.set(ip, cached);
            return cached.value;
        }

        const pending = pendingIPDetailReads.get(ip);
        if (pending) {
            return pending;
        }

        const read = (async () => {
            await acquireIPDetailReadSlot();
            try {
                const contents = await fsp.readFile(logIPFiles + "/" + ip, 'utf8');
                const value = JSON.parse(contents);
                const size = Buffer.byteLength(contents, 'utf8');

                if (size <= maxCachedIPDetailsBytes) {
                    while (cachedIPDetails.size >= maxCachedIPDetails ||
                        cachedIPDetailsBytes + size > maxCachedIPDetailsBytes) {
                        const oldestIP = cachedIPDetails.keys().next().value;
                        const oldest = cachedIPDetails.get(oldestIP);
                        cachedIPDetails.delete(oldestIP);
                        cachedIPDetailsBytes -= oldest.size;
                    }

                    cachedIPDetails.set(ip, { value, size });
                    cachedIPDetailsBytes += size;
                }

                return value;
            } finally {
                releaseIPDetailReadSlot();
            }
        })();
        pendingIPDetailReads.set(ip, read);

        try {
            return await read;
        } finally {
            pendingIPDetailReads.delete(ip);
        }
    }

    function readIPFiles(d) {
        let ipAddresses = {};
        for (let i = 0; i < d.length; i++) {
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
        for (const itemIP of Object.keys(ipAddresses)) {

            /*
            try {
                tmp = fs.readFileSync(logIPFiles + "/" + itemIP, 'utf8');
                tmp = JSON.parse(tmp);
                ipAddresses[itemIP].ipData = tmp;
            } catch (e) {
                ipAddresses[itemIP].ipData = "Error in IP Address";
            }
                */
            let tmp = readIPDetails(itemIP)
                .then((ipData) => {
                    ipAddresses[itemIP].ipData = ipData;

                }).catch(error => {
                    if (error.code !== 'ENOENT') {
                        console.error(`Unable to read IP details for ${itemIP}:`, error);
                    }
                    ipAddresses[itemIP].ipData = "Error in IP Address";
                });

            promiseArray.push(tmp);
        }

        return Promise.all(promiseArray)
            .then(() => {
                return ipAddresses;
            })
            .catch(error => {
                return "error reading IP Addresses";
            });

    }

    const diagnosticPageSize = 500;
    const diagnosticBinLimit = 600;
    const diagnosticUrlLimit = 500;
    const defaultDiagnosticStepMs = 10 * 60_000;

    async function getDiagnosticLogFileInfo() {
        try {
            const stats = await fsp.stat(logFile);
            return {
                size: stats.size,
                id: `${stats.dev}:${stats.ino}`
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    size: 0,
                    id: `missing:${logFile}`
                };
            }
            throw error;
        }
    }

    function getRequestedStepMs(value) {
        const stepSeconds = value === undefined
            ? defaultDiagnosticStepMs / 1000
            : Number(value);
        if (!Number.isFinite(stepSeconds) || stepSeconds < 1 || stepSeconds > 31_536_000) {
            const error = new Error('Histogram step must be between 1 second and 1 year');
            error.status = 400;
            throw error;
        }
        return stepSeconds * 1000;
    }

    async function findRecentLogEntryStarts(endOffset, maxEntries) {
        // The log writer serializes each entry with "rq" as its first property.
        const entryMarker = Buffer.from('{\n  "rq":');
        const chunkSize = 64 * 1024;
        const entryStarts = [];
        let position = endOffset;
        let rightContext = Buffer.alloc(0);
        const file = await fsp.open(logFile, 'r');

        try {
            while (position > 0 && entryStarts.length < maxEntries) {
                const start = Math.max(0, position - chunkSize);
                const chunk = Buffer.alloc(position - start);
                const { bytesRead } = await file.read(chunk, 0, chunk.length, start);
                const currentChunk = chunk.subarray(0, bytesRead);
                const combined = rightContext.length
                    ? Buffer.concat([currentChunk, rightContext])
                    : currentChunk;

                let markerIndex = combined.lastIndexOf(entryMarker);
                while (markerIndex >= 0) {
                    if (markerIndex < bytesRead) {
                        entryStarts.push(start + markerIndex);
                        if (entryStarts.length >= maxEntries) {
                            break;
                        }
                    }
                    if (markerIndex === 0) {
                        break;
                    }
                    markerIndex = combined.lastIndexOf(entryMarker, markerIndex - 1);
                }

                rightContext = combined.subarray(0, Math.min(entryMarker.length - 1, combined.length));
                position = start;
                if (bytesRead !== chunk.length) {
                    break;
                }
            }
        } finally {
            await file.close();
        }

        return entryStarts;
    }

    async function getDiagnosticLogPage(requestedCursor, requestedStepMs) {
        const fileInfo = await getDiagnosticLogFileInfo();
        const fileSize = fileInfo.size;
        const cursor = requestedCursor === null ? fileSize : requestedCursor;

        if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > fileSize) {
            const error = new Error('Invalid log pagination cursor');
            error.status = 400;
            throw error;
        }

        const entryStarts = await findRecentLogEntryStarts(
            cursor,
            diagnosticPageSize + 1
        );
        const hasMore = entryStarts.length > diagnosticPageSize;
        const pageStarts = entryStarts.slice(0, diagnosticPageSize);
        const pageEntries = [];

        if (pageStarts.length > 0) {
            const dataStart = pageStarts[pageStarts.length - 1];
            const data = await fsp.open(logFile, 'r');
            try {
                const pageBuffer = Buffer.alloc(cursor - dataStart);
                const { bytesRead } = await data.read(pageBuffer, 0, pageBuffer.length, dataStart);
                if (bytesRead !== pageBuffer.length) {
                    throw new Error('Diagnostic log changed while reading a page');
                }

                for (let index = 0; index < pageStarts.length; index++) {
                    const start = pageStarts[index] - dataStart;
                    const end = index === 0 ? cursor - dataStart : pageStarts[index - 1] - dataStart;
                    let json = pageBuffer.subarray(start, end).toString('utf8').trim();
                    if (json.endsWith(',')) {
                        json = json.slice(0, -1).trimEnd();
                    }
                    pageEntries.push({
                        entry: JSON.parse(json),
                        startOffset: pageStarts[index]
                    });
                }
            } finally {
                await data.close();
            }
        }

        const entries = pageEntries.map(item => item.entry);
        let minDate = Infinity;
        let maxDate = -Infinity;
        for (const entry of entries) {
            if (Number.isFinite(entry.date)) {
                minDate = Math.min(minDate, entry.date);
                maxDate = Math.max(maxDate, entry.date);
            }
        }

        const hasDates = Number.isFinite(minDate) && Number.isFinite(maxDate);
        const requestedBinCount = hasDates
            ? Math.ceil((maxDate - minDate + 1) / requestedStepMs)
            : 0;
        const binWidth = requestedBinCount > diagnosticBinLimit
            ? Math.ceil((maxDate - minDate + 1) / diagnosticBinLimit / requestedStepMs) * requestedStepMs
            : requestedStepMs;
        const binCount = hasDates ? Math.max(1, Math.ceil((maxDate - minDate + 1) / binWidth)) : 0;
        const histogram = Array.from({ length: binCount }, (_, index) => ({
            binStart: minDate + index * binWidth,
            count: 0
        }));
        const urlStats = {};
        let urlStatCount = 0;
        let urlStatsTruncated = false;
        const failedUrls = [];

        for (const entry of entries) {
            if (Number.isFinite(entry.date) && histogram.length > 0) {
                const index = Math.min(
                    histogram.length - 1,
                    Math.floor((entry.date - minDate) / binWidth)
                );
                if (index >= 0) {
                    histogram[index].count++;
                }
            }

            if (entry.err === 'None' && typeof entry.URL === 'string') {
                const url = entry.URL.split('?')[0];
                if (!Object.hasOwn(urlStats, url) && urlStatCount < diagnosticUrlLimit) {
                    urlStats[url] = { count: 0, took: 0 };
                    urlStatCount++;
                }

                if (Object.hasOwn(urlStats, url)) {
                    // Aggregate at most diagnosticUrlLimit distinct paths.
                    urlStats[url].count++;
                    const duration = Number.parseFloat(entry.took);
                    if (Number.isFinite(duration)) {
                        urlStats[url].took += duration;
                    }
                } else {
                    urlStatsTruncated = true;
                }
            }

            if (entry.err === 'URL Not Found\n') {
                failedUrls.push(`${entry.URL} by ${entry.IP}`);
            }
        }

        return {
            log: entries,
            logBytes: fileSize,
            logId: fileInfo.id,
            pageCursor: cursor,
            hasMore,
            nextCursor: pageEntries.length ? pageEntries[pageEntries.length - 1].startOffset : null,
            failedUrls,
            failedUrlCount: failedUrls.length,
            histogram,
            histogramStepMs: binWidth,
            urlStats,
            urlStatsTruncated,
            IPs: await readIPFiles(entries)
        };
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
            let requestedStepMs;
            try {
                requestedStepMs = getRequestedStepMs(req.query.stepSeconds);
            } catch (error) {
                return res.status(400).json({
                    msg: error.message
                });
            }
            const ret = {};
            const memoryBefore = process.memoryUsage();
            const memoryPeak = {
                rss: memoryBefore.rss,
                heapUsed: memoryBefore.heapUsed
            };
            const memorySampler = setInterval(() => {
                const current = process.memoryUsage();
                memoryPeak.rss = Math.max(memoryPeak.rss, current.rss);
                memoryPeak.heapUsed = Math.max(memoryPeak.heapUsed, current.heapUsed);
            }, 10);

            function finishMemorySampling() {
                clearInterval(memorySampler);
                const memoryAfter = process.memoryUsage();
                memoryPeak.rss = Math.max(memoryPeak.rss, memoryAfter.rss);
                memoryPeak.heapUsed = Math.max(memoryPeak.heapUsed, memoryAfter.heapUsed);
                return {
                    samplingIntervalMs: 10,
                    before: {
                        rssBytes: memoryBefore.rss,
                        heapUsedBytes: memoryBefore.heapUsed
                    },
                    peak: {
                        rssBytes: memoryPeak.rss,
                        heapUsedBytes: memoryPeak.heapUsed
                    },
                    after: {
                        rssBytes: memoryAfter.rss,
                        heapUsedBytes: memoryAfter.heapUsed
                    }
                };
            }

            const command =
                `systemctl show ${params.servicename}.service --property=ActiveState,ActiveEnterTimestamp`;

            const getCommand = exec(command)
                .then((d) => {
                    if (d.stdout) {
                        ret.command = d.stdout.replace(/(\r\n|\n|\r)/gm, "");
                    }
                })
                .catch(error => {
                    console.log(error);
                    ret.command = (error.stderr || error.message).replace(/(\r\n|\n|\r)/gm, "");
                });

            const getLog = getDiagnosticLogPage(null, requestedStepMs)
                .then(summary => {
                    Object.assign(ret, summary);
                });

            const getUsers = fsp.readFile(userDBpath, 'utf8').then((d) => {
                ret.Users = JSON.parse(d);
            });


            Promise.all([getLog, getUsers, getCommand]).then(() => {
                ret.Node = process.version;
                ret.memory = finishMemorySampling();
                res.send(ret);
            }).catch(error => {
                finishMemorySampling();
                console.error('Unable to read diagnostic data:', error);
                res.status(500).json({ msg: 'Unable to read diagnostic data' });
            });

        } else {
            res.status(403).json({ msg: 'You need to be logged in as admin' });
        }
    });

    router.get('/get-diag-log', async (req, res) => {
        if (!req.session.user || !req.session.admin) {
            return res.status(403).json({ msg: 'You need to be logged in as admin' });
        }

        try {
            const cursor = Number(req.query.cursor);
            const requestedStepMs = getRequestedStepMs(req.query.stepSeconds);
            const page = await getDiagnosticLogPage(cursor, requestedStepMs);
            res.json(page);
        } catch (error) {
            if (error.status === 400) {
                return res.status(400).json({ msg: error.message });
            }
            console.error('Unable to read diagnostic log page:', error);
            res.status(500).json({ msg: 'Unable to read diagnostic log page' });
        }
    });

    router.get('/get-diag-meta', async (req, res) => {
        if (!req.session.user || !req.session.admin) {
            return res.status(403).json({ msg: 'You need to be logged in as admin' });
        }
        try {
            const fileInfo = await getDiagnosticLogFileInfo();
            res.json({ logId: fileInfo.id, logBytes: fileInfo.size });
        } catch (error) {
            console.error('Unable to read diagnostic log metadata:', error);
            res.status(500).json({ msg: 'Unable to read diagnostic log metadata' });
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