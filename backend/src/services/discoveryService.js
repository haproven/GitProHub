// =========================================================
// GitProHub - Discovery Service
// =========================================================

const {
    crawlGitHubGitProHubFiles
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


    for (
        const project of projects
    ) {

        const key =
            getProjectKey(project);


        if (!key) {
            continue;
        }


        const parts =
            key.split("/");


        if (
            parts.length !== 2
        ) {
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
// DISCOVER NEW GITPROHUB PROJECTS
// =========================================================
//
// GitHub par:
//
//      filename:gitprohub.md
//
// search hoga.
//
// Koi username hardcode nahi hai.
//
// New project:
//      → ADD
//
// Existing:
//      → UPDATE
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


    // =========================================================
    // PROCESS EVERY DISCOVERED REPOSITORY
    // =========================================================

    for (
        const repository of repositories
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


            // =================================================
            // gitprohub.md NOT FOUND
            // =================================================

            if (!project) {

                console.log(
                    `⏭️ Skipped: ${username}/${repo}`
                );

                continue;
            }


            // =================================================
            // CHECK WHETHER ALREADY EXISTS
            // =================================================

            const existingProjects =
                getProjects();


            const newKey =
                getProjectKey(
                    project
                );


            const alreadyExists =
                existingProjects.some(
                    existing =>
                        getProjectKey(existing) ===
                        newKey
                );


            // =================================================
            // NEW PROJECT
            // =================================================

            if (!alreadyExists) {

                saveProject(
                    project
                );

                added++;


                console.log(
                    `🆕 NEW GitProHub project added: ${username}/${repo}`
                );


                continue;
            }


            // =================================================
            // EXISTING PROJECT
            // =================================================

            saveProject(
                project
            );

            updated++;


            console.log(
                `🔄 Existing project updated: ${username}/${repo}`
            );


        } catch (error) {

            // API/network error par crawler continue karega.

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


    // =========================================================
    // STEP 1
    // CHECK OLD PROJECTS
    // =========================================================

    const existing =
        await checkExistingProjects();


    // =========================================================
    // STEP 2
    // FIND NEW PROJECTS
    // =========================================================

    const discovered =
        await discoverNewGitProHubProjects();


    // =========================================================
    // FINAL PROJECT LIST
    // =========================================================

    const projects =
        getProjects();


    console.log("");
    console.log(
        "=========================================="
    );

    console.log(
        `🎯 Total GitProHub Projects: ${projects.length}`
    );

    console.log(
        `🆕 New projects added: ${discovered.added}`
    );

    console.log(
        `🔄 Projects updated: ${existing.updated}`
    );

    console.log(
        `🗑️ Projects removed: ${existing.removed}`
    );

    console.log(
        `⚠️ Existing check errors: ${existing.errors}`
    );

    console.log(
        "=========================================="
    );


    return {

        success: true,

        total:
            projects.length,

        projects,

        discovered:
            discovered.discovered,

        added:
            discovered.added,

        updated:
            existing.updated,

        removed:
            existing.removed,

        checked:
            existing.checked,

        errors:
            existing.errors
    };
}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

    checkExistingProjects,

    discoverNewGitProHubProjects,

    discoverAllGitProHubProjects

};