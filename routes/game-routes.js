module.exports = function (gamerDBpath) {
    const express = require('express');
    const router = express.Router();
    const gamerDB = new (require('simple-json-db'))(gamerDBpath);

    router.post('/saveScore', (req, res) => {
        const name = String(req.body?.name || 'Anonymous');
        const score = Number(req.body?.score || 0);

        const scoreLog = gamerDB.has('scoreboard') ? gamerDB.get('scoreboard') : [];
        scoreLog.push({
            name,
            score,
            date: new Date().toISOString()
        });
        gamerDB.set('scoreboard', scoreLog);

        res.json({ ok: true });
    });

    router.get('/scores', (req, res) => {
        const savedScores = gamerDB.has('scoreboard') ? gamerDB.get('scoreboard') : [];
        const sortedScores = savedScores
            .slice()
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

        res.render('scores', { scores: sortedScores });
    });

    router.get('/sign/:user', (req, res) => {
        req.session.gameUser = req.params.user;
        res.end();
    });
    
    router.get('/getGameUser', (req, res) => {
        res.send(req.session.gameUser);
    });
    
    router.get('/score/:finalScore', (req, res) => {
        const date = new Date();
        var newScore;
    
        if (gamerDB.has(req.params.finalScore)) {
            newScore = (gamerDB.get(req.params.finalScore));
        } else {
            newScore = [];
        }
        newScore.push({
            "date": date,
            "user": req.session.gameUser
        });
        gamerDB.set(req.params.finalScore, newScore);
    
        var fullData = gamerDB.JSON();
        var keys = Object.keys(fullData);
        for (i = 0; i < keys.length; i++) {
            if (keys[i] == req.params.finalScore) {
    
                break;
            }
        }
    
        //need to check if there are more than one person better/worse
        //need to check if nobody is better or worse
    
        if (i == (keys.length - 1)) {
            ret = {
                "place": (keys.length - i),
            };
        } else {
            var ret = {
                "place": (keys.length - i),
                "better": {
                    "time": keys[i - 1],
                    "user": fullData[keys[i - 1]][0].user,
                    "date": fullData[keys[i - 1]][0].date
                },
                "worse": {
                    "time": keys[i + 1],
                    "user": fullData[keys[i + 1]][0].user,
                    "date": fullData[keys[i + 1]][0].date
                }
            };
        }
        res.send(JSON.stringify(ret));
    
    });
    return router;
};