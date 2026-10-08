(() => {
    const message = document.getElementById("summary-message");
    const content = document.getElementById("summary-content");
    const totalTime = document.getElementById("total-time");
    const totalSessions = document.getElementById("total-sessions");
    const practiceDays = document.getElementById("practice-days");
    const currentStreak = document.getElementById("current-streak");
    const summaryStatus = document.getElementById("summary-status");
    const dailySummaryBody = document.getElementById("daily-summary-body");
    const clearHistoryButton = document.getElementById("clear-history-button");

    function formatDuration(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours === 0) {
            return `${minutes} min`;
        }
        return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
    }

    function getCurrentStreak(dateKeys) {
        const practicedDays = new Set(dateKeys.filter(dateKey => dateKey !== "unknown"));
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        let day = practicedDays.has(todayKey)
            ? new Date(`${todayKey}T00:00:00Z`)
            : practicedDays.has(yesterdayKey)
                ? new Date(`${yesterdayKey}T00:00:00Z`)
                : null;

        let streak = 0;
        while (day) {
            const dateKey = day.toISOString().slice(0, 10);
            if (!practicedDays.has(dateKey)) {
                break;
            }
            streak++;
            day.setUTCDate(day.getUTCDate() - 1);
        }
        return streak;
    }

    function renderSummary(history) {
        const dailyTotals = new Map();
        let cumulativeMinutes = 0;
        history.forEach(meditation => {
            const completedAt = new Date(meditation.completedAt);
            const dateKey = Number.isNaN(completedAt.getTime())
                ? "unknown"
                : `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, "0")}-${String(completedAt.getDate()).padStart(2, "0")}`;
            const daily = dailyTotals.get(dateKey) || { minutes: 0, sessions: 0 };
            const minutes = Number(meditation.durationMinutes);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                return;
            }
            daily.minutes += minutes;
            daily.sessions++;
            dailyTotals.set(dateKey, daily);
            cumulativeMinutes += minutes;
        });

        totalTime.textContent = formatDuration(cumulativeMinutes);
        totalSessions.textContent = `${history.length} completed session${history.length === 1 ? "" : "s"}`;
        practiceDays.textContent = String(dailyTotals.size);
        currentStreak.textContent = String(getCurrentStreak([...dailyTotals.keys()]));
        dailySummaryBody.replaceChildren();

        const sortedDays = [...dailyTotals.entries()].sort(([first], [second]) => second.localeCompare(first));
        let runningTotal = cumulativeMinutes;
        sortedDays.forEach(([dateKey, daily]) => {
            const row = document.createElement("tr");
            const dateCell = document.createElement("td");
            const sessionsCell = document.createElement("td");
            const minutesCell = document.createElement("td");
            const cumulativeCell = document.createElement("td");

            if (dateKey === "unknown") {
                dateCell.textContent = "Date unavailable";
            } else {
                const [year, month, day] = dateKey.split("-").map(Number);
                dateCell.textContent = new Date(year, month - 1, day).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                });
            }
            sessionsCell.textContent = String(daily.sessions);
            minutesCell.textContent = formatDuration(daily.minutes);
            cumulativeCell.textContent = formatDuration(runningTotal);
            runningTotal -= daily.minutes;
            row.append(dateCell, sessionsCell, minutesCell, cumulativeCell);
            dailySummaryBody.append(row);
        });

        summaryStatus.textContent = sortedDays.length
            ? "Daily totals are grouped by your local calendar date."
            : "Complete a meditation to start building your summary.";
        content.hidden = false;
        message.hidden = true;
    }

    async function loadSummary() {
        const preferencesResponse = await fetch("/auth/preferences");
        if (preferencesResponse.ok) {
            const preferences = await preferencesResponse.json();
            const theme = preferences.theme || "light";
            document.body.dataset.theme = theme;
            document.documentElement.style.colorScheme = ["light", "sage", "high-contrast"].includes(theme)
                ? "light"
                : "dark";
        }

        const response = await fetch("/auth/meditations");
        if (response.status === 401) {
            message.textContent = "Sign in to view your meditation summary.";
            const login = document.createElement("a");
            login.className = "account-link";
            login.href = "/auth/login";
            login.textContent = "Log in";
            message.append(" ", login);
            return;
        }
        if (!response.ok) {
            throw new Error(`Loading meditation summary failed with HTTP ${response.status}.`);
        }
        renderSummary(await response.json());
    }

    clearHistoryButton.addEventListener("click", async () => {
        if (!window.confirm("Delete all completed meditation history? This cannot be undone.")) {
            return;
        }

        clearHistoryButton.disabled = true;
        try {
            const response = await fetch("/auth/meditations", { method: "DELETE" });
            if (!response.ok) {
                throw new Error(`Deleting meditation history failed with HTTP ${response.status}.`);
            }
            renderSummary([]);
        } catch (error) {
            console.error("Could not delete meditation history:", error);
            summaryStatus.textContent = "We couldn't delete your history. Please try again.";
        } finally {
            clearHistoryButton.disabled = false;
        }
    });

    loadSummary().catch(error => {
        console.error("Could not load meditation summary:", error);
        message.textContent = "We couldn't load your meditation summary. Please try again.";
    });
})();
