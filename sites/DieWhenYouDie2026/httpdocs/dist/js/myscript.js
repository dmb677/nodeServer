var txt = ["<p>"]
    .concat("Sitting in the Snow".split(""))
    .concat("</p>")
    .concat("<p class='wait'>")
    .concat("Watching the setting sun and the little beauty this world has to offer.".split(""))
    .concat("</p>")
    .concat("<p class='wait'>")
    .concat("And just thinking...".split(""))
    .concat("</p>");

var txt2 = []
    .concat("<div id='grow'>")
    .concat("I WISH I WAS NEVER BORN!".split(""))
    .concat("</div>");

var cursor = ["<span class='blink'>|</span>"];

var speedArray = {
    startType: 1000,
    type: 100,
    slowType: 300,
    paragraph: 1500,
    grow: 250,
    dieText: 500,
    delay: 1500
};

function typeWriter2(currentTxt, elementID, idx, speedtxt, callback) {

    switch (speedtxt) {
        case "type":
            speed = speedArray["type"];
            break;
        case "slowType":
            speed = speedArray["slowType"];
            break;
        default:
            speed = 0;
    }

    if (idx < currentTxt.length - 1) {
        (currentTxt[idx + 2] === "<p class='wait'>") ? thisSpeed = speedArray.paragraph: thisSpeed = speed;
        idx++;
        document.getElementById(elementID).innerHTML = currentTxt.slice(0, idx).join("") + cursor;
        setTimeout(function () {
            typeWriter2(currentTxt, elementID, idx, speedtxt, callback);
        }, thisSpeed);
    } else {
        document.getElementById(elementID).innerHTML = currentTxt.slice(0, idx).join("");
        callback();
    }
}

function beginAnimation() {

    //add event listeners
    document.getElementById("fastForward").onclick = function () {
        Object.keys(speedArray).forEach(key => {
            speedArray[key] = 0;
        });
    };

    setInterval(function () {
        var blinkText = document.getElementsByClassName("blink");
        for (var i = 0; i < blinkText.length; i++) {
            blinkText[i].style.visibility = (blinkText[i].style.visibility === 'hidden' ? '' : 'hidden');
        }
    }, 357);

    setTimeout(function () {
        typeWriter2(txt, "demo", 0, "type", function () {
            setTimeout(function () {
                typeWriter2(txt2, "demo2", 0, "slowType", function () {
                    var growText = document.getElementById("grow");
                    setTimeout(function () {
                        growText.classList.add("nervous");
                    }, speedArray.grow);
                    var dieText = document.getElementById("dieWhenYouDie");
                    setTimeout(function () {
                        dieText.style.display = 'block';
                        document.getElementById("fastForward").remove();
                    }, speedArray.dieText);

                });
            }, speedArray.delay);
        });

    }, speedArray.startType);

}