const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '..', 'app.js');
const dryRun = process.argv.includes('--dry-run');
const pids = [];

for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) {
        continue;
    }

    try {
        const processPath = `/proc/${entry}`;
        const args = fs.readFileSync(`${processPath}/cmdline`, 'utf8').split('\0');

        if (!['node', 'nodejs'].includes(path.basename(args[0])) || !args[1]) {
            continue;
        }

        const workingDirectory = fs.realpathSync(`${processPath}/cwd`);
        if (path.resolve(workingDirectory, args[1]) === appPath) {
            pids.push(entry);
        }
    } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ESRCH' && error.code !== 'EACCES') {
            throw error;
        }
    }
}

if (pids.length === 0) {
    console.log('No nodeServer app.js processes found.');
    process.exit(0);
}

for (const pid of pids) {
    if (dryRun) {
        console.log(`Would stop nodeServer process ${pid}.`);
        continue;
    }

    try {
        process.kill(Number(pid), 'SIGTERM');
        console.log(`Sent SIGTERM to nodeServer process ${pid}.`);
    } catch (error) {
        if (error.code === 'ESRCH') {
            continue;
        }

        console.error(`Could not stop nodeServer process ${pid}: ${error.message}`);
        process.exitCode = 1;
    }
}
