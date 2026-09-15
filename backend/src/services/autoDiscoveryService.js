const {
    discoverAllGitProHubProjects
} = require("./discoveryService");

let isRunning = false;
let intervalId = null;

let lastResult = {
    success: null,
    total: 0,
    added: 0,
    updated: 0,
    removed: 0,
    newAccounts: [],
    errors: [],
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

    const startedAt = new Date().toISOString();

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 GitProHub automatic discovery started");
    console.log(`🕐 Started: ${startedAt}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

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
                Array.isArray(result?.newAccounts)
                    ? result.newAccounts
                    : [],

            errors:
                Array.isArray(result?.errors)
                    ? result.errors
                    : [],

            projects:
                Array.isArray(result?.projects)
                    ? result.projects
                    : [],

            startedAt,
            completedAt
        };


        console.log("");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ Automatic discovery completed");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

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
            `🗑️ Removed         : ${lastResult.removed}`
        );

        console.log(
            `👤 New accounts   : ${lastResult.newAccounts.length}`
        );

        console.log(
            `⚠️ Errors          : ${lastResult.errors.length}`
        );


        /*
         * Show newly discovered accounts.
         */
        if (lastResult.newAccounts.length > 0) {

            console.log("");
            console.log("👤 New GitHub accounts discovered:");

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
        if (lastResult.errors.length > 0) {

            console.log("");
            console.log("⚠️ Discovery errors:");

            lastResult.errors.forEach(
                error => {

                    if (typeof error === "string") {
                        console.log(`   • ${error}`);
                    } else {
                        console.log(
                            `   • ${error?.message || JSON.stringify(error)}`
                        );
                    }
                }
            );
        }

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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
         * Discovery failure should NOT reset the
         * previous project count to zero.
         */
        lastResult = {

            ...lastResult,

            success: false,

            error: error.message,

            startedAt,

            completedAt:
                new Date().toISOString()
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

            error: error.message,

            startedAt,

            completedAt:
                lastResult.completedAt
        };


    } finally {

        isRunning = false;
    }
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
    if (intervalId) {

        console.log(
            "⚠️ Auto discovery is already running."
        );

        return {
            success: false,
            message: "Auto discovery is already running"
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


    /*
     * Run immediately when server starts.
     *
     * Do not await here because startAutoDiscovery()
     * should not block server startup.
     */
    runAutoDiscovery().catch(error => {

        console.error(
            "❌ Initial auto discovery error:",
            error.message
        );

    });


    /*
     * Schedule next discovery.
     */
    intervalId =
        setInterval(
            () => {

                runAutoDiscovery()
                    .catch(error => {

                        console.error(
                            "❌ Scheduled discovery error:",
                            error.message
                        );

                    });

            },
            interval
        );


    console.log("");
    console.log(
        `⏱️ Auto discovery interval: ${formatInterval(interval)}`
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


    return {
        success: true,
        interval,
        message: "Auto discovery started"
    };
}



/* =========================================================
   STOP AUTO DISCOVERY
   ========================================================= */

function stopAutoDiscovery() {

    if (!intervalId) {

        console.log(
            "⚠️ Auto discovery is not running."
        );

        return {
            success: false,
            message: "Auto discovery is not running"
        };
    }


    clearInterval(
        intervalId
    );

    intervalId = null;


    console.log(
        "🛑 Auto discovery stopped."
    );


    return {
        success: true,
        message: "Auto discovery stopped"
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
            Boolean(intervalId),

        interval:
            intervalId
                ? "1 minute"
                : null,

        lastRun:
            lastResult
    };
}



/* =========================================================
   FORMAT INTERVAL
   ========================================================= */

function formatInterval(milliseconds) {

    const seconds =
        Math.floor(
            milliseconds / 1000
        );

    if (seconds < 60) {

        return `${seconds} seconds`;
    }


    const minutes =
        Math.floor(
            seconds / 60
        );

    if (minutes < 60) {

        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }


    const hours =
        Math.floor(
            minutes / 60
        );

    return `${hours} hour${hours === 1 ? "" : "s"}`;
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
