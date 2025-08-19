var myGamePiece;
var myScore;
var myObstacles = [];
var gamePlayer = null;
var playerName;


var myGameArea = {
    canvas: document.createElement("canvas"),
    create: function (height, width) {
        //this.canvas.width = width;
        //this.canvas.height = height;
        this.context = this.canvas.getContext("2d");
        $("#myCanvas").append(this.canvas);
    },
    start: function () {
        if (this.interval) {
            this.stop();
        }
        this.controls = true;
        this.frameNo = 0;
        this.interval = setInterval(updateGameArea, 20);
    },
    clear: function () {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },
    stop: function () {
        clearInterval(this.interval);
    },
    startEndAnimation: function () {
        this.controls = false;
        var finalScore = myGameArea.frameNo;
        $.get("/game/score/" + finalScore, function (data) {
            var dobj = JSON.parse(data);
            gameOver = new component("30px", "Consolas", "black", myGameArea.canvas.width / 4,
                myGameArea.canvas
                .height,
                "text");
            gameOver.text = "GAME OVER";
            gameOver.speedY = -1;
            gameOver.gravity = 0;
            worstPlace = new component("30px", "Consolas", "black", myGameArea.canvas.width / 4,
                myGameArea.canvas
                .height + 50, "text");
            if (dobj.worse) {
                worstPlace.text = dobj.place - 1 + ": " + dobj.worse.user + " scored " + dobj.worse
                    .time;
            } else {
                worstPlace.text = "Congratulations";
            }
            worstPlace.speedY = -1;
            worstPlace.gravity = 0;
            gamePlace = new component("30px", "Consolas", "Red", myGameArea.canvas.width / 4, myGameArea
                .canvas
                .height + 100, "text");
            gamePlace.text = dobj.place + ": " + gamePlayer + ": Final Score: " + finalScore;
            gamePlace.speedY = -1;
            gamePlace.gravity = 0;
            bestPlace = new component("30px", "Consolas", "black", myGameArea.canvas.width / 4,
                myGameArea.canvas
                .height + 150, "text");
            if (dobj.better) {
                bestPlace.text = dobj.place + 1 + ": " + dobj.better.user + " scored " + dobj.better
                    .time;
            } else {
                bestPlace.text = "NEW HIGH SCORE!!!!";
            }
            bestPlace.speedY = -1;
            bestPlace.gravity = 0;
            myGameArea.gameFrameNo = 0;
            myGameArea.gameOverAnimation = setInterval(gameEndAnimation, 20);
        });
    }
};

function startGame() {
    myGamePiece = new component(80, 80, "/dist/img/isaacHead.png", 50, 50, "image");
    myScore = new component("30px", "Consolas", "black", 280, 40, "text");
    myGameArea.create(500, 1000);
    playerName = new component("30px", "Consolas", "black", 10, 40, "text");
}

function component(width, height, color, x, y, type) {
    this.type = type;
    if (type == "image") {
        this.image = new Image();
        this.image.src = color;
    }
    this.width = width;
    this.height = height;
    this.speedX = 0;
    this.speedY = 0;
    this.x = x;
    this.y = y;
    this.rotate = 0;
    this.gravity = 0.05;
    this.gravitySpeed = 0;
    this.bounce = 0.6;
    this.sink = false;
    this.update = function () {
        ctx = myGameArea.context;
        if (type == "image") {
            ctx.translate(this.x, this.y);
            ctx.rotate((this.rotate * Math.PI) / 180);
            ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.rotate((-this.rotate * Math.PI) / 180);
            ctx.translate(-this.x, -this.y);
        }
        if (type == "text") {
            ctx.font = this.width + " " + this.height;
            ctx.fillStyle = color;
            ctx.fillText(this.text, this.x, this.y);

        }
        if (type == "shape") {
            ctx.fillStyle = color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

    };
    this.newPos = function () {
        this.gravitySpeed += this.gravity;
        this.gravitySpeed = (this.gravitySpeed > 10) ? 10 : this.gravitySpeed;
        this.gravitySpeed = (this.gravitySpeed < -10) ? -10 : this.gravitySpeed;
        this.x += this.speedX;
        this.y += this.speedY + this.gravitySpeed;
        this.hit();
    };
    this.hit = function () {
        var rockbottom = myGameArea.canvas.height - this.height / 2;
        if ((this.y > rockbottom) && !this.sink) {
            this.y = rockbottom;
            this.gravitySpeed = -(this.gravitySpeed * this.bounce);
        }
        var top = this.width / 2;
        if (this.y < top) {
            this.y = top;
            this.gravitySpeed = -(this.gravitySpeed * this.bounce);
        }
        var left = this.width / 2;
        if (this.x < left) {
            this.x = left;
            this.speedX = -(this.speedX * this.bounce);
            this.rotate -= 10;

        }
        var right = myGameArea.canvas.width - this.width / 2;
        if (this.x > right) {
            this.x = right;
            this.speedX = -(this.speedX * this.bounce);
            this.rotate += 10;
        }
    };
    this.crashWith = function (otherobj) {
        var myleft = this.x - (this.width / 2);
        var myright = this.x + (this.width / 2);
        var mytop = this.y - (this.height / 2);
        var mybottom = this.y + (this.height / 2);
        var otherleft = otherobj.x;
        var otherright = otherobj.x + (otherobj.width);
        var othertop = otherobj.y;
        var otherbottom = otherobj.y + (otherobj.height);
        var crash = true;
        if ((mybottom < othertop) || (mytop > otherbottom) || (myright < otherleft) || (myleft > otherright)) {
            crash = false;
        }
        return crash;
    };
    this.kill = function () {
        this.rotate = 180;
        myGamePiece.image.src = "/dist/img/isaacDead.png";
        myGamePiece.gravitySpeed = -1;
        myGamePiece.gravity = 0.05;
        myGamePiece.speedX = 0;
        myGamePiece.sink = true;
    };
}

function updateGameArea() {
    var x, height, gap, minHeight, maxHeight, minGap, maxGap;
    myGameArea.clear();
    for (i = 0; i < myObstacles.length; i += 1) {
        if (myGamePiece.crashWith(myObstacles[i])) {
            myGamePiece.kill();
            myGameArea.stop();
            myGameArea.startEndAnimation();
        }
    }
    myGameArea.frameNo++;

    if (myGameArea.frameNo == 1 || everyinterval(500)) {
        x = myGameArea.canvas.width;
        minHeight = 20;
        maxHeight = 200;
        height = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
        minGap = 100;
        maxGap = 1000;
        gap = Math.floor(Math.random() * (maxGap - minGap + 1) + minGap);
        myObstacles.push(new component(10, height, "green", x, 0, "shape"));
        myObstacles.push(new component(10, x - height - gap, "green", x, height + gap, "shape"));
    }

    for (i = 0; i < myObstacles.length; i += 1) {
        myObstacles[i].x += -1;
        myObstacles[i].update();
    }
    myGamePiece.newPos();
    myScore.text = "SCORE: " + myGameArea.frameNo;
    myScore.update();
    myGamePiece.update();
    playerName.update();

    $.get('/game/getGameUser', function (data) {
        //console.log(data);
        playerName.text = data;
        

    });

}


function everyinterval(n) {
    if ((myGameArea.frameNo / n) % 1 == 0) {
        return true;
    }
    return false;
}

function moveup() {
    if (myGameArea.controls) {
        myGamePiece.gravity = -0.2;
        myGamePiece.image.src = "/dist/img/isaacBlink.png";
    }
}

function moveleft() {
    if (myGameArea.controls) {
        myGamePiece.speedX += -1;
    }
}

function moveright() {
    if (myGameArea.controls) {
        myGamePiece.speedX += 1;
    }
}

function clearThrust() {
    if (myGameArea.controls) {
        myGamePiece.gravity = 0.05;
        myGamePiece.image.src = "/dist/img/isaacHead.png";
    }
}




function gameEndAnimation() {
    myGameArea.gameFrameNo += 1;
    myGameArea.clear();
    gameOver.newPos();
    myGamePiece.newPos();
    worstPlace.newPos();
    bestPlace.newPos();
    gamePlace.newPos();
    for (i = 0; i < myObstacles.length; i += 1) {
        myObstacles[i].update();
    }
    myScore.update();
    myGamePiece.update();
    gamePlace.update();
    gameOver.update();
    bestPlace.update();
    worstPlace.update();
    if (myGameArea.gameFrameNo > 200) {
        clearInterval(myGameArea.gameOverAnimation);
        appendAlert(introMessage, 'warning');
        $("#submitButton").click(checkUser);
    }

}