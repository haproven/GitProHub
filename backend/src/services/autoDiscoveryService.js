const {
    discoverAllGitProHubProjects
} = require("./discoveryService");

const DEFAULT_INTERVAL = 30 * 60 * 1000;
const MIN_INTERVAL = 1 * 60 * 1000;

let isRunning = false;
let timeoutId = null;
let schedulerRunning = false;
let currentInterval = DEFAULT_INTERVAL;

let lastResult = {
    success: null,
    total: 0,
    added: 0,
    updated: 0,
    removed: 0,
    newProjects: [],
    updatedProjects: [],
    newAccounts: [],
    errors: [],
    projects: [],
    startedAt: null,
    completedAt: null,
    durationMs: null
};

async function runAutoDiscovery() {

    if (isRunning) {

        console.log(
            "⏳ Previous discovery is still running..."
        );

        return {
            success: false,
            skipped: true,
            message: "Previous discovery is still running",
            ...lastResult
        };
    }

    isRunning = true;

    const startedAt =
        new Date().toISOString();

    const startedTime =
        Date.now();

    console.log("");

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
        "🔄 GitProHub automatic discovery started"
    );

    console.log(
        `🕐 Started: ${startedAt}`
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    try {

        const result =
            await discoverAllGitProHubProjects();

        const completedAt =
            new Date().toISOString();

        const durationMs =
            Date.now() - startedTime;

        const newProjects =
            Array.isArray(result?.newProjects)
                ? result.newProjects
                : [];

        const updatedProjects =
            Array.isArray(result?.updatedProjects)
                ? result.updatedProjects
                : [];

        const newAccounts =
            Array.isArray(result?.newAccounts)
                ? result.newAccounts
                : [];

        const errors =
            Array.isArray(result?.errors)
                ? result.errors
                : [];

        const projects =
            Array.isArray(result?.projects)
                ? result.projects
                : [];

        const removedProjects =
            Array.isArray(result?.removedProjects)
                ? result.removedProjects
                : [];

        lastResult = {

            success:
                result?.success !== false,

            total:
                Number.isFinite(
                    Number(result?.total)
                )
                    ? Number(result.total)
                    : projects.length,

            added:
                Number.isFinite(
                    Number(result?.added)
                )
                    ? Number(result.added)
                    : newProjects.length,

            updated:
                Number.isFinite(
                    Number(result?.updated)
                )
                    ? Number(result.updated)
                    : updatedProjects.length,

            removed:
                Number.isFinite(
                    Number(result?.removed)
                )
                    ? Number(result.removed)
                    : removedProjects.length,

            newProjects,

            updatedProjects,

            newAccounts,

            errors,

            projects,

            startedAt,

            completedAt,

            durationMs
        };

        console.log("");

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "✅ Automatic discovery completed"
        );

        console.log(
            `📦 Total projects : ${lastResult.total}`
        );

        console.log(
            `🆕 New projects   : ${lastResult.added}`
        );

        console.log(
            `🔄 Updated        : ${lastResult.updated}`
        );

        console.log(
            `🗑️ Removed        : ${lastResult.removed}`
        );

        console.log(
            `👤 New accounts   : ${lastResult.newAccounts.length}`
        );

        console.log(
            `⚠️ Errors         : ${lastResult.errors.length}`
        );

        console.log(
            `⏱️ Duration       : ${formatDuration(durationMs)}`
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log("");

        return {
            ...lastResult
        };

    } catch (error) {

        const completedAt =
            new Date().toISOString();

        const durationMs =
            Date.now() - startedTime;

        const errorMessage =
            error?.message ||
            "Unknown discovery error";

        console.error("");

        console.error(
            "❌ Automatic discovery failed:"
        );

        console.error(
            errorMessage
        );

        lastResult = {

            ...lastResult,

            success: false,

            errors: [
                ...lastResult.errors,
                errorMessage
            ],

            startedAt,

            completedAt,

            durationMs
        };

        return {

            success: false,

            skipped: false,

            total:
                lastResult.total,

            added: 0,

            updated: 0,

            removed: 0,

            newProjects: [],

            updatedProjects: [],

            newAccounts: [],

            errors: [
                errorMessage
            ],

            error:
                errorMessage,

            startedAt,

            completedAt,

            durationMs
        };

    } finally {

        isRunning = false;
    }
}

function scheduleNextDiscovery() {

    if (!schedulerRunning) {
        return;
    }

    if (timeoutId !== null) {

        clearTimeout(
            timeoutId
        );

        timeoutId = null;
    }

    console.log(
        `⏱️ Next discovery in ${formatInterval(currentInterval)}`
    );

    timeoutId = setTimeout(
        async () => {

            timeoutId = null;

            if (!schedulerRunning) {
                return;
            }

            try {

                await runAutoDiscovery();

            } catch (error) {

                console.error(
                    "❌ Scheduled discovery error:",
                    error?.message ||
                    error
                );

            } finally {

                if (schedulerRunning) {
                    scheduleNextDiscovery();
                }
            }

        },
        currentInterval
    );

    if (
        timeoutId &&
        typeof timeoutId.unref === "function"
    ) {
        timeoutId.unref();
    }
}

function startAutoDiscovery(
    interval = DEFAULT_INTERVAL
) {

    if (schedulerRunning) {

        console.log(
            "⚠️ Auto discovery is already running."
        );

        return {

            success: false,

            message:
                "Auto discovery is already running",

            interval:
                currentInterval,

            intervalMs:
                currentInterval
        };
    }

    if (
        !Number.isFinite(
            Number(interval)
        ) ||
        Number(interval) < MIN_INTERVAL
    ) {

        interval =
            DEFAULT_INTERVAL;
    }

    currentInterval =
        Number(interval);

    schedulerRunning = true;

    console.log("");

    console.log(
        "🚀 Auto discovery scheduler started"
    );

    console.log(
        `⏱️ Discovery interval: ${formatInterval(currentInterval)}`
    );

    console.log(
        "🌐 Global GitProHub discovery: ENABLED"
    );

    console.log(
        "♾️ Continuous discovery: ENABLED"
    );

    console.log("");

    runAutoDiscovery()
        .catch(error => {

            console.error(
                "❌ Initial auto discovery error:",
                error?.message ||
                error
            );

        })
        .finally(() => {

            if (schedulerRunning) {
                scheduleNextDiscovery();
            }
        });

    return {

        success: true,

        interval:
            currentInterval,

        intervalMs:
            currentInterval,

        message:
            "Auto discovery started"
    };
}

function stopAutoDiscovery() {

    if (!schedulerRunning) {

        console.log(
            "⚠️ Auto discovery is not running."
        );

        return {

            success: false,

            message:
                "Auto discovery is not running"
        };
    }

    schedulerRunning = false;

    if (timeoutId !== null) {

        clearTimeout(
            timeoutId
        );

        timeoutId = null;
    }

    console.log("");

    console.log(
        "🛑 Auto discovery scheduler stopped."
    );

    console.log("");

    return {

        success: true,

        message:
            "Auto discovery stopped"
    };
}

function getAutoDiscoveryStatus() {

    return {

        running:
            isRunning,

        scheduled:
            schedulerRunning,

        interval:
            schedulerRunning
                ? formatInterval(
                    currentInterval
                )
                : null,

        intervalMs:
            schedulerRunning
                ? currentInterval
                : null,

        timerActive:
            timeoutId !== null,

        lastRun:
            lastResult
    };
}

function formatInterval(
    milliseconds
) {

    const totalSeconds =
        Math.floor(
            milliseconds / 1000
        );

    if (totalSeconds < 60) {

        return (
            `${totalSeconds} second${
                totalSeconds === 1
                    ? ""
                    : "s"
            }`
        );
    }

    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    if (minutes < 60) {

        return (
            `${minutes} minute${
                minutes === 1
                    ? ""
                    : "s"
            }`
        );
    }

    const hours =
        Math.floor(
            minutes / 60
        );

    if (hours < 24) {

        return (
            `${hours} hour${
                hours === 1
                    ? ""
                    : "s"
            }`
        );
    }

    const days =
        Math.floor(
            hours / 24
        );

    return (
        `${days} day${
            days === 1
                ? ""
                : "s"
        }`
    );
}

function formatDuration(
    milliseconds
) {

    const safeMilliseconds =
        Number.isFinite(
            Number(milliseconds)
        )
            ? Number(milliseconds)
            : 0;

    const seconds =
        Math.max(
            0,
            Math.floor(
                safeMilliseconds / 1000
            )
        );

    if (seconds < 60) {

        return `${seconds}s`;
    }

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remainingSeconds =
        seconds % 60;

    if (minutes < 60) {

        return (
            `${minutes}m ${remainingSeconds}s`
        );
    }

    const hours =
        Math.floor(
            minutes / 60
        );

    const remainingMinutes =
        minutes % 60;

    return (
        `${hours}h ${remainingMinutes}m`
    );
}

module.exports = {

    runAutoDiscovery,

    startAutoDiscovery,

    stopAutoDiscovery,

    getAutoDiscoveryStatus
};
