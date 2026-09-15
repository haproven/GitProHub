const {
    discoverAllGitProHubProjects
} = require("./discoveryService");

const DEFAULT_INTERVAL = 1 * 60 * 1000;
const MIN_INTERVAL = 10 * 1000;

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


// =========================================================
// RUN AUTO DISCOVERY
// =========================================================

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


        lastResult = {

            success:
                result?.success !== false,

            total:
                Number(result?.total) ||
                projects.length ||
                0,

            added:
                Number(result?.added) ||
                newProjects.length ||
                0,

            updated:
                Number(result?.updated) ||
                updatedProjects.length ||
                0,

            removed:
                Number(result?.removed) ||
                (
                    Array.isArray(result?.removedProjects)
                        ? result.removedProjects.length
                        : 0
                ),

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


// =========================================================
// SCHEDULE NEXT DISCOVERY
// =========================================================

function scheduleNextDiscovery() {

    if (!schedulerRunning) {
        return;
    }


    if (timeoutId !== null) {

        clearTimeout(timeoutId);

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
}


// =========================================================
// START AUTO DISCOVERY
// =========================================================

function startAutoDiscovery(
    interval = DEFAULT_INTERVAL
) {

    if (schedulerRunning) {

        console.log(
            "⚠️ Auto discovery is already running."
        );

        return {
            success: false,
            message: "Auto discovery is already running",
            interval: currentInterval,
            intervalMs: currentInterval
        };
    }


    if (
        !Number.isFinite(interval) ||
        interval < MIN_INTERVAL
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


// =========================================================
// STOP AUTO DISCOVERY
// =========================================================

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

        clearTimeout(timeoutId);

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


// =========================================================
// GET STATUS
// =========================================================

function getAutoDiscoveryStatus() {

    return {

        running:
            isRunning,

        scheduled:
            schedulerRunning,

        interval:
            schedulerRunning
                ? formatInterval(currentInterval)
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


// =========================================================
// FORMAT INTERVAL
// =========================================================

function formatInterval(milliseconds) {

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


// =========================================================
// FORMAT DURATION
// =========================================================

function formatDuration(milliseconds) {

    const seconds =
        Math.max(
            0,
            Math.floor(
                milliseconds / 1000
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


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

    runAutoDiscovery,
    startAutoDiscovery,
    stopAutoDiscovery,
    getAutoDiscoveryStatus
};