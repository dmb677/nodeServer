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


checkifLoggedIn();

var fetchTime = Date.now();
fetch("/get-diag-data")
    .then(res => res.text())
    .then(d => {
        console.log(`Fetch took ${Date.now() - fetchTime}ms`);
        d = JSON.parse(d);
        //console.log(d);

        UPDATE_nodeV.innerHTML =
            `Currently using node: ${d.Node} 
            <br>Tested with node: v22.20.0`;

        UPDATE_systemctl.innerHTML =
            `<br>${d.command}`;

        serverLog.innerHTML = `<pre>${JSON.stringify(d.log, null, 2)}</pre>`;

        document.getElementById("ipLog").innerHTML = `<pre>${JSON.stringify(d.IPs, null, 2)}</pre>`;

        document.getElementById("userDB").innerHTML = `<pre>${JSON.stringify(d.Users, null, 2)}</pre>`;



        let failedUrls = d.log.filter(d => {
            //console.log(d.URL)
            return d.err === 'URL Not Found\n';
        });
        failedUrls = failedUrls.map(d => {
            return `${d.URL} by ${d.IP}`;
        });

        document.getElementById("failedUrls").innerHTML = `<pre>${JSON.stringify(failedUrls, null, 2)}</pre>`;

        buildTable(600, d.log);
    });



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




}

function showLoggedout() {
    document.getElementById("userVal").value = document.getElementById("userVal").ariaPlaceholder;
    document.getElementById("passVal").value = document.getElementById("passVal").ariaPlaceholder;
    userStatus.style.visibility = 'hidden';
    logOutButton.style.display = 'none';
    loginField.style.display = 'flex';
    serverRHist.style.display = 'none';
}


function checkifLoggedIn() {
    fetch('/auth/isLoggedin')
        .then(res => res.text())
        .then(d => {
            if (d === 'true') {
                showLoggedin();

            } else {
                appendAlert('You Are Not Logged in', 'primary');
                showLoggedout();

            }
        });
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
                    showLoggedin();
                    break;
            }

        });


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

    ret = Number(sec) + 60 * min + 3600 * h + 3600 * 24 * d;
    if (isNaN(ret) || ret <= 0) {
        ret = 60;
    }
    return ret;
}


document.getElementById("updateData").onclick = function () {
    var val = document.getElementById("newStepSize").value;
    val = getSecs(val);
    document.getElementById("newStepSize").value = prettyDate(val * 1000);
    appendAlert(`Histogram updated: ${prettyDate(val * 1000)}`, 'primary');
    buildTable(val);
};



function histogrammer(data, step) {
    min = Math.min(...data);
    max = Math.max(...data);
    const binCount = Math.ceil((max - min) / step);

    // Initialize bins manually
    const histogram = [];
    for (let i = 0; i < binCount; i++) {
        histogram.push({
            binStart: min + i * step,
            binEnd: min + (i + 1) * step,
            count: 0
        });
    }


    // Count values in bins
    for (let value of data) {
        const index = Math.floor((value - min) / step);
        if (index >= 0 && index < binCount) {
            histogram[index].count++;
        }
    }

    return histogram;
}


function buildTable(step, d) {
    var tableDate = Date.now();
    const histogram = histogrammer(d.map(t => t.date), 1*60*1000);
    const counts = histogram.map(d => d.count);
    const dates = histogram.map(d => {
        const timestamp = d.binStart;
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
                label: 'Number of requests',
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,0,255,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: counts,
            }]
        }
    });
    console.log(`Build chart took ${Date.now() - tableDate}ms`);



    const ctxURL = document.getElementById('myURLChart');
    URLxVals = {};
    if (myURLChart) {
        myURLChart.destroy();
    }

    for (let i = 0; i < d.length; i++) {
        if (d[i].err === "None") {
            //(URLxVals[d[i].URL]) ? URLxVals[d[i].URL]++: URLxVals[d[i].URL] = 1;
            var simpleURL = d[i].URL.split("?")[0]; //remove all info after ?
            if (URLxVals[simpleURL]) {
                URLxVals[simpleURL].count++;
                URLxVals[simpleURL].took += Number(d[i].took.slice(0, -2));
            } else {
                URLxVals[simpleURL] = {};
                URLxVals[simpleURL].count = 1;
                URLxVals[simpleURL].took = Number(d[i].took.slice(0, -2));
            }
        }
    }
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
                label: 'URL Hist (counts)',
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,0,255,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: URLcounts
            }, {
                label: 'tooks (average mS)',
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,255,0,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: tooks
            }]
        }
    });
}

/*
    var histogram = {};
    for (let i = 0; i < d.length; i++) {
        var stepped = Math.floor(d[i].date / (step * 1000));
        (histogram[stepped.toString()]) ? histogram[stepped.toString()]++: histogram[stepped.toString()] =
            1;
    }

    var maxStep = Math.max(...Object.keys(histogram).map(Number));
    var minStep = Math.min(...Object.keys(histogram).map(Number));

    for (let i = minStep; i <= maxStep; i++) {
        if (!histogram[i.toString()]) {
            histogram[i.toString()] = 0;
        }
    }

    //////////////////////////////////////////////////////////////////
    // New Binning Method
    ////////////////////////////////////////////////////////////////////////

   


    /*
    const binnedHistogram = d.map(t => t.date).reduce((accumulator, currentValue) => {
        const bin = Math.floor(currentValue / step2) * step2; // Determine the lower bound of the bin
        //const binLabel = `${bin}-${bin + step - 1}`; // Create a label for the bin
        let binLabel = new Date(bin);
        binLabel = binLabel.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        accumulator[binLabel] = (accumulator[binLabel] || 0) + 1;
        return accumulator;
    }, {});

    //sortedEntries = Object.entries(binnedHistogram).sort((a, b) => b[1] - a[1]);
    //console.log(sortedEntries);

*/
/*

    var xValues = Object.keys(histogram);
    for (let i = 0; i < xValues.length; i++) {
        const timestamp = new Date(Number(xValues[i]) * step * 1000);
        xValues[i] = timestamp.toLocaleString('en-US', {
            //weekday: 'short',
            //year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    var yValues = Object.values(histogram);

    

    const ctx = document.getElementById('myChart');
    if (myChart) {
        myChart.destroy();
    }
    myChart = new Chart(ctx, {
        type: "bar",

        data: {
            labels: xValues,
            datasets: [{
                label: 'Number of requests',
                fill: false,
                lineTension: 0.3,
                backgroundColor: "rgba(0,0,255,1.0)",
                borderColor: "rgba(0,0,255,0.1)",
                data: yValues,
            }]
        }
    });

    

}



/*

   

    const alertTrigger = document.getElementById('liveAlertBtn')
    if (alertTrigger) {
        alertTrigger.addEventListener('click', () => {
            appendAlert('Nice, you triggered this alert message!', 'success')
        })
    }
    */