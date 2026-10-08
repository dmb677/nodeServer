//Setup
const pkg = require('./package.json');
const fs = require('fs');
const os = require('os');
const path = require('path');

const website = 'sites/' + process.argv[2];
if (!fs.existsSync(website + '/.env')) {
    console.log("no website with .env found named: " + website);
    process.exit();
}
require('dotenv').config({
    path: website + '/.env',
    quiet: true
});

const configuredDirectories = [
    process.env.sessionDB,
    process.env.LogIPDB,
    process.env.imagePath,
    process.env.userDB && path.dirname(process.env.userDB),
    process.env.logfile && path.dirname(process.env.logfile),
    process.env.gameDB && path.dirname(process.env.gameDB),
    process.env.fortunesDB && path.dirname(process.env.fortunesDB)
].filter(Boolean);

for (const directory of new Set(configuredDirectories)) {
    if (fs.existsSync(directory)) {
        if (!fs.statSync(directory).isDirectory()) {
            console.error(`Configured storage path is not a directory: ${directory}`);
            process.exit(1);
        }
        console.log(`Directory already exists at ${directory}`);
        continue;
    }

    try {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`Directory created at ${directory}`);
    } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            console.error(`Insufficient permissions to create directory ${directory}: ${error.message}`);
        } else {
            console.error(`Could not create directory ${directory}: ${error.message}`);
        }
        process.exit(1);
    }
}

const app = require('express')();
const exec = require('util').promisify(require('child_process').exec);
const multer = require('multer');
const JSONdb = require('simple-json-db');
const imageLog = new JSONdb(process.env.imagePath + '/imageLog.json');


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
const logRoutes = require('./routes/log')({
    IPPath: process.env.LogIPDB,
    logFilePath: process.env.logfile,
    userDBpath: process.env.userDB,
    deleteLogOnRestart: process.env.deleteLogOnRestart,
    servicename: process.env.servicename
});
const gameRoutes = require('./routes/game-routes')(process.env.gameDB);
const fortuneRoutes = process.env.fortunesDB
    ? require('./routes/fortune')(process.env.fortunesDB)
    : null;

const port = process.env.port;
const httpdocs = __dirname + '/' + website + '/httpdocs/';
const httpdocsAny = __dirname + '/sites/any';
const ejsDir = [__dirname + '/' + website + '/views', __dirname + '/sites/any'];
const bashDir = __dirname + '/bash';


//set view engine
app.set('view engine', 'ejs');
app.set('views', ejsDir);

//reject invalid URLs
app.use((req, res, next) => {
    if (req.url.charAt(0) !== '/') {
        return res.status(400).send('Invalid URL');
    }
    next(); //continue is 
});



app.use(sessionVar);
app.use(logRoutes);
app.use((require('express')).json());
app.use((require('express')).static(httpdocs));
app.use((require('express')).static(httpdocsAny));
app.use((require('express')).static(process.env.imagePath));
app.use('/auth', authRoutes);
app.use('/game', gameRoutes);
if (fortuneRoutes) {
    app.use('/f', fortuneRoutes);
}
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


app.get('/', (req, res) => {
    res.render('index');
});


app.use((req, res) => {
    var theURL = req.url.replace(/^\//, '').replace(/\.+/g, '');
    res.render(theURL, {}, (err, html) => {
        if (err) {
            req.hasError = true;
            res.status(404).render('error', {
                message: req.url
            });
        } else {
            res.send(html);
        }
    });
});

//Start up app
const onListening = () => {
    console.log(
        `node requirements: ${pkg.engines.node}\nnode version: ${process.version}`);

    console.log(`app listening at http://${os.hostname()}:${port}`);
};

if (process.env.NODE_SERVER_HOST) {
    app.listen(port, process.env.NODE_SERVER_HOST, onListening);
} else {
    app.listen(port, onListening);
}