const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const sitesDir = path.join(rootDir, 'sites');
const startupTimeoutMs = 30_000;
const requestTimeoutMs = 1_500;
const children = [];
const failures = [];
let interrupted = false;

function getSites() {
    return fs.readdirSync(sitesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((site) => fs.existsSync(path.join(sitesDir, site, '.env')))
        .sort();
}

function getPort(site) {
    const envPath = path.join(sitesDir, site, '.env');
    const config = dotenv.parse(fs.readFileSync(envPath));
    const emptyVariables = Object.keys(config).filter((key) => config[key].trim() === '');

    if (emptyVariables.length > 0) {
        throw new Error(`Missing or empty value for environment variable(s) ${emptyVariables.join(', ')} in ${path.relative(rootDir, envPath)}.`);
    }

    const port = Number(config.port);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid or missing port in ${path.relative(rootDir, envPath)}.`);
    }

    return port;
}

function requestSite(port) {
    return new Promise((resolve) => {
        const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: requestTimeoutMs }, (response) => {
            response.resume();
            response.on('end', () => resolve({ statusCode: response.statusCode }));
        });

        request.on('timeout', () => request.destroy(new Error('Request timed out.')));
        request.on('error', (error) => resolve({ error }));
    });
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForListening(child, timeoutMs) {
    return new Promise((resolve) => {
        let output = '';
        let startupError = '';
        const finish = (result) => {
            clearTimeout(timeout);
            child.stdout.removeListener('data', onData);
            child.stderr.removeListener('data', onStderr);
            child.removeListener('exit', onExit);
            child.removeListener('error', onError);
            resolve(result);
        };
        const onData = (chunk) => {
            output = (output + chunk.toString()).slice(-2_000);
            if (output.includes('app listening at http://')) {
                finish({ listening: true });
            }
        };
        const onStderr = (chunk) => {
            if (chunk.toString().includes('EADDRINUSE')) {
                startupError = 'Port is already in use.';
            }
        };
        const onExit = (code, signal) => finish({
            error: startupError || `Server process exited before listening (code ${code}, signal ${signal}).`
        });
        const onError = (error) => finish({ error: `Could not start server: ${error.message}` });
        const timeout = setTimeout(() => finish({ error: 'Server did not start listening in time.' }), timeoutMs);

        child.stdout.on('data', onData);
        child.stderr.on('data', onStderr);
        child.once('exit', onExit);
        child.once('error', onError);
    });
}

async function checkSite(site, port, child) {
    const url = `http://127.0.0.1:${port}/`;
    const deadline = Date.now() + startupTimeoutMs;
    const listening = await waitForListening(child, startupTimeoutMs);

    if (listening.error) {
        return { site, url, error: listening.error };
    }

    while (!interrupted && Date.now() < deadline) {
        const result = await requestSite(port);
        if (result.statusCode !== undefined) {
            if (result.statusCode >= 200 && result.statusCode < 300) {
                return { site, url, statusCode: result.statusCode };
            }

            return { site, url, error: `Root page returned HTTP ${result.statusCode}.` };
        }

        await wait(300);
    }

    return {
        site,
        url,
        error: interrupted ? 'Test interrupted.' : `Server did not respond within ${startupTimeoutMs / 1000} seconds.`
    };
}

async function stopChild(child) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    child.kill('SIGTERM');
    await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        wait(5_000)
    ]);

    if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await new Promise((resolve) => child.once('exit', resolve));
    }
}

async function main() {
    const sites = getSites();
    if (sites.length === 0) {
        throw new Error(`No site .env files found under ${path.relative(rootDir, sitesDir)}.`);
    }

    const checks = [];

    for (const site of sites) {
        let port;
        try {
            port = getPort(site);
        } catch (error) {
            failures.push({ site, url: 'not started', error: error.message });
            continue;
        }

        const child = spawn(process.execPath, ['app.js', site], {
            cwd: rootDir,
            env: { ...process.env, NODE_SERVER_HOST: '127.0.0.1' },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        children.push(child);
        checks.push(checkSite(site, port, child));
    }

    const results = await Promise.all(checks);
    failures.push(...results.filter((result) => result.error));

    for (const result of results) {
        if (!result.error) {
            console.log(`PASS ${result.site}: ${result.url} (HTTP ${result.statusCode})`);
        }
    }

    for (const failure of failures) {
        console.error(`FAIL ${failure.site}: ${failure.url} - ${failure.error}`);
    }

    if (failures.length > 0) {
        console.error('\nPrompt to apply:');
        console.error([
            'Diagnose and fix the following failing site startup/HTTP smoke checks in this repository.',
            'Make the smallest appropriate code or configuration changes, preserve existing behavior for passing sites,',
            'and rerun `npm test` to verify the fixes. Explain the root cause and summarize the changes.',
            '',
            ...failures.map((failure) => `- ${failure.site} (${failure.url}): ${failure.error}`)
        ].join('\n'));
        process.exitCode = 1;
    } else {
        console.log(`All ${results.length} site(s) passed.`);
    }
}

process.on('SIGINT', () => {
    interrupted = true;
});
process.on('SIGTERM', () => {
    interrupted = true;
});

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await Promise.all(children.map(stopChild));
    });
