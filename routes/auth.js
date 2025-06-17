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