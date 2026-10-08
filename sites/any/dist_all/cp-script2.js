const alertPlaceholder = document.getElementById('liveAlertPlaceholder');
const logOutButton = document.getElementById('LogOutButton');
const loginField = document.getElementById('login');
const loginButton = document.getElementById('loginButton');
const userStatus = document.getElementById('userStatus');
const serverRHist = document.getElementById('serverRequestHist');
const serverLog = document.getElementById('serverLog');

serverRHist.style.display = 'none';
userStatus.style.visibility = 'hidden';
loginField.style.display = 'none';
logOutButton.style.display = 'none';

//update fields
const UPDATE_nodeV = document.getElementById("UPDATE-nodeV");
const UPDATE_systemctl = document.getElementById("UPDATE-systemctl");
const previousLogPageButton = document.getElementById("previousLogPage");
const nextLogPageButton = document.getElementById("nextLogPage");
const loadAllLogPagesButton = document.getElementById("loadAllLogPages");
const logPageStatus = document.getElementById("logPageStatus");
const diagnosticPageSize = 500;
let logPageCursors = [null];
let currentLogPage = 1;
let currentLogPageData = null;
let isLoadingLogPage = false;
let isLoadingAllLogPages = false;
let currentLogId = null;
let currentLogBytes = 0;
let pageCacheUnavailableNotified = false;
let logPageCachePromise = null;
let deferPageRedraws = false;
let loadedLogPages = new Set();
let loadedDiagLogRequestCount = 0;
let loadedFailedUrls = [];
let chartRequestedStepMs = 10 * 60_000;
let loadedLogEntries = [];
let loadedIpLocations = {};
const ipMap = L.map('ipMap', { worldCopyJump: true }).setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(ipMap);
const ipMapMarkers = L.layerGroup().addTo(ipMap);

function openLogPageCache() {
    if (!('indexedDB' in window)) {
        return Promise.reject(new Error('IndexedDB is unavailable'));
    }
    if (!logPageCachePromise) {
        logPageCachePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open('nodeServerDiagnostics', 1);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains('logPages')) {
                    database.createObjectStore('logPages', { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open IndexedDB cache'));
        });
    }
    return logPageCachePromise;
}

async function readCachedLogPage(logId, cursor) {
    const database = await openLogPageCache();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('logPages', 'readonly');
        const request = transaction.objectStore('logPages').get(`newest:${logId}:${diagnosticPageSize}:${cursor}`);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Could not read cached log page'));
    });
}

async function cacheLogPage(logId, cursor, data) {
    const database = await openLogPageCache();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('logPages', 'readwrite');
        transaction.objectStore('logPages').put({
            key: `newest:${logId}:${diagnosticPageSize}:${cursor}`,
            logId,
            cursor,
            data
        });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not cache log page'));
        transaction.onabort = () => reject(transaction.error || new Error('Log page cache write was aborted'));
    });
}

async function clearLogPageCache() {
    const database = await openLogPageCache();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('logPages', 'readwrite');
        transaction.objectStore('logPages').clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not clear cached log pages'));
        transaction.onabort = () => reject(transaction.error || new Error('Log page cache clear was aborted'));
    });
}

function reportPageCacheUnavailable(error) {
    if (!pageCacheUnavailableNotified) {
        pageCacheUnavailableNotified = true;
        appendAlert(`Browser page cache unavailable; loading from server instead. ${error.message}`, 'warning');
    }
}

updateData();

function updateData() {
    const fetchTime = Date.now();
    const stepSeconds = getSecs(document.getElementById("newStepSize").value);
    chartRequestedStepMs = stepSeconds * 1000;
    currentLogPageData = null;
    logPageCursors = [null];
    currentLogPage = 1;
    loadedLogPages = new Set();
    loadedDiagLogRequestCount = 0;
    loadedFailedUrls = [];
    loadedLogEntries = [];
    loadedIpLocations = {};
    previousLogPageButton.disabled = true;
    nextLogPageButton.disabled = true;
    loadAllLogPagesButton.disabled = true;
    logPageStatus.textContent = 'Loading diagnostics...';
    fetch('/auth/isLoggedin')
        .then(res => res.text())
        .then(d => {
            if (d === 'true') {
                showLoggedin();
                return fetch(`/get-diag-data?stepSeconds=${encodeURIComponent(stepSeconds)}`);
            } else {
                showLoggedout();
                throw new Error('You Are Not Logged in');
            }
        })
        .then(res => res.json().then(d => {
            if (!res.ok) {
                throw new Error(d.msg || `Unable to load diagnostic data (${res.status})`);
            }
            return d;
        }))
        .then(d => {
            appendAlert(`Fetch took ${Date.now() - fetchTime}ms`, 'primary');
            if (!Array.isArray(d.log) || !d.memory) {
                throw new Error(d.msg || 'Diagnostic response is missing required data');
            }
            currentLogId = d.logId;
            currentLogBytes = d.logBytes;
            logPageCursors[0] = d.pageCursor;
            if (currentLogId) {
                cacheLogPage(currentLogId, d.pageCursor, d).catch(reportPageCacheUnavailable);
            }

            UPDATE_nodeV.innerHTML =
                `Currently using node: ${d.Node} 
            <br>Tested with node: v22.20.0`;

            UPDATE_systemctl.innerHTML =
                `<br>${d.command}<br>`;

            const memoryMiB = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
            const rssPeakIncrease = Math.max(0, d.memory.peak.rssBytes - d.memory.before.rssBytes);
            const heapPeakIncrease = Math.max(0, d.memory.peak.heapUsedBytes - d.memory.before.heapUsedBytes);
            document.getElementById("diagMemory").textContent =
                `Approx. Node memory (sampled every ${d.memory.samplingIntervalMs} ms; process-wide): ` +
                `before diagnostics: RSS ${memoryMiB(d.memory.before.rssBytes)}, ` +
                `heap ${memoryMiB(d.memory.before.heapUsedBytes)}; ` +
                `peak during diagnostics: RSS ${memoryMiB(d.memory.peak.rssBytes)} ` +
                `(+${memoryMiB(rssPeakIncrease)}), ` +
                `heap ${memoryMiB(d.memory.peak.heapUsedBytes)} ` +
                `(+${memoryMiB(heapPeakIncrease)}). Concurrent activity may affect these estimates.`;

            document.getElementById("userDB").innerHTML = `<pre>${JSON.stringify(d.Users, null, 2)}</pre>`;
            renderLogPage(d, currentLogPage);
        })
        .catch(error => {
            logPageStatus.textContent = 'Unable to load diagnostics.';
            appendAlert(error.message || String(error), 'primary');
        });

}

function renderLogPage(data, pageNumber, options = {}) {
    const redraw = options.redraw !== false;
    currentLogPageData = data;
    currentLogPage = pageNumber;
    const isNewPage = !loadedLogPages.has(pageNumber);
    if (isNewPage) {
        loadedLogPages.add(pageNumber);
        loadedFailedUrls.push(...data.failedUrls);
        loadedLogEntries.push(...data.log.map(entry => ({
            date: entry.date,
            URL: entry.URL,
            took: entry.took,
            err: entry.err,
            IP: entry.IP
        })));
    }
    for (const [ip, summary] of Object.entries(data.IPs || {})) {
        if (summary.ipData && typeof summary.ipData === 'object') {
            loadedIpLocations[ip] = summary.ipData;
        }
    }
    const fileSize = data.logBytes < 1024 * 1024
        ? `${(data.logBytes / 1024).toFixed(1)} KiB`
        : `${(data.logBytes / (1024 * 1024)).toFixed(1)} MiB`;

    logPageStatus.textContent =
        `Page ${pageNumber} (newest first): ${data.log.length} entr${data.log.length === 1 ? 'y' : 'ies'}; ` +
        `${fileSize} total log size` +
        `${isLoadingAllLogPages ? `; loading all pages (${pageNumber} loaded)` : data.hasMore ? '' : '; end of log'}`;
    previousLogPageButton.disabled = isLoadingLogPage || isLoadingAllLogPages || pageNumber === 1;
    nextLogPageButton.disabled = isLoadingLogPage || isLoadingAllLogPages || !data.hasMore;
    loadAllLogPagesButton.disabled = isLoadingLogPage || isLoadingAllLogPages || !data.hasMore;
    if (pageNumber === 1) {
        logPageCursors[0] = data.pageCursor;
    }
    document.getElementById("diagLogRequestCount").textContent =
        `/get-diag-log requests found in loaded pages: ${loadedDiagLogRequestCount}`;
    if (redraw) {
        serverLog.innerHTML = `<pre>${JSON.stringify(data.log, null, 2)}</pre>`;
        document.getElementById("ipLog").innerHTML =
            `<p>Summary for this page (${data.log.length} requests).</p>` +
            `<pre>${JSON.stringify(data.IPs, null, 2)}</pre>`;
        document.getElementById("failedUrls").innerHTML =
            `<p>${loadedFailedUrls.length} failed requests across ${loadedLogPages.size} loaded page(s).</p>` +
            `<pre>${JSON.stringify(loadedFailedUrls, null, 2)}</pre>`;
        renderIpMap();
        buildTable();
    }
}

function getVisualizationDateRange() {
    const startValue = document.getElementById("visualizationStartDate").value;
    const endValue = document.getElementById("visualizationEndDate").value;
    const parseDate = value => {
        if (!value) {
            return null;
        }
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
            ? date
            : null;
    };
    const startDate = parseDate(startValue);
    const endDate = parseDate(endValue);

    if ((startValue && !startDate) || (endValue && !endDate)) {
        return { valid: false, error: 'Enter valid start and end dates.' };
    }
    if (startDate && endDate && startDate > endDate) {
        return { valid: false, error: 'The start date must be on or before the end date.' };
    }

    const endExclusive = endDate
        ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1).getTime()
        : null;
    return {
        valid: true,
        start: startDate ? startDate.getTime() : null,
        endExclusive,
        startValue,
        endValue
    };
}

function isEntryInVisualizationDateRange(entry, range) {
    return Number.isFinite(entry.date) &&
        (range.start === null || entry.date >= range.start) &&
        (range.endExclusive === null || entry.date < range.endExclusive);
}

function getVisualizationDateRangeLabel(range) {
    if (range.startValue && range.endValue) {
        return ` (${range.startValue} to ${range.endValue})`;
    }
    if (range.startValue) {
        return ` (from ${range.startValue})`;
    }
    return range.endValue ? ` (through ${range.endValue})` : '';
}

function refreshVisualizationsForDateRange() {
    const range = getVisualizationDateRange();
    const status = document.getElementById("visualizationDateStatus");
    if (!range.valid) {
        status.textContent = range.error;
        status.classList.add('text-danger');
        if (myChart) {
            myChart.destroy();
            myChart = null;
        }
        if (myURLChart) {
            myURLChart.destroy();
            myURLChart = null;
        }
        ipMapMarkers.clearLayers();
        document.getElementById("ipMapStatus").textContent = range.error;
        document.getElementById("diagLogRequestCount").textContent = range.error;
        return;
    }
    status.classList.remove('text-danger');
    status.textContent =
        `Date range applies to loaded data in the server histogram, URL histogram, and IP map` +
        `${getVisualizationDateRangeLabel(range)}.`;
    if (currentLogPageData) {
        buildTable();
        renderIpMap();
    }
}

function renderIpMap() {
    const locations = new Map();
    let locatedIpCount = 0;
    const dateRange = getVisualizationDateRange();
    if (!dateRange.valid) {
        document.getElementById("ipMapStatus").textContent = dateRange.error;
        ipMapMarkers.clearLayers();
        return;
    }

    const ipSummaries = new Map();
    for (const entry of loadedLogEntries) {
        if (!isEntryInVisualizationDateRange(entry, dateRange) ||
            typeof entry.IP !== 'string' ||
            typeof entry.URL !== 'string') {
            continue;
        }
        if (!ipSummaries.has(entry.IP)) {
            ipSummaries.set(entry.IP, { hits: 0, pages: new Map() });
        }
        const summary = ipSummaries.get(entry.IP);
        summary.hits++;
        const page = entry.URL.split('?')[0];
        summary.pages.set(page, (summary.pages.get(page) || 0) + 1);
    }

    for (const [ip, summary] of ipSummaries) {
        const location = loadedIpLocations[ip];
        if (!location || location.status !== 'success' ||
            !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
            continue;
        }

        locatedIpCount++;
        const key = `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;
        if (!locations.has(key)) {
            locations.set(key, {
                lat: location.lat,
                lon: location.lon,
                hits: 0,
                ips: [],
                city: location.city || '',
                region: location.regionName || '',
                country: location.country || '',
                isps: new Set(),
                pages: new Map()
            });
        }
        const place = locations.get(key);
        place.hits += summary.hits;
        place.ips.push(ip);
        const isp = location.isp || location.org;
        if (isp) {
            place.isps.add(isp);
        }
        for (const [page, count] of summary.pages) {
            place.pages.set(page, (place.pages.get(page) || 0) + count);
        }
    }

    ipMapMarkers.clearLayers();
    for (const place of locations.values()) {
        const radius = Math.min(22, 4 + Math.log2(place.hits + 1) * 2);
        const marker = L.circleMarker([place.lat, place.lon], {
            radius,
            color: '#084298',
            weight: 1,
            fillColor: '#0d6efd',
            fillOpacity: 0.55
        });
        const popup = document.createElement('div');
        const locationName = [place.city, place.region, place.country].filter(Boolean).join(', ');
        const title = document.createElement('strong');
        title.textContent = locationName || `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`;
        popup.append(title);
        const appendDetail = (label, value) => {
            const line = document.createElement('div');
            const labelElement = document.createElement('strong');
            labelElement.textContent = `${label}: `;
            line.append(labelElement, document.createTextNode(value));
            popup.append(line);
        };
        appendDetail('Hits', `${place.hits} from ${place.ips.length} IP address(es)`);
        appendDetail('ISP', [...place.isps].join(', ') || 'Unknown');
        const requestedPages = [...place.pages].sort((a, b) => b[1] - a[1]);
        const visiblePages = requestedPages.slice(0, 20);
        const pagesList = document.createElement('ul');
        pagesList.className = 'mb-0 ps-3';
        for (const [page, count] of visiblePages) {
            const item = document.createElement('li');
            item.textContent = `${page} (${count})`;
            pagesList.append(item);
        }
        if (requestedPages.length > visiblePages.length) {
            const item = document.createElement('li');
            item.textContent = `...and ${requestedPages.length - visiblePages.length} more`;
            pagesList.append(item);
        }
        const pagesHeading = document.createElement('div');
        pagesHeading.textContent = 'Pages requested:';
        popup.append(pagesHeading, pagesList);
        marker.bindTooltip(popup, { direction: 'top', sticky: true, opacity: 0.95 })
            .addTo(ipMapMarkers);
    }

    document.getElementById("ipMapStatus").textContent =
        `${locations.size} mapped location(s) from ${locatedIpCount} IP address(es), ` +
        `across ${loadedLogPages.size} loaded page(s)${getVisualizationDateRangeLabel(dateRange)}. ` +
        `Circle size represents hit count.`;
}

async function loadLogPage(cursor, pageNumber) {
    if (isLoadingLogPage) {
        return;
    }

    isLoadingLogPage = true;
    previousLogPageButton.disabled = true;
    nextLogPageButton.disabled = true;
    loadAllLogPagesButton.disabled = true;
    const stepSeconds = getSecs(document.getElementById("newStepSize").value);
    const query = new URLSearchParams({
        cursor: String(cursor),
        stepSeconds: String(stepSeconds)
    });

    try {
        let data = null;
        if (currentLogId) {
            try {
                const cached = await readCachedLogPage(currentLogId, cursor);
                if (cached &&
                    cached.logId === currentLogId &&
                    cached.data.logBytes <= currentLogBytes &&
                    !(cached.data.hasMore === false && cached.data.logBytes < currentLogBytes)) {
                    data = cached.data;
                }
            } catch (error) {
                reportPageCacheUnavailable(error);
            }
        }

        if (!data) {
            const response = await fetch(`/get-diag-log?${query}`);
            data = await response.json();
            if (!response.ok) {
                throw new Error(data.msg || `Unable to load log page (${response.status})`);
            }
            if (currentLogId && data.logId !== currentLogId) {
                appendAlert('The server log was replaced while paging. Reloading diagnostics.', 'warning');
                updateData();
                return false;
            }
            currentLogId = data.logId;
            currentLogBytes = Math.max(currentLogBytes, data.logBytes);
            if (currentLogId) {
                try {
                    await cacheLogPage(currentLogId, cursor, data);
                } catch (error) {
                    reportPageCacheUnavailable(error);
                }
            }
        }

        currentLogBytes = Math.max(currentLogBytes, data.logBytes);
        logPageCursors = logPageCursors.slice(0, pageNumber - 1);
        logPageCursors[pageNumber - 1] = cursor;
        renderLogPage(data, pageNumber, { redraw: !deferPageRedraws });
        return true;
    } catch (error) {
        appendAlert(error.message || String(error), 'primary');
        return false;
    } finally {
        isLoadingLogPage = false;
        if (currentLogPageData) {
            previousLogPageButton.disabled = isLoadingAllLogPages || currentLogPage === 1;
            nextLogPageButton.disabled = isLoadingAllLogPages || !currentLogPageData.hasMore;
            loadAllLogPagesButton.disabled =
                isLoadingAllLogPages || !currentLogPageData.hasMore;
        }
    }
}

async function loadAllLogPages() {
    if (isLoadingAllLogPages || isLoadingLogPage || !currentLogPageData) {
        return;
    }

    const startedAt = Date.now();
    isLoadingAllLogPages = true;
    previousLogPageButton.disabled = true;
    nextLogPageButton.disabled = true;
    loadAllLogPagesButton.disabled = true;

    try {
        const metaResponse = await fetch('/get-diag-meta');
        const meta = await metaResponse.json();
        if (!metaResponse.ok) {
            throw new Error(meta.msg || `Unable to check log cache (${metaResponse.status})`);
        }
        if (meta.logId !== currentLogId || meta.logBytes < currentLogBytes) {
            appendAlert('The server log changed; refreshing diagnostics before loading pages.', 'warning');
            updateData();
            return;
        }
        currentLogBytes = meta.logBytes;

        let pagesLoaded = 0;
        deferPageRedraws = true;
        while (currentLogPageData.hasMore) {
            const nextCursor = currentLogPageData.nextCursor;
            const nextPageNumber = currentLogPage + 1;
            const loaded = await loadLogPage(nextCursor, nextPageNumber);
            if (!loaded) {
                break;
            }
            pagesLoaded++;
            if (pagesLoaded % 100 === 0) {
                if (currentLogPageData.hasMore) {
                    renderLogPage(currentLogPageData, currentLogPage);
                }
                const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
                appendAlert(`Loaded ${pagesLoaded} additional pages in ${elapsedSeconds} seconds`, 'primary');
            }
        }
    } catch (error) {
        appendAlert(error.message || String(error), 'warning');
    } finally {
        deferPageRedraws = false;
        isLoadingAllLogPages = false;
        if (currentLogPageData) {
            renderLogPage(currentLogPageData, currentLogPage);
        }
        const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        const result = currentLogPageData && !currentLogPageData.hasMore
            ? 'Loaded all log pages'
            : 'Stopped loading log pages';
        appendAlert(`${result} in ${elapsedSeconds} seconds`, 'primary');
    }
}

//Functions
const appendAlert = (message, type) => {
    const uuid = Date.now();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible alertAnimate" role="alert" id="${uuid}">`,
        `   <div>${message}</div>`,
        '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
        '</div>'
    ].join('');
    alertPlaceholder.append(wrapper);
    var alertNode = document.getElementById(uuid);
    setTimeout(function () {
        var alertNode = document.getElementById(uuid);
        if (alertNode) {
            alertNode.classList.remove('alertAnimate'); // If removing a class first
            void alertNode.offsetWidth;
            alertNode.classList.add('alertReverse');
        }
        setTimeout(function () {
            var alertNode = document.getElementById(uuid);
            if (alertNode) {
                alertNode.remove();
            }
        }, 1000);
    }, 5000);
};


function showLoggedin() {
    fetch("/auth/getUsername")
        .then(res => res.text())
        .then(d => {
            (d) ? document.getElementById("getUsername").innerHTML = d: document.getElementById("getUsername")
                .innerHTML = "n/a";
        });
    fetch("/auth/isAdmin")
        .then(res => res.text())
        .then(d => {
            (d) ? document.getElementById("isAdmin").innerHTML = d: document.getElementById("isAdmin")
                .innerHTML = "n/a";
        });
    userStatus.style.visibility = 'visible';
    logOutButton.style.display = 'inline-block';
    loginField.style.display = 'none';
    //buildTable(600);
    serverRHist.style.display = 'block';
    setTimeout(() => ipMap.invalidateSize(), 0);




}

function showLoggedout() {
    clearLogPageCache().catch(reportPageCacheUnavailable);
    document.getElementById("userVal").value = document.getElementById("userVal").ariaPlaceholder;
    document.getElementById("passVal").value = document.getElementById("passVal").ariaPlaceholder;
    userStatus.style.visibility = 'hidden';
    logOutButton.style.display = 'none';
    loginField.style.display = 'flex';
    serverRHist.style.display = 'none';
}






//Events
logOutButton.onclick = function () {
    fetch('/auth/logout')
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.text();
        })
        .then(d => {
            appendAlert('You Are Now Logged out', 'primary');
            showLoggedout();
        });

};


loginButton.onclick = function () {
    const postData = {
        user: document.getElementById("userVal").value,
        password: document.getElementById("passVal").value
    };

    fetch(`/auth/quick-signin/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.text();
        })
        .then(d => {
            switch (d) {
                case "Incorrect Password":
                    appendAlert('Incorrect Password', 'warning');
                    break;

                case "User Cannot be Found":
                    appendAlert('User Cannot be Found', 'warning');
                    break;

                case "You Are logged IN":
                    appendAlert('You Are Now Logged in', 'primary');
                    updateData();
                    break;
            }

        });


};

document.getElementById("updateData").onclick = function () {
    const stepSeconds = getSecs(document.getElementById("newStepSize").value);
    chartRequestedStepMs = stepSeconds * 1000;
    document.getElementById("newStepSize").value = prettyDate(chartRequestedStepMs);
    appendAlert(`Histogram step updated: ${prettyDate(chartRequestedStepMs)}`, 'primary');

    if (currentLogPageData) {
        buildTable();
    } else {
        updateData();
    }
};

document.getElementById("histogramYAxisScale").onchange = function () {
    if (currentLogPageData) {
        buildTable();
    }
};

document.getElementById("visualizationStartDate").onchange = refreshVisualizationsForDateRange;
document.getElementById("visualizationEndDate").onchange = refreshVisualizationsForDateRange;
document.getElementById("clearVisualizationDates").onclick = function () {
    document.getElementById("visualizationStartDate").value = '';
    document.getElementById("visualizationEndDate").value = '';
    refreshVisualizationsForDateRange();
};

nextLogPageButton.onclick = function () {
    if (!currentLogPageData || currentLogPageData.nextCursor === null) {
        return;
    }
    loadLogPage(currentLogPageData.nextCursor, currentLogPage + 1);
};

loadAllLogPagesButton.onclick = loadAllLogPages;

previousLogPageButton.onclick = function () {
    if (currentLogPage <= 1) {
        return;
    }
    loadLogPage(logPageCursors[currentLogPage - 2], currentLogPage - 1);
};


//chart functions
var myChart;


var myURLChart;





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


function getSecs(str) {
    var d = 0,
        h = 0,
        min = 0,
        sec = 0;

    if (str.includes("d")) {
        d = str.split("d")[0];
        str = str.split("d")[1];
    }

    if (str.includes("h")) {
        h = str.split("h")[0];
        str = str.split("h")[1];
    }

    if (str.includes("m")) {
        min = str.split("m")[0];
        str = str.split("m")[1];
    }

    if (str.includes("s")) {
        sec = str.split("s")[0];
    } else {
        sec = str;
    }

    const ret = Number(sec) + 60 * min + 3600 * h + 3600 * 24 * d;
    if (!Number.isFinite(ret) || ret <= 0) {
        return 60;
    }
    return ret;
}






function buildTable() {
    const tableDate = Date.now();
    const dateRange = getVisualizationDateRange();
    if (!dateRange.valid) {
        return;
    }
    const filteredEntries = loadedLogEntries.filter(entry =>
        isEntryInVisualizationDateRange(entry, dateRange)
    );
    const filteredDates = filteredEntries.map(entry => entry.date);
    const hasDates = filteredDates.length > 0;
    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const timestamp of filteredDates) {
        minDate = Math.min(minDate, timestamp);
        maxDate = Math.max(maxDate, timestamp);
    }
    const requestedBinCount = hasDates
        ? Math.ceil((maxDate - minDate + 1) / chartRequestedStepMs)
        : 0;
    const binWidth = requestedBinCount > 600
        ? Math.ceil((maxDate - minDate + 1) / 600 / chartRequestedStepMs) * chartRequestedStepMs
        : chartRequestedStepMs;
    const binCount = hasDates
        ? Math.max(1, Math.ceil((maxDate - minDate + 1) / binWidth))
        : 0;
    const histogram = Array.from({ length: binCount }, (_, index) => ({
        binStart: minDate + index * binWidth,
        count: 0
    }));
    for (const timestamp of filteredDates) {
        const index = Math.min(
            histogram.length - 1,
            Math.floor((timestamp - minDate) / binWidth)
        );
        if (index >= 0) {
            histogram[index].count++;
        }
    }

    const counts = histogram.map(bin => bin.count);
    const dates = histogram.map(bin => {
        const timestamp = bin.binStart;
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    });

    console.log(`Build histogram took ${Date.now() - tableDate}ms`);

    const ctx = document.getElementById('myChart');
    if (myChart) {
        myChart.destroy();
    }
    myChart = new Chart(ctx, {
        type: "bar",

        data: {
            labels: dates,
            datasets: [{
                label: `Requests on ${loadedLogPages.size} loaded page(s)${getVisualizationDateRangeLabel(dateRange)} per ${prettyDate(binWidth)}`,
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,0,255,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: counts,
            }]
        },
        options: {
            scales: {
                y: {
                    type: document.getElementById("histogramYAxisScale").value,
                    title: {
                        display: true,
                        text: 'Requests'
                    }
                }
            }
        }
    });
    console.log(`Build chart took ${Date.now() - tableDate}ms`);



    const ctxURL = document.getElementById('myURLChart');
    URLxVals = {};
    if (myURLChart) {
        myURLChart.destroy();
    }

    URLxVals = {};
    let urlStatsTruncated = false;
    let urlStatCount = 0;
    let diagLogRequestCount = 0;
    for (const entry of filteredEntries) {
        if (typeof entry.URL !== 'string') {
            continue;
        }
        const url = entry.URL.split('?')[0];
        if (url === '/get-diag-log') {
            diagLogRequestCount++;
            continue;
        }
        if (entry.err !== 'None') {
            continue;
        }
        if (!Object.hasOwn(URLxVals, url)) {
            if (urlStatCount >= 500) {
                urlStatsTruncated = true;
                continue;
            }
            URLxVals[url] = { count: 0, took: 0 };
            urlStatCount++;
        }
        URLxVals[url].count++;
        const duration = Number.parseFloat(entry.took);
        if (Number.isFinite(duration)) {
            URLxVals[url].took += duration;
        }
    }
    document.getElementById("diagLogRequestCount").textContent =
        `/get-diag-log requests in selected dates and loaded pages: ${diagLogRequestCount}`;
    var URLcounts = Object.keys(URLxVals).map(key => {
        return URLxVals[key].count;
    });
    var tooks = Object.keys(URLxVals).map(key => {
        return URLxVals[key].took / URLxVals[key].count;
    });


    myURLChart = new Chart(ctxURL, {
        type: "bar",

        data: {
            labels: Object.keys(URLxVals),
            datasets: [{
                label: urlStatsTruncated
                    ? `Successful URLs across ${loadedLogPages.size} loaded page(s)${getVisualizationDateRangeLabel(dateRange)}, first 500 paths`
                    : `Successful URLs across ${loadedLogPages.size} loaded page(s)${getVisualizationDateRangeLabel(dateRange)}`,
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,0,255,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: URLcounts
            }, {
                label: 'Average duration (mS)',
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,255,0,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: tooks
            }]
        },
        options: {
            scales: {
                y: {
                    type: document.getElementById("histogramYAxisScale").value,
                    title: {
                        display: true,
                        text: 'Count / average duration'
                    }
                }
            }
        }
    });
}