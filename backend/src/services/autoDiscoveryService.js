const {
    discoverAllGitProHubProjects
} = require("./discoveryService");

let isRunning = false;

// setInterval ki jagah setTimeout use hoga.
// Next discovery previous discovery complete hone ke baad schedule hogi.
let timeoutId = null;

let schedulerRunning = false;

let currentInterval = 1 * 60 * 1000;

let lastResult = {
    success: null,
    total: 0,
    added: 0,
    updated: 0,
    removed: 0,
    newAccounts: [],
    errors: [],
    projects: [],
    startedAt: null,
    completedAt: null
};


/* =========================================================
   RUN AUTO DISCOVERY
   ========================================================= */

async function runAutoDiscovery() {

    // Prevent multiple discovery processes
    // from running at the same time.
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


        /*
         * Save latest successful result.
         */

        lastResult = {

            success: true,

            total:
                Number(result?.total) || 0,

            added:
                Number(
                    result?.added ??
                    result?.newProjects ??
                    0
                ),

            updated:
                Number(
                    result?.updated ??
                    result?.updatedProjects ??
                    0
                ),

            removed:
                Number(
                    result?.removed ??
                    result?.removedProjects ??
                    0
                ),

            newAccounts:
                Array.isArray(
                    result?.newAccounts
                )
                    ? result.newAccounts
                    : [],

            errors:
                Array.isArray(
                    result?.errors
                )
                    ? result.errors
                    : [],

            projects:
                Array.isArray(
                    result?.projects
                )
                    ? result.projects
                    : [],

            startedAt,

            completedAt
        };


        console.log("");

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "✅ Automatic discovery completed"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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


        /*
         * Show newly discovered accounts.
         */

        if (
            lastResult.newAccounts.length > 0
        ) {

            console.log("");

            console.log(
                "👤 New GitHub accounts discovered:"
            );

            lastResult.newAccounts.forEach(
                username => {

                    console.log(
                        `   ➕ ${username}`
                    );

                }
            );

        }


        /*
         * Show discovery errors.
         */

        if (
            lastResult.errors.length > 0
        ) {

            console.log("");

            console.log(
                "⚠️ Discovery errors:"
            );

            lastResult.errors.forEach(
                error => {

                    if (
                        typeof error === "string"
                    ) {

                        console.log(
                            `   • ${error}`
                        );

                    } else {

                        console.log(
                            `   • ${
                                error?.message ||
                                JSON.stringify(error)
                            }`
                        );

                    }

                }
            );

        }


        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log("");


        return {
            ...lastResult
        };


    } catch (error) {

        console.error("");

        console.error(
            "❌ Automatic discovery failed:",
            error.message
        );


        /*
         * IMPORTANT:
         *
         * Discovery failure should NOT reset
         * the previous project count to zero.
         */

        const completedAt =
            new Date().toISOString();


        lastResult = {

            ...lastResult,

            success: false,

            error:
                error.message,

            startedAt,

            completedAt
        };


        return {

            success: false,

            skipped: false,

            total:
                lastResult.total,

            added: 0,

            updated: 0,

            removed: 0,

            newAccounts: [],

            errors: [
                error.message
            ],

            error:
                error.message,

            startedAt,

            completedAt

        };


    } finally {

        isRunning = false;

    }

}


/* =========================================================
   SCHEDULE NEXT DISCOVERY
   ========================================================= */

function scheduleNextDiscovery() {

    // Scheduler stop ho chuka hai
    if (!schedulerRunning) {
        return;
    }


    // Existing timer ko clear karo
    if (timeoutId) {

        clearTimeout(
            timeoutId
        );

        timeoutId = null;

    }


    /*
     * IMPORTANT:
     *
     * setInterval() use nahi kar rahe.
     *
     * Next discovery previous discovery complete
     * hone ke baad schedule hogi.
     */

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
                    error.message
                );

            }


            /*
             * Discovery complete hone ke baad
             * next run schedule karo.
             */

            if (schedulerRunning) {

                scheduleNextDiscovery();

            }

        },
        currentInterval
    );

}


/* =========================================================
   START AUTO DISCOVERY
   ========================================================= */

function startAutoDiscovery(
    interval = 1 * 60 * 1000
) {

    /*
     * Already scheduled.
     */

    if (schedulerRunning) {

        console.log(
            "⚠️ Auto discovery is already running."
        );

        return {

            success: false,

            message:
                "Auto discovery is already running"

        };

    }


    /*
     * Validate interval.
     */

    if (
        !Number.isFinite(interval) ||
        interval < 10 * 1000
    ) {

        console.log(
            "⚠️ Invalid discovery interval. Using 1 minute."
        );

        interval =
            1 * 60 * 1000;

    }


    currentInterval =
        interval;

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
        "👤 New GitHub accounts: AUTO REGISTER"
    );

    console.log(
        "🔄 Existing projects: AUTO UPDATE"
    );

    console.log(
        "🛡️ API errors: SAFE MODE"
    );

    console.log("");


    /*
     * Run immediately when server starts.
     *
     * Do not await here because server startup
     * should not be blocked.
     */

    runAutoDiscovery()
        .catch(error => {

            console.error(
                "❌ Initial auto discovery error:",
                error.message
            );

        })
        .finally(() => {

            /*
             * IMPORTANT:
             *
             * First discovery complete hone ke baad
             * hi next timer start hoga.
             */

            if (schedulerRunning) {

                scheduleNextDiscovery();

            }

        });


    return {

        success: true,

        interval:
            currentInterval,

        message:
            "Auto discovery started"

    };

}


/* =========================================================
   STOP AUTO DISCOVERY
   ========================================================= */

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


    /*
     * Stop scheduler.
     */

    schedulerRunning = false;


    /*
     * Cancel pending timer.
     */

    if (timeoutId) {

        clearTimeout(
            timeoutId
        );

        timeoutId = null;

    }


    console.log(
        "🛑 Auto discovery stopped."
    );


    return {

        success: true,

        message:
            "Auto discovery stopped"

    };

}


/* =========================================================
   STATUS
   ========================================================= */

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
            Boolean(timeoutId),

        lastRun:
            lastResult

    };

}


/* =========================================================
   FORMAT INTERVAL
   ========================================================= */

function formatInterval(
    milliseconds
) {

    const seconds =
        Math.floor(
            milliseconds / 1000
        );


    if (seconds < 60) {

        return (
            `${seconds} seconds`
        );

    }


    const minutes =
        Math.floor(
            seconds / 60
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


    return (
        `${hours} hour${
            hours === 1
                ? ""
                : "s"
        }`
    );

}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    runAutoDiscovery,

    startAutoDiscovery,

    stopAutoDiscovery,

    getAutoDiscoveryStatus

};
