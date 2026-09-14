const {
    discoverProjectsByUser
} = require("./discoveryService");


// ==========================================
// GitHub Usernames
// ==========================================

const USERNAMES = [

    "haproven",
    "codersusheel"

];


// ==========================================
// Discover All Users
// ==========================================

async function runAutoDiscovery() {

    console.log(
        "🔍 GitProHub automatic discovery started..."
    );


    for (const username of USERNAMES) {

        try {

            const projects =
                await discoverProjectsByUser(
                    username
                );


            console.log(
                `✅ ${username}: ${projects.length} project(s) discovered`
            );


        } catch (error) {

            console.error(
                `❌ ${username} discovery failed:`,
                error.message
            );

        }

    }


    console.log(
        "🚀 Automatic discovery completed."
    );

}


// ==========================================
// Start Automatic Discovery
// ==========================================

// function startAutoDiscovery(
//     interval = 15 * 60 * 1000
// ) {


function startAutoDiscovery(
    interval = 1 * 60 * 1000
) {

    // Run immediately

    runAutoDiscovery();


    // Run every interval
    setInterval(
        runAutoDiscovery,
        interval
    );


    console.log(
        "⏱️ Auto discovery interval: 15 minutes"
    );

}


// ==========================================
// Export
// ==========================================

module.exports = {

    runAutoDiscovery,

    startAutoDiscovery

};
 
