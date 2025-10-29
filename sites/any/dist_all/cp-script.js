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


checkifLoggedIn();

fetch("/log/getNodeV")
    .then(res => res.text())
    .then(d => {
        document.getElementById("nodeV").innerHTML =
            `Currently using node: ${d} 
            <br>Tested with node: v22.20.0`;
    });


fetch("/log/systemctl")
    .then(res => res.text())
    .then(d => {
        document.getElementById("systemctl").innerHTML =
            `${d}`;
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
    buildTable(600);
    serverRHist.style.display = 'block';

    fetch("/log/server")
        .then(res => res.text())
        .then(d => {

            serverLog.innerHTML = `<pre>${d}</pre>`;
        });

    fetch("/log/Ips")
        .then(res => res.text())
        .then(d => {
            d = JSON.stringify(JSON.parse(d), null, 2);
            document.getElementById("ipLog").innerHTML = `<pre>${d}</pre>`;
        });


    fetch("/log/userDB")
        .then(res => res.text())
        .then(d => {

            document.getElementById("userDB").innerHTML = `<pre>${d}</pre>`;
        });

    fetch("/log/failedURLs")
        .then(res => res.text())
        .then(d => {

            document.getElementById("failedUrls").innerHTML = `<pre>${d}</pre>`;
        });

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





function buildTable(step) {
    var histogram = {};
    fetch('/log/server')
        .then(res => res.text())
        .then(d => {
            if (d === "You need to be logged in as admin to see this page") {
                alert("Not admin");
                return;
            }
            d = JSON.parse('[' + d.slice(0, -1) + ']');
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
                        data: yValues
                    }]
                }
            });

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
            var counts = Object.keys(URLxVals).map(key => {
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
                        data: counts
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