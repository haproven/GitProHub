const {
    discoverAllGitProHubProjects
} = require("./discoveryService");

let isRunning = false;
let intervalId = null;


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
            message: "Previous discovery is still running"
        };
    }


    isRunning = true;


    console.log("");
    console.log(
        "🔄 GitProHub automatic global discovery started..."
    );


    try {

        const result =
            await discoverAllGitProHubProjects();


        console.log("");
        console.log(
            `🚀 Automatic discovery completed: ${result.total} project(s)`
        );


        return {
            success: true,
            ...result
        };


    } catch (error) {

        console.error(
            "❌ Automatic discovery failed:",
            error.message
        );


        return {
            success: false,
            total: 0,
            projects: [],
            error: error.message
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

    // Already running
    if (intervalId) {

        console.log(
            "⚠️ Auto discovery is already running."
        );

        return;
    }


    // Run immediately when server starts
    runAutoDiscovery();


    // Run again after every interval
    intervalId =
        setInterval(
            runAutoDiscovery,
            interval
        );


    console.log(
        "⏱️ Auto discovery interval: 1 minute"
    );
}


/* =========================================================
   STOP AUTO DISCOVERY
   ========================================================= */

function stopAutoDiscovery() {

    if (!intervalId) {

        console.log(
            "⚠️ Auto discovery is not running."
        );

        return;
    }


    clearInterval(
        intervalId
    );


    intervalId = null;


    console.log(
        "🛑 Auto discovery stopped."
    );
}


/* =========================================================
   STATUS
   ========================================================= */

function getAutoDiscoveryStatus() {

    return {
        running: isRunning,
        scheduled: Boolean(intervalId),
        interval: "1 minute"
    };
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
