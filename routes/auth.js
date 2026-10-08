module.exports = function (userDBpath) {
    const express = require('express');
    const router = express.Router();
    const JSONdb = require('simple-json-db');
    const UserDB = new JSONdb(userDBpath);

    router.use(express.urlencoded({
        extended: 'false'
    }));

    router.use(express.json());

    router.get('/logout', function (req, res, next) {
        req.session.user = null;
        req.session.save(function (err) {
            if (err) next(err);
            req.session.regenerate(function (err) {
                if (err) next(err);
                res.end();
            });
        });
    });

    router.get('/isLoggedin', (req, res, next) => {
        (req.session.user) ? res.send(true): res.send(false);
    });
    router.get('/getUsername', (req, res, next) => {
        (req.session.user) ? res.send(req.session.user): res.send(null);
    });
    router.get('/isAdmin', (req, res, next) => {
        if (req.session.user) {
            res.send(UserDB.get(req.session.user).admin.toString());
        } else {
            res.send("false");
        }
    });

    const defaultPreferences = {
        durationMinutes: 10,
        intervalMinutes: 5,
        startDelaySeconds: 0,
        startSound: 'bell',
        intervalSound: 'bell',
        finishSound: 'bell',
        theme: 'light'
    };
    const allowedIntervals = new Set([0, 1, 2, 3, 5, 10, 15]);
    const allowedSounds = new Set([
        'bell', 'chime', 'bowl', 'woodblock', 'crystal', 'pulse', 'flute', 'waterdrop', 'gong', 'none'
    ]);
    const allowedThemes = new Set(['light', 'sage', 'forest', 'dark', 'midnight', 'aurora', 'black', 'high-contrast']);

    router.get('/preferences', (req, res) => {
        const username = req.session.user;
        if (!username || !UserDB.has(username)) {
            return res.status(401).json({ error: "Sign in to load your settings." });
        }

        const user = UserDB.get(username);
        const storedPreferences = user.preferences || {};
        const theme = allowedThemes.has(storedPreferences.theme) ? storedPreferences.theme : defaultPreferences.theme;
        const preferences = {
            durationMinutes: Number.isInteger(storedPreferences.durationMinutes) &&
                storedPreferences.durationMinutes >= 1 && storedPreferences.durationMinutes <= 180
                ? storedPreferences.durationMinutes
                : defaultPreferences.durationMinutes,
            intervalMinutes: allowedIntervals.has(storedPreferences.intervalMinutes)
                ? storedPreferences.intervalMinutes
                : defaultPreferences.intervalMinutes,
            startDelaySeconds: Number.isInteger(storedPreferences.startDelaySeconds) &&
                storedPreferences.startDelaySeconds >= 0 && storedPreferences.startDelaySeconds <= 60
                ? storedPreferences.startDelaySeconds
                : defaultPreferences.startDelaySeconds,
            startSound: allowedSounds.has(storedPreferences.startSound)
                ? storedPreferences.startSound
                : defaultPreferences.startSound,
            intervalSound: allowedSounds.has(storedPreferences.intervalSound)
                ? storedPreferences.intervalSound
                : defaultPreferences.intervalSound,
            finishSound: allowedSounds.has(storedPreferences.finishSound)
                ? storedPreferences.finishSound
                : defaultPreferences.finishSound,
            theme
        };

        if (storedPreferences.durationMinutes !== preferences.durationMinutes ||
            storedPreferences.intervalMinutes !== preferences.intervalMinutes ||
            storedPreferences.startDelaySeconds !== preferences.startDelaySeconds ||
            storedPreferences.startSound !== preferences.startSound ||
            storedPreferences.intervalSound !== preferences.intervalSound ||
            storedPreferences.finishSound !== preferences.finishSound ||
            storedPreferences.theme !== preferences.theme) {
            user.preferences = preferences;
            UserDB.set(username, user);
        }

        res.json(preferences);
    });

    router.put('/preferences', (req, res) => {
        const username = req.session.user;
        if (!username || !UserDB.has(username)) {
            return res.status(401).json({ error: "Sign in to save your settings." });
        }

        const {
            durationMinutes,
            intervalMinutes,
            startDelaySeconds,
            startSound,
            intervalSound,
            finishSound,
            theme
        } = req.body || {};
        if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
            return res.status(400).json({ error: "Meditation length must be between 1 and 180 minutes." });
        }
        if (!Number.isInteger(intervalMinutes) || !allowedIntervals.has(intervalMinutes)) {
            return res.status(400).json({ error: "Choose a supported bell interval." });
        }
        if (!Number.isInteger(startDelaySeconds) || startDelaySeconds < 0 || startDelaySeconds > 60) {
            return res.status(400).json({ error: "Starting pause must be between 0 and 60 seconds." });
        }
        if (![startSound, intervalSound, finishSound].every(sound => allowedSounds.has(sound))) {
            return res.status(400).json({ error: "Choose a supported meditation sound." });
        }
        if (!allowedThemes.has(theme)) {
            return res.status(400).json({ error: "Choose a supported theme." });
        }

        const user = UserDB.get(username);
        user.preferences = {
            durationMinutes,
            intervalMinutes,
            startDelaySeconds,
            startSound,
            intervalSound,
            finishSound,
            theme
        };
        UserDB.set(username, user);
        res.json(user.preferences);
    });

    router.get('/meditations', (req, res) => {
        const username = req.session.user;
        if (!username || !UserDB.has(username)) {
            return res.status(401).json({ error: "Sign in to view your meditation history." });
        }

        const user = UserDB.get(username);
        const history = Array.isArray(user.meditationHistory) ? user.meditationHistory : [];
        res.json(history);
    });

    router.post('/meditations', (req, res) => {
        const username = req.session.user;
        if (!username || !UserDB.has(username)) {
            return res.status(401).json({ error: "Sign in to save your meditation history." });
        }

        const { durationMinutes } = req.body || {};
        if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
            return res.status(400).json({ error: "Meditation length must be between 1 and 180 minutes." });
        }

        const user = UserDB.get(username);
        const history = Array.isArray(user.meditationHistory) ? user.meditationHistory : [];
        const meditation = {
            durationMinutes,
            completedAt: new Date().toISOString()
        };
        history.unshift(meditation);
        user.meditationHistory = history;
        UserDB.set(username, user);
        res.status(201).json(meditation);
    });

    router.delete('/meditations', (req, res) => {
        const username = req.session.user;
        if (!username || !UserDB.has(username)) {
            return res.status(401).json({ error: "Sign in to clear your meditation history." });
        }

        const user = UserDB.get(username);
        user.meditationHistory = [];
        UserDB.set(username, user);
        res.json({ ok: true });
    });


    //**old CP*/
    router.post("/signin", (req, res) => {
        const {
            name,
            password
        } = req.body;
        if (UserDB.has(name)) {
            if (UserDB.get(name).password === password) {
                req.session.regenerate(function (err) {
                    if (err) next(err);
                    req.session.user = name;
                    req.session.admin = UserDB.get(req.session.user).admin;
                    req.session.save(function (err) {
                        if (err) return next(err);
                        res.redirect("/");
                    });
                });

            } else {
                res.render("auth/login", {
                    Message: "Incorrect Password for: ",
                    Username: name
                });
            }
        } else {
            res.render("auth/login", {
                Message: "Username cannot be found: ",
                Username: name
            });
        }
    });

    //** New CP */
    router.post("/quick-signin", (req, res) => {
        const {
            user,
            password
        } = req.body;
        if (UserDB.has(user)) {
            if (UserDB.get(user).password === password) {
                req.session.regenerate(function (err) {
                    if (err) next(err);
                    req.session.user = user;
                    req.session.admin = UserDB.get(req.session.user).admin;
                    req.session.save(function (err) {
                        if (err) return next(err);
                        res.send("You Are logged IN");
                    });
                });

            } else {
                res.send("Incorrect Password");
            }
        } else {
            res.send("User Cannot be Found");
        }

    });

    router.post("/signup", (req, res) => {
        let message = null;

        if (!req.body.username) {
            message = "Please enter a username";
        } else if (UserDB.has(req.body.username)) {
            message = "This username already exists";
        } else if (!req.body.email) {
            message = "No email entered";
        } else if (!req.body.password) {
            message = "Please enter a password";
        } else if (req.body.password !== req.body.passwordretype) {
            message = "Passwords don't match";
        }
        if (message) {
            res.render("auth/signup", {
                Message: message
            });
        } else {
            let userdata = {
                "name": req.body.username,
                "email": req.body.email,
                "password": req.body.password,
                "admin": false
            };
            UserDB.set(req.body.username, userdata);
            req.session.user = req.body.username;
            req.session.admin = false;
            req.session.save(function (err) {
                if (err) return next(err);
                res.send("you did it <a href ='/'>HOME</a>");
            });
        }
    });

    router.get("/forgotPassword", (req, res) => {
        res.send("sorry can't help with that");
    });

    //Uses a regular expression to match everything that doesn't have a period
    router.get(/^[^.]*$/, (req, res, next) => {
        res.render("auth" + req.url, {}, function (err, html) {
            if (err) {
                next();
            } else {
                res.send(html);
            }
        });
    });

    return router;
};