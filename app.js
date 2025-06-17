//Setup
const {
    debug
} = require('console');
const fs = require('fs');


const website = 'sites/' + process.argv[2];
if (!fs.existsSync(website + '/.env')) {
    console.log("no website with .env found named: " + website);
    process.exit();
}
require('dotenv').config({
    path: website + '/.env'
});
var debugDump = (process.argv[3] === 'debug');

const app = require('express')();

const {
    exec
} = require('child_process');


const multer = require('multer');
const path = require('path');

const JSONdb = require('simple-json-db');
const imageLog = new JSONdb(process.env.imagePath + '/imageLog.json');


//check if process.env.imagePath exists
if (!fs.existsSync(process.env.imagePath)) {
    fs.mkdirSync(process.env.imagePath, {
        recursive: true
    });
    console.log(`Directory created at ${process.env.imagePath}`);
} else {
    console.log(`Directory already exists at ${process.env.imagePath}`);
}

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, process.env.imagePath);
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
var upload = multer({
    storage: storage
});

//create session var
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fileStoreOptions = {
    ttl: process.env.sessionLife,
    reapInterval: process.env.clearSessions,
    path: process.env.sessionDB + "/sessions"
};
const sessionVar = session({
    name: process.env.sessionName,
    store: new FileStore(fileStoreOptions),
    secret: process.env.sessionSecret,
    resave: true,
    saveUninitialized: true,
    cookie: {
        sameSite: true,
    }
});

//routes
const authRoutes = require('./routes/auth')(process.env.userDB);
const logRoutes = require('./routes/log')(process.env.LogIPDB, process.env.logfile, process.env.userDB, debugDump);
const gameRoutes = require('./routes/game-routes')(process.env.gameDB);


const port = process.env.port;
const httpdocs = __dirname + '/' + website + '/httpdocs/';
const httpdocsAny = __dirname + '/sites/any';
const ejsDir = [__dirname + '/' + website + '/views', __dirname + '/sites/any'];
const bashDir = __dirname + '/bash';


//set view engine
app.set('view engine', 'ejs');
app.set('views', ejsDir);


app.use(sessionVar);
app.use(logRoutes);
app.use((require('express')).static(httpdocs));
app.use((require('express')).static(httpdocsAny));
app.use((require('express')).static(process.env.imagePath));
app.use('/auth', authRoutes);
app.use('/game', gameRoutes);

/** 
app.get('/upload', async (request, response) => {
    response.sendFile(__dirname + '/upload.html');
});
*/

app.post('/upload', upload.single('file'), (req, res) => {
    //console.log(request.session.id)

    res.json({
        filename: req.file.filename
    });

});

app.use((require('express')).json());
app.post('/upload-log', (req, res) => {

    imageLog.set(Date.now(), {
        "session": req.session.id,
        "caption": req.body.caption,
        "paths": req.body.paths
    });


    res.json({
        filename: "hello-you makd it"
    });

});


app.get('/upload-log-read', (req, res) => {
    res.send(JSON.stringify(imageLog.JSON()));
});

app.post('/upload-log-delete/:del', (req, res) => {
    imageLog.delete(req.params.del);
    res.end();
});


app.get('/', (req, res) => {
    res.render('index');
});

app.get('/b/tag/:id', (req, res, next) => {
    // see if file exits fs.statSync()
    if (true) {
        next();
    } else {
        res.render('btemplate', {
            blogtitle: 'BLOGtitle'
        });
    }
});

app.get('/b/home', (req, res) => {
    res.render('bhome', {
        blogtitle: 'BLOGtitle'
    });
});

app.get('/b/edit', (req, res) => {
    res.render('bedit', {
        blogtitle: 'Editing'
    });
});


//API functions
app.all('/api/:id', (req, res) => {
    exec(`${bashDir}/${req.params.id}.sh`, (err, stdout, stderr) => {
        if (err) {
            console.log(err);
        } else {
            res.send(stdout);
            res.end(); //this is probably redundant
        }
    });
});

app.get('*', (req, res) => {
    var theURL = req.url.replace(/^\//, '').replace(/\.+/g, '');
    res.render(theURL, {}, (err, html) => {
        if (err) {
            req.hasError = true;

            res.render('error', {
                message: req.url
            });
            res.end();
        } else {
            res.send(html);
        }
    });
});



//Start up app
exec('hostname -I', (err, stdout, stderr) => {
    if (err) {
        console.error(err);
    } else {
        app.listen(port, () => {
            console.log(`app listening at http://${stdout.trim()}:${port}`);
        });
    }
});