(() => {
    const loginPanel = document.getElementById("login-panel");
    const timerPanel = document.getElementById("timer-panel");
    const loginLink = document.getElementById("account-link");
    const logoutButton = document.getElementById("logout-button");
    const settingsButton = document.getElementById("settings-button");
    const settingsDialog = document.getElementById("settings-dialog");
    const meditationActiveDialog = document.getElementById("meditation-active-dialog");
    const closeSettingsButton = document.getElementById("close-settings-button");
    const closeMeditationActiveDialog = document.getElementById("close-meditation-active-dialog");
    const dismissMeditationActiveDialog = document.getElementById("dismiss-meditation-active-dialog");
    const saveSettingsButton = document.getElementById("save-settings-button");
    const cancelSettingsButton = document.getElementById("cancel-settings-button");
    const restoreDefaultsButton = document.getElementById("restore-defaults-button");
    const installButton = document.getElementById("install-button");
    const welcomeUser = document.getElementById("welcome-user");
    const errorMessage = document.getElementById("app-error");
    const durationInput = document.getElementById("duration-input");
    const startDelayInput = document.getElementById("start-delay-input");
    const intervalInput = document.getElementById("interval-input");
    const themeInput = document.getElementById("theme-input");
    const startSoundInput = document.getElementById("start-sound-input");
    const intervalSoundInput = document.getElementById("interval-sound-input");
    const finishSoundInput = document.getElementById("finish-sound-input");
    const settingsStatus = document.getElementById("settings-status");
    const timeDisplay = document.getElementById("time-display");
    const timerCaption = document.getElementById("timer-caption");
    const sessionMessage = document.getElementById("session-message");
    const historyStatus = document.getElementById("history-status");
    const historyList = document.getElementById("history-list");
    const progressRing = document.getElementById("progress-ring");
    const intervalTrack = document.getElementById("interval-track");
    const intervalProgressRing = document.getElementById("interval-progress-ring");
    const startDelayTrack = document.getElementById("start-delay-track");
    const startDelayProgressRing = document.getElementById("start-delay-progress-ring");
    const startButton = document.getElementById("start-button");
    const pauseButton = document.getElementById("pause-button");
    const resetButton = document.getElementById("reset-button");
    const zenModeButton = document.getElementById("zen-mode-button");
    const sessionRingRadius = 108;
    const intervalRingRadius = 100;
    const startDelayRingRadius = 92;
    const sessionRingCircumference = 2 * Math.PI * sessionRingRadius;
    const intervalRingCircumference = 2 * Math.PI * intervalRingRadius;
    const startDelayRingCircumference = 2 * Math.PI * startDelayRingRadius;
    let installPrompt;

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js").catch(error => {
            console.error("Service worker registration failed:", error);
        });
    }

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = false;
    });

    installButton.addEventListener("click", async () => {
        if (!installPrompt) {
            return;
        }

        installButton.disabled = true;
        try {
            await installPrompt.prompt();
            await installPrompt.userChoice;
        } catch (error) {
            console.error("App installation prompt failed:", error);
            showError("We couldn't start the app installation. Please try again.");
        } finally {
            installPrompt = null;
            installButton.hidden = true;
            installButton.disabled = false;
        }
    });

    window.addEventListener("appinstalled", () => {
        installPrompt = null;
        installButton.hidden = true;
    });

    progressRing.style.strokeDasharray = `${sessionRingCircumference}`;
    intervalProgressRing.style.strokeDasharray = `${intervalRingCircumference}`;
    startDelayProgressRing.style.strokeDasharray = `${startDelayRingCircumference}`;

    let audioContext;
    let timerId;
    let startDelayTimerId;
    let startDelayDeadline = 0;
    let startDelayDurationSeconds = 0;
    let displayedStartDelaySeconds;
    let deadline = 0;
    let durationSeconds = 600;
    let remainingSeconds = durationSeconds;
    let elapsedBeforePause = 0;
    let nextBellSeconds = 0;
    let isRunning = false;
    const defaultPreferences = {
        durationMinutes: 10,
        startDelaySeconds: 5,
        intervalMinutes: 5,
        startSound: "bell",
        intervalSound: "bell",
        finishSound: "bell",
        theme: "light"
    };
    let savedPreferences = { ...defaultPreferences };
    let settingsSaveInProgress = false;

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
    }

    function clearError() {
        errorMessage.textContent = "";
        errorMessage.hidden = true;
    }

    async function readSession() {
        const response = await fetch("/auth/isLoggedin");
        if (!response.ok) {
            throw new Error("Could not check your sign-in status.");
        }
        const loggedIn = await response.json();

        if (!loggedIn) {
            loginPanel.hidden = false;
            timerPanel.hidden = true;
            loginLink.hidden = false;
            logoutButton.hidden = true;
            settingsButton.hidden = true;
            welcomeUser.textContent = "";
            return;
        }

        const userResponse = await fetch("/auth/getUsername");
        if (!userResponse.ok) {
            throw new Error("Could not load your account.");
        }
        const username = await userResponse.text();
        try {
            await loadPreferences();
        } catch (error) {
            console.error("Could not load saved meditation settings:", error);
            settingsStatus.textContent = "We couldn't load saved settings. You can still adjust them for this session.";
        }
        loginPanel.hidden = true;
        timerPanel.hidden = false;
        loginLink.hidden = true;
        logoutButton.hidden = false;
        settingsButton.hidden = false;
        welcomeUser.textContent = username ? `Hello, ${username}` : "";
        loadMeditationHistory().catch(error => {
            console.error("Could not load meditation history:", error);
            historyStatus.textContent = "We couldn't load your meditation history.";
        });
    }

    async function loadMeditationHistory() {
        const response = await fetch("/auth/meditations");
        if (!response.ok) {
            throw new Error(`Loading meditation history failed with HTTP ${response.status}.`);
        }

        const history = await response.json();
        if (history.length === 0) {
            historyList.replaceChildren();
            historyStatus.textContent = "Completed sessions will appear here.";
            return;
        }

        historyStatus.textContent = `${history.length} completed meditation${history.length === 1 ? "" : "s"}.`;
        const historyItems = document.createDocumentFragment();
        history.forEach(meditation => {
            const item = document.createElement("li");
            const completedAt = new Date(meditation.completedAt);
            const dateText = Number.isNaN(completedAt.getTime())
                ? "Date unavailable"
                : completedAt.toLocaleString();
            item.textContent = `${dateText} · ${meditation.durationMinutes} minute${meditation.durationMinutes === 1 ? "" : "s"}`;
            historyItems.append(item);
        });
        historyList.replaceChildren(historyItems);
    }

    async function loadPreferences() {
        const response = await fetch("/auth/preferences");
        if (!response.ok) {
            throw new Error(`Loading settings failed with HTTP ${response.status}.`);
        }
        const preferences = await response.json();
        savedPreferences = { ...defaultPreferences, ...preferences };
        setFormPreferences(savedPreferences);
        durationSeconds = savedPreferences.durationMinutes * 60;
        remainingSeconds = durationSeconds;
        nextBellSeconds = savedPreferences.intervalMinutes * 60;
        renderTime(remainingSeconds);
    }

    function applyTheme(theme) {
        const themes = new Set(["light", "sage", "forest", "dark", "midnight", "aurora", "black", "high-contrast"]);
        const resolvedTheme = themes.has(theme) ? theme : "light";
        document.body.dataset.theme = resolvedTheme;
        document.documentElement.style.colorScheme = ["light", "sage", "high-contrast"].includes(resolvedTheme) ? "light" : "dark";
        if (themeInput) {
            themeInput.value = resolvedTheme;
        }
    }

    function getFormPreferences() {
        return {
            durationMinutes: Number(durationInput.value),
            startDelaySeconds: Number(startDelayInput.value),
            intervalMinutes: Number(intervalInput.value),
            startSound: startSoundInput.value,
            intervalSound: intervalSoundInput.value,
            finishSound: finishSoundInput.value,
            theme: themeInput ? themeInput.value : "light"
        };
    }

    function setFormPreferences(preferences) {
        durationInput.value = String(preferences.durationMinutes);
        startDelayInput.value = String(preferences.startDelaySeconds);
        intervalInput.value = String(preferences.intervalMinutes);
        startSoundInput.value = preferences.startSound;
        intervalSoundInput.value = preferences.intervalSound;
        finishSoundInput.value = preferences.finishSound;
        themeInput.value = preferences.theme;
        applyTheme(preferences.theme);
        if (!isRunning && elapsedBeforePause === 0) {
            durationSeconds = preferences.durationMinutes * 60;
            remainingSeconds = durationSeconds;
            nextBellSeconds = preferences.intervalMinutes * 60;
            renderTime(remainingSeconds);
            renderStartDelay(0);
        }
    }

    function validateSettings(preferences) {
        if (!Number.isInteger(preferences.durationMinutes) ||
            preferences.durationMinutes < 1 || preferences.durationMinutes > 180) {
            durationInput.setAttribute("aria-invalid", "true");
            settingsStatus.textContent = "Meditation length must be between 1 and 180 minutes.";
            durationInput.focus();
            return false;
        }
        if (!Number.isInteger(preferences.startDelaySeconds) ||
            preferences.startDelaySeconds < 0 || preferences.startDelaySeconds > 60) {
            startDelayInput.setAttribute("aria-invalid", "true");
            settingsStatus.textContent = "Starting pause must be between 0 and 60 seconds.";
            startDelayInput.focus();
            return false;
        }
        return true;
    }

    async function savePreferences() {
        if (settingsSaveInProgress) {
            return;
        }
        const preferences = getFormPreferences();
        if (!validateSettings(preferences)) {
            return;
        }

        settingsSaveInProgress = true;
        saveSettingsButton.disabled = true;
        settingsStatus.textContent = "Saving settings…";
        try {
            const response = await fetch("/auth/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(preferences)
            });
            if (!response.ok) {
                throw new Error(`Saving settings failed with HTTP ${response.status}.`);
            }
            savedPreferences = { ...preferences };
            setFormPreferences(savedPreferences);
            settingsStatus.textContent = "Settings saved to your account.";
            settingsDialog.close();
        } catch (error) {
            console.error("Could not save meditation settings:", error);
            settingsStatus.textContent = "We couldn't save your settings. Please try again.";
        } finally {
            settingsSaveInProgress = false;
            saveSettingsButton.disabled = false;
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        return `${minutes}:${String(remainder).padStart(2, "0")}`;
    }

    function setRingVisible(ring, visible) {
        if (visible && ring.hasAttribute("hidden")) {
            ring.removeAttribute("hidden");
        } else if (!visible && !ring.hasAttribute("hidden")) {
            ring.setAttribute("hidden", "");
        }
    }

    function renderTime(seconds, elapsedSeconds = durationSeconds - seconds) {
        const safeSeconds = Math.max(0, seconds);
        timeDisplay.textContent = formatTime(safeSeconds);
        const fractionRemaining = durationSeconds > 0
            ? Math.max(0, Math.min(1, 1 - elapsedSeconds / durationSeconds))
            : 0;
        progressRing.style.strokeDashoffset = String(sessionRingCircumference * (1 - fractionRemaining));

        const intervalSeconds = Number(intervalInput.value) * 60;
        const hasIntervalBells = intervalSeconds > 0 && intervalSeconds < durationSeconds;
        setRingVisible(intervalTrack, hasIntervalBells);
        setRingVisible(intervalProgressRing, hasIntervalBells);
        if (hasIntervalBells) {
            const elapsedInInterval = Math.max(0, elapsedSeconds) % intervalSeconds;
            const secondsUntilBell = intervalSeconds - elapsedInInterval;
            const intervalFractionRemaining = Math.max(0, Math.min(
                1,
                Math.min(secondsUntilBell, safeSeconds) / intervalSeconds
            ));
            intervalProgressRing.style.strokeDashoffset = String(
                intervalRingCircumference * (1 - intervalFractionRemaining)
            );
        }
    }

    function renderStartDelay(secondsLeft) {
        const hasActiveStartDelay = startDelayDurationSeconds > 0 && secondsLeft > 0;
        const hasStartDelayPreview = !isRunning &&
            startDelayDeadline === 0 &&
            elapsedBeforePause === 0 &&
            Number(startDelayInput.value) > 0;
        const showStartDelayRing = hasActiveStartDelay || hasStartDelayPreview;
        setRingVisible(startDelayTrack, showStartDelayRing);
        setRingVisible(startDelayProgressRing, showStartDelayRing);
        if (!showStartDelayRing) {
            return;
        }

        const fractionRemaining = hasActiveStartDelay
            ? Math.max(0, Math.min(1, secondsLeft / startDelayDurationSeconds))
            : 1;
        startDelayProgressRing.style.strokeDashoffset = String(
            startDelayRingCircumference * (1 - fractionRemaining)
        );
    }

    function playSound(sound) {
        if (sound === "none") {
            return;
        }
        if (!audioContext) {
            audioContext = new AudioContext();
        }

        const notes = {
            bell: [
                { frequency: 660, offset: 0, gain: 0.12, duration: 1.4 },
                { frequency: 880, offset: 0.08, gain: 0.06, duration: 1.4 }
            ],
            chime: [
                { frequency: 880, offset: 0, gain: 0.09, duration: 1.6 },
                { frequency: 1174, offset: 0.12, gain: 0.07, duration: 1.8 },
                { frequency: 1480, offset: 0.24, gain: 0.05, duration: 2 }
            ],
            bowl: [
                { frequency: 220, offset: 0, gain: 0.13, duration: 2.4 },
                { frequency: 330, offset: 0.05, gain: 0.045, duration: 2.1 }
            ],
            woodblock: [
                { frequency: 520, offset: 0, gain: 0.11, duration: 0.16, type: "triangle" },
                { frequency: 340, offset: 0.09, gain: 0.07, duration: 0.12, type: "triangle" }
            ],
            crystal: [
                { frequency: 1318, offset: 0, gain: 0.075, duration: 2, type: "triangle" },
                { frequency: 1760, offset: 0.13, gain: 0.05, duration: 2.2, type: "sine" },
                { frequency: 2093, offset: 0.26, gain: 0.035, duration: 2.4, type: "sine" }
            ],
            pulse: [
                { frequency: 440, offset: 0, gain: 0.1, duration: 0.22, type: "triangle" },
                { frequency: 554, offset: 0.3, gain: 0.07, duration: 0.3, type: "triangle" }
            ],
            flute: [
                { frequency: 523, offset: 0, gain: 0.07, duration: 2.1, type: "sine" },
                { frequency: 659, offset: 0.35, gain: 0.055, duration: 2.4, type: "sine" }
            ],
            waterdrop: [
                { frequency: 1046, offset: 0, gain: 0.08, duration: 0.55, type: "sine" },
                { frequency: 784, offset: 0.7, gain: 0.065, duration: 0.65, type: "sine" },
                { frequency: 1174, offset: 1.5, gain: 0.05, duration: 0.5, type: "sine" }
            ],
            gong: [
                { frequency: 110, offset: 0, gain: 0.12, duration: 2.8, type: "triangle" },
                { frequency: 164, offset: 0.04, gain: 0.07, duration: 3, type: "sine" },
                { frequency: 220, offset: 0.08, gain: 0.035, duration: 2.5, type: "sine" }
            ]
        };
        const now = audioContext.currentTime;
        (notes[sound] || notes.bell).forEach(note => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const start = now + note.offset;
            const duration = note.duration * 4;
            oscillator.type = note.type || "sine";
            oscillator.frequency.setValueAtTime(note.frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(start);
            oscillator.stop(start + duration);
        });
    }

    async function previewSound(sound) {
        if (sound === "none") {
            return;
        }

        try {
            if (!audioContext) {
                audioContext = new AudioContext();
            }
            await audioContext.resume();
            playSound(sound);
        } catch (error) {
            console.error("Could not preview meditation sound:", error);
            showError("Audio could not be started. Check your browser's sound settings and try again.");
        }
    }

    function setControlsDisabled(disabled) {
        durationInput.disabled = disabled;
        startDelayInput.disabled = disabled;
        intervalInput.disabled = disabled;
        startSoundInput.disabled = disabled;
        intervalSoundInput.disabled = disabled;
        finishSoundInput.disabled = disabled;
    }

    function stopStartDelay() {
        if (startDelayTimerId !== undefined) {
            window.cancelAnimationFrame(startDelayTimerId);
            startDelayTimerId = undefined;
        }
        startDelayDeadline = 0;
        startDelayDurationSeconds = 0;
        displayedStartDelaySeconds = undefined;
        renderStartDelay(0);
    }

    function stopInterval() {
        if (timerId) {
            window.clearInterval(timerId);
            timerId = undefined;
        }
    }

    function finishSession() {
        stopInterval();
        isRunning = false;
        remainingSeconds = 0;
        elapsedBeforePause = durationSeconds;
        renderTime(0);
        playSound(finishSoundInput.value);
        sessionMessage.textContent = "Your practice is complete. Take this calm with you.";
        saveCompletedMeditation();
        timerCaption.textContent = "A MOMENT WELL SPENT";
        startButton.hidden = true;
        pauseButton.hidden = true;
        resetButton.hidden = false;
        setControlsDisabled(true);
    }

    async function saveCompletedMeditation() {
        try {
            const response = await fetch("/auth/meditations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ durationMinutes: Math.round(durationSeconds / 60) })
            });
            if (!response.ok) {
                throw new Error(`Saving completed meditation failed with HTTP ${response.status}.`);
            }
            await loadMeditationHistory();
        } catch (error) {
            console.error("Could not save completed meditation:", error);
            showError("Your session is complete, but we couldn't save it to your history.");
        }
    }

    function tick() {
        const now = Date.now();
        remainingSeconds = Math.max(0, Math.ceil((deadline - now) / 1000));
        const elapsedSeconds = durationSeconds - (deadline - now) / 1000;
        renderTime(remainingSeconds, elapsedSeconds);

        if (remainingSeconds === 0) {
            finishSession();
            return;
        }

        const intervalSeconds = Number(intervalInput.value) * 60;
        if (intervalSeconds > 0 && elapsedSeconds >= nextBellSeconds) {
            playSound(intervalSoundInput.value);
            nextBellSeconds += intervalSeconds;
            sessionMessage.textContent = "A gentle bell. Return to your breath.";
        }
    }

    function startMeditationTimer() {
        stopStartDelay();
        playSound(startSoundInput.value);
        if (remainingSeconds === durationSeconds && elapsedBeforePause === 0) {
            nextBellSeconds = Number(intervalInput.value) * 60;
        }

        deadline = Date.now() + remainingSeconds * 1000;
        isRunning = true;
        setControlsDisabled(true);
        startButton.hidden = true;
        pauseButton.hidden = false;
        resetButton.hidden = false;
        timerCaption.textContent = "MINUTES OF STILLNESS";
        sessionMessage.textContent = "Breathe in. Breathe out.";
        timerId = window.setInterval(tick, 200);
        tick();
    }

    function tickStartDelay() {
        const secondsLeftExact = Math.max(0, (startDelayDeadline - Date.now()) / 1000);
        const secondsLeft = Math.ceil(secondsLeftExact);
        renderStartDelay(secondsLeftExact);
        if (secondsLeft !== displayedStartDelaySeconds) {
            sessionMessage.textContent = `Your meditation begins in ${secondsLeft} second${secondsLeft === 1 ? "" : "s"}.`;
            displayedStartDelaySeconds = secondsLeft;
        }
        if (secondsLeft === 0) {
            startMeditationTimer();
            return;
        }

        startDelayTimerId = window.requestAnimationFrame(tickStartDelay);
    }

    async function beginSession() {
        const minutes = Number(durationInput.value);
        const startDelaySeconds = Number(startDelayInput.value);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
            durationInput.setAttribute("aria-invalid", "true");
            sessionMessage.textContent = "Choose a session length from 1 to 180 minutes.";
            durationInput.focus();
            return;
        }
        if (!Number.isInteger(startDelaySeconds) || startDelaySeconds < 0 || startDelaySeconds > 60) {
            startDelayInput.setAttribute("aria-invalid", "true");
            sessionMessage.textContent = "Choose a starting pause from 0 to 60 seconds.";
            startDelayInput.focus();
            return;
        }

        clearError();
        durationInput.removeAttribute("aria-invalid");
        startDelayInput.removeAttribute("aria-invalid");
        try {
            if (!audioContext) {
                audioContext = new AudioContext();
            }
            await audioContext.resume();
        } catch (error) {
            showError("Audio could not be started. Check your browser's sound settings and try again.");
            return;
        }

        setZenMode(true);

        if (remainingSeconds === durationSeconds && elapsedBeforePause === 0) {
            durationSeconds = minutes * 60;
            remainingSeconds = durationSeconds;
            elapsedBeforePause = 0;
            nextBellSeconds = Number(intervalInput.value) * 60;
            renderTime(remainingSeconds);
        }

        if (startDelaySeconds === 0 || elapsedBeforePause > 0) {
            startMeditationTimer();
            return;
        }

        setControlsDisabled(true);
        startButton.hidden = true;
        pauseButton.hidden = true;
        resetButton.hidden = false;
        resetButton.textContent = "Cancel";
        timerCaption.textContent = "SETTLING IN";
        startDelayDurationSeconds = startDelaySeconds;
        startDelayDeadline = Date.now() + startDelaySeconds * 1000;
        tickStartDelay();
    }

    function pauseSession() {
        if (!isRunning) {
            return;
        }

        remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        elapsedBeforePause = durationSeconds - remainingSeconds;
        isRunning = false;
        stopInterval();
        renderTime(remainingSeconds);
        pauseButton.hidden = true;
        startButton.hidden = false;
        startButton.textContent = "Resume meditation";
        sessionMessage.textContent = "Paused. Resume whenever you're ready.";
    }

    function resetSession() {
        stopStartDelay();
        stopInterval();
        isRunning = false;
        durationSeconds = Number(durationInput.value) * 60;
        remainingSeconds = durationSeconds;
        elapsedBeforePause = 0;
        nextBellSeconds = Number(intervalInput.value) * 60;
        renderTime(remainingSeconds);
        timerCaption.textContent = "MINUTES OF STILLNESS";
        sessionMessage.textContent = "When you're ready, begin.";
        startButton.textContent = "Begin meditation";
        startButton.hidden = false;
        resetButton.textContent = "End session";
        pauseButton.hidden = true;
        resetButton.hidden = true;
        durationInput.removeAttribute("aria-invalid");
        setControlsDisabled(false);
    }

    durationInput.addEventListener("change", () => {
        if (isRunning || elapsedBeforePause !== 0) {
            return;
        }
        const minutes = Number(durationInput.value);
        if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 180) {
            durationInput.removeAttribute("aria-invalid");
        }
    });

    startDelayInput.addEventListener("change", () => {
        const seconds = Number(startDelayInput.value);
        if (Number.isInteger(seconds) && seconds >= 0 && seconds <= 60) {
            startDelayInput.removeAttribute("aria-invalid");
        }
        renderStartDelay(0);
    });

    themeInput.addEventListener("change", () => {
        applyTheme(themeInput.value);
    });

    [startSoundInput, intervalSoundInput, finishSoundInput].forEach(input => {
        input.addEventListener("change", () => {
            previewSound(input.value);
        });
    });

    function setZenMode(enabled) {
        document.body.classList.toggle("zen-mode", enabled);
        zenModeButton.textContent = enabled ? "Exit zen mode" : "Enter zen mode";
        zenModeButton.setAttribute("aria-pressed", String(enabled));
    }

    zenModeButton.addEventListener("click", () => {
        setZenMode(!document.body.classList.contains("zen-mode"));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.body.classList.contains("zen-mode")) {
            setZenMode(false);
        }
    });

    settingsButton.addEventListener("click", () => {
        if (isRunning || startDelayDeadline > 0 || elapsedBeforePause > 0) {
            meditationActiveDialog.showModal();
            return;
        }

        setFormPreferences(savedPreferences);
        settingsStatus.textContent = "";
        settingsDialog.showModal();
    });
    saveSettingsButton.addEventListener("click", savePreferences);
    cancelSettingsButton.addEventListener("click", () => settingsDialog.close());
    closeSettingsButton.addEventListener("click", () => settingsDialog.close());
    closeMeditationActiveDialog.addEventListener("click", () => meditationActiveDialog.close());
    dismissMeditationActiveDialog.addEventListener("click", () => meditationActiveDialog.close());
    restoreDefaultsButton.addEventListener("click", () => {
        setFormPreferences(defaultPreferences);
        settingsStatus.textContent = "Default settings selected. Save to keep these changes.";
    });
    settingsDialog.addEventListener("close", () => {
        setFormPreferences(savedPreferences);
        durationInput.removeAttribute("aria-invalid");
        startDelayInput.removeAttribute("aria-invalid");
    });
    settingsDialog.addEventListener("click", event => {
        if (event.target === settingsDialog) {
            settingsDialog.close();
        }
    });
    meditationActiveDialog.addEventListener("click", event => {
        if (event.target === meditationActiveDialog) {
            meditationActiveDialog.close();
        }
    });

    startButton.addEventListener("click", beginSession);
    pauseButton.addEventListener("click", pauseSession);
    resetButton.addEventListener("click", resetSession);
    logoutButton.addEventListener("click", async () => {
        try {
            const response = await fetch("/auth/logout");
            if (!response.ok) {
                throw new Error("Log out failed.");
            }
            resetSession();
            await readSession();
        } catch (error) {
            showError("We couldn't log you out. Please try again.");
        }
    });

    readSession().catch(() => {
        showError("We couldn't check your account. Refresh the page to try again.");
    });
})();
