// =========================================================
// GitProHub - Discovery Service
// =========================================================

const {
    crawlGitHubGitProHubFiles,
    getUserRepositories
} = require("./githubService");

const {
    getProject
} = require("./projectService");

const {
    saveProject,
    getProjects,
    removeProject,
    getProjectKey
} = require("./projectIndexService");


// =========================================================
// CHECK EXISTING PROJECTS
// =========================================================
//
// Existing project ko GitHub se dobara check karega.
//
// gitprohub.md available:
//      → UPDATE
//
// gitprohub.md missing / repository deleted:
//      → REMOVE
//
// Network/API error:
//      → DELETE NAHI karega
//
// =========================================================

async function checkExistingProjects() {

    const projects =
        getProjects();

    let updated = 0;
    let removed = 0;
    let errors = 0;


    console.log(
        `📂 Checking ${projects.length} existing project(s)...`
    );


    for (const project of projects) {

        const key =
            getProjectKey(project);


        if (!key) {
            continue;
        }


        const parts =
            key.split("/");


        if (parts.length !== 2) {
            continue;
        }


        const username =
            parts[0];

        const repo =
            parts[1];


        try {

            const freshProject =
                await getProject(
                    username,
                    repo
                );


            // =================================================
            // PROJECT NO LONGER EXISTS
            // OR gitprohub.md REMOVED
            // =================================================

            if (!freshProject) {

                const wasRemoved =
                    removeProject(
                        username,
                        repo
                    );


                if (wasRemoved) {

                    removed++;

                    console.log(
                        `🗑️ Removed: ${username}/${repo}`
                    );

                }

                continue;
            }


            // =================================================
            // EXISTING PROJECT UPDATE
            // =================================================

            saveProject(
                freshProject
            );

            updated++;

            console.log(
                `🔄 Updated: ${username}/${repo}`
            );


        } catch (error) {

            errors++;


            // IMPORTANT:
            // API/network error par project delete
            // NAHI hoga.

            console.error(
                `⚠️ Could not check ${username}/${repo}:`,
                error.message
            );

        }

    }


    return {
        checked:
            projects.length,

        updated,

        removed,

        errors
    };
}


// =========================================================
// SAVE / UPDATE ONE PROJECT
// =========================================================

function saveDiscoveredProject(
    project
) {

    if (!project) {
        return {
            added: false,
            updated: false
        };
    }


    const username =
        project?.developer?.username ||
        project?.github?.owner?.login ||
        null;


    const repo =
        project?.github?.name ||
        null;


    if (!username || !repo) {

        console.log(
            "⚠️ Project username/repository missing."
        );

        return {
            added: false,
            updated: false
        };
    }


    const projects =
        getProjects();


    const newKey =
        getProjectKey(project);


    const exists =
        projects.some(
            existing =>
                getProjectKey(existing) ===
                newKey
        );


    saveProject(project);


    if (exists) {

        console.log(
            `🔄 Existing project updated: ${username}/${repo}`
        );

        return {
            added: false,
            updated: true
        };

    }


    console.log(
        `🆕 NEW GitProHub project added: ${username}/${repo}`
    );


    return {
        added: true,
        updated: false
    };
}


// =========================================================
// SCAN ONE GITHUB ACCOUNT
// =========================================================
//
// Account ke ALL PUBLIC repositories check honge.
//
// Root gitprohub.md:
//      → ADD / UPDATE
//
// =========================================================

async function scanGitHubAccount(
    username
) {

    if (!username) {
        return {
            username,
            repositories: 0,
            checked: 0,
            found: 0,
            added: 0,
            updated: 0,
            errors: 0
        };
    }


    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        `🔎 Checking GitHub account: ${username}`
    );

    console.log(
        "=========================================="
    );


    let repositories;


    try {

        repositories =
            await getUserRepositories(
                username
            );


    } catch (error) {

        console.error(
            `❌ Could not load account ${username}:`,
            error.message
        );


        return {
            username,

            repositories: 0,

            checked: 0,

            found: 0,

            added: 0,

            updated: 0,

            errors: 1
        };
    }


    console.log(
        `📦 Public repositories found: ${repositories.length}`
    );


    let checked = 0;
    let found = 0;
    let added = 0;
    let updated = 0;
    let errors = 0;


    for (
        const repository
        of repositories
    ) {

        checked++;


        console.log(
            `🔍 [${checked}/${repositories.length}] ${username}/${repository.name}`
        );


        try {

            const project =
                await getProject(
                    username,
                    repository.name
                );


            // =================================================
            // gitprohub.md FOUND
            // =================================================

            if (project) {

                found++;


                const result =
                    saveDiscoveredProject(
                        project
                    );


                if (result.added) {
                    added++;
                }


                if (result.updated) {
                    updated++;
                }

            }


        } catch (error) {

            errors++;


            console.error(
                `⚠️ Could not check ${username}/${repository.name}:`,
                error.message
            );

        }

    }


    console.log("");

    console.log(
        `🎯 GitProHub projects found in ${username}: ${found}`
    );


    return {

        username,

        repositories:
            repositories.length,

        checked,

        found,

        added,

        updated,

        errors

    };
}


// =========================================================
// DISCOVER NEW GITPROHUB PROJECTS - GLOBAL SEARCH
// =========================================================
//
// GitHub global Code Search:
//
//     filename:gitprohub.md
//
// Koi username hardcode nahi hai.
//
// NOTE:
// GitHub Code Search complete global database guarantee
// nahi karta. Isliye account scanning bhi use ki ja rahi hai.
//
// =========================================================

async function discoverNewGitProHubProjects() {

    console.log("");

    console.log(
        "🔎 Searching GitHub for new GitProHub projects..."
    );


    let repositories;


    try {

        repositories =
            await crawlGitHubGitProHubFiles();


    } catch (error) {

        console.error(
            "❌ Global GitHub discovery failed:",
            error.message
        );


        return {

            discovered: 0,

            added: 0,

            updated: 0,

            repositories: []

        };
    }


    if (
        !Array.isArray(repositories)
    ) {

        repositories = [];

    }


    console.log("");

    console.log(
        `🌐 GitHub repositories discovered: ${repositories.length}`
    );


    let added = 0;
    let updated = 0;


    for (
        const repository
        of repositories
    ) {

        const username =
            repository?.username;

        const repo =
            repository?.repo;


        if (
            !username ||
            !repo
        ) {
            continue;
        }


        console.log(
            `🔍 Checking: ${username}/${repo}`
        );


        try {

            const project =
                await getProject(
                    username,
                    repo
                );


            if (!project) {

                console.log(
                    `⏭️ Skipped: ${username}/${repo}`
                );

                continue;
            }


            const result =
                saveDiscoveredProject(
                    project
                );


            if (result.added) {
                added++;
            }


            if (result.updated) {
                updated++;
            }


        } catch (error) {

            console.error(
                `⚠️ Failed: ${username}/${repo}`,
                error.message
            );

        }

    }


    return {

        discovered:
            repositories.length,

        added,

        updated,

        repositories

    };
}


// =========================================================
// GET KNOWN GITHUB ACCOUNTS
// =========================================================
//
// Existing projects ke developer usernames nikalega.
//
// Example:
//
// haproven/haproven
// haproven/HaproID
// codersusheel/haproglob
//
// Accounts:
//
// haproven
// codersusheel
//
// =========================================================

function getKnownGitHubAccounts() {

    const projects =
        getProjects();


    const accounts =
        new Set();


    for (
        const project
        of projects
    ) {

        const key =
            getProjectKey(project);


        if (!key) {
            continue;
        }


        const parts =
            key.split("/");


        if (parts.length !== 2) {
            continue;
        }


        const username =
            parts[0];


        if (username) {

            accounts.add(
                username
            );

        }

    }


    return Array.from(
        accounts
    );
}


// =========================================================
// SCAN ALL KNOWN ACCOUNTS
// =========================================================
//
// Har known GitHub account ke ALL public repositories
// scan karega.
//
// =========================================================

async function discoverKnownGitHubAccounts() {

    const accounts =
        getKnownGitHubAccounts();


    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        "👥 KNOWN GITHUB ACCOUNT SCANNER"
    );

    console.log(
        `👤 Accounts to scan: ${accounts.length}`
    );

    console.log(
        "=========================================="
    );


    let repositories = 0;
    let checked = 0;
    let found = 0;
    let added = 0;
    let updated = 0;
    let errors = 0;


    for (
        const username
        of accounts
    ) {

        const result =
            await scanGitHubAccount(
                username
            );


        repositories +=
            result.repositories;

        checked +=
            result.checked;

        found +=
            result.found;

        added +=
            result.added;

        updated +=
            result.updated;

        errors +=
            result.errors;

    }


    return {

        accounts:
            accounts.length,

        repositories,

        checked,

        found,

        added,

        updated,

        errors

    };
}


// =========================================================
// MAIN GLOBAL DISCOVERY
// =========================================================

async function discoverAllGitProHubProjects() {

    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        "🌍 GLOBAL GITHUB CRAWLER"
    );

    console.log(
        "=========================================="
    );


    // =================================================
    // STEP 1
    // CHECK OLD PROJECTS
    // =================================================

    const existing =
        await checkExistingProjects();


    // =================================================
    // STEP 2
    // GLOBAL GITHUB SEARCH
    // =================================================

    const discovered =
        await discoverNewGitProHubProjects();


    // =================================================
    // STEP 3
    // SCAN KNOWN GITHUB ACCOUNTS
    // =================================================
    //
    // Ye important part hai.
    //
    // Jo account projects.json me known hai,
    // uske ALL public repositories check honge.
    //
    // =================================================

    const accounts =
        await discoverKnownGitHubAccounts();


    // =================================================
    // FINAL PROJECT LIST
    // =================================================

    const projects =
        getProjects();


    const totalAdded =
        discovered.added +
        accounts.added;


    const totalUpdated =
        existing.updated +
        discovered.updated +
        accounts.updated;


    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        `🎯 Total GitProHub Projects: ${projects.length}`
    );

    console.log(
        `🆕 New projects added: ${totalAdded}`
    );

    console.log(
        `🔄 Projects updated: ${totalUpdated}`
    );

    console.log(
        `🗑️ Projects removed: ${existing.removed}`
    );

    console.log(
        `⚠️ Errors: ${existing.errors + accounts.errors}`
    );

    console.log(
        "=========================================="
    );


    return {

        success: true,

        total:
            projects.length,

        projects,

        // Global search
        discovered:
            discovered.discovered,

        // New projects
        added:
            totalAdded,

        // Updates
        updated:
            totalUpdated,

        // Removed
        removed:
            existing.removed,

        // Existing projects checked
        checked:
            existing.checked,

        // Errors
        errors:
            existing.errors +
            accounts.errors,

        // Account scanner information
        accounts:
            accounts.accounts,

        accountRepositories:
            accounts.repositories,

        accountProjectsFound:
            accounts.found

    };

}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

    checkExistingProjects,

    discoverNewGitProHubProjects,

    scanGitHubAccount,

    discoverKnownGitHubAccounts,

    discoverAllGitProHubProjects

};
