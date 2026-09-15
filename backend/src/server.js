// =========================================================
// GitProHub Server
// =========================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
    getProjects,
    getProjectFromIndex,
    getIndexStats,
    saveProject
} = require("./services/projectIndexService");

const {
    getProject
} = require("./services/projectService");

const {
    getUserRepositories
} = require("./services/githubService");

const {
    registerKnownAccount
} = require("./services/discoveryService");

const {
    runAutoDiscovery
} = require("./services/autoDiscoveryService");


// =========================================================
// App
// =========================================================

const app = express();

app.use(cors());

app.use(
    express.json()
);


// =========================================================
// Health
// =========================================================

app.get(
    "/",
    (req, res) => {

        res.json({
            success: true,

            name:
                "GitProHub API",

            message:
                "GitProHub is running",

            endpoints: [
                "/api/projects",
                "/api/projects/stats",
                "/api/project/:username/:repo",
                "/api/github/:username",
                "/api/discovery/run"
            ]
        });

    }
);


// =========================================================
// Get All Projects
// =========================================================

app.get(
    "/api/projects",
    (req, res) => {

        try {

            const projects =
                getProjects();

            res.json({
                success: true,

                total:
                    projects.length,

                projects
            });

        } catch (error) {

            console.error(
                "❌ Failed to load projects:",
                error.message
            );

            res.status(500).json({
                success: false,

                total: 0,

                projects: [],

                error:
                    error.message
            });

        }

    }
);


// =========================================================
// Project Stats
// =========================================================

app.get(
    "/api/projects/stats",
    (req, res) => {

        try {

            const stats =
                getIndexStats();

            res.json({
                success: true,
                ...stats
            });

        } catch (error) {

            res.status(500).json({
                success: false,

                error:
                    error.message
            });

        }

    }
);


// =========================================================
// Get Single Project
// =========================================================

app.get(
    "/api/project/:username/:repo",
    async (req, res) => {

        const {
            username,
            repo
        } = req.params;

        try {

            // =================================================
            // First check local project index
            // =================================================

            const indexed =
                getProjectFromIndex(
                    username,
                    repo
                );

            if (indexed) {

                // Register owner
                registerKnownAccount(
                    username
                );

                return res.json({
                    success: true,

                    project:
                        indexed
                });

            }


            // =================================================
            // If not found locally,
            // check GitHub directly
            // =================================================

            const project =
                await getProject(
                    username,
                    repo
                );

            if (!project) {

                return res.status(404).json({
                    success: false,

                    message:
                        "GitProHub project not found"
                });

            }


            // =================================================
            // Register GitHub account
            // =================================================

            registerKnownAccount(
                username
            );


            // =================================================
            // Save newly discovered project
            // =================================================

            saveProject(
                project
            );


            res.json({
                success: true,

                project
            });

        } catch (error) {

            console.error(
                `❌ Failed to get project ${username}/${repo}:`,
                error.message
            );

            res.status(500).json({
                success: false,

                error:
                    error.message
            });

        }

    }
);


// =========================================================
// Check GitHub Account
// =========================================================
//
// Example:
//
// http://localhost:3000/api/github/codersusheel
//
// This checks ALL PUBLIC repositories of the account
// and finds repositories containing root gitprohub.md.
//
// The username is automatically registered into:
// data/knownAccounts.json
//
// Therefore future manual discovery can also scan
// this account.
//
// =========================================================

app.get(
    "/api/github/:username",
    async (req, res) => {

        const {
            username
        } = req.params;


        if (!username) {

            return res.status(400).json({
                success: false,

                message:
                    "GitHub username is required"
            });

        }


        // =================================================
        // Register account
        // =================================================

        registerKnownAccount(
            username
        );


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


        try {

            // =================================================
            // Get all public repositories
            // =================================================

            const repositories =
                await getUserRepositories(
                    username
                );


            if (!Array.isArray(repositories)) {

                return res.status(500).json({
                    success: false,

                    username,

                    error:
                        "Invalid repositories response"
                });

            }


            console.log(
                `📦 Public repositories found: ${repositories.length}`
            );


            const projects = [];

            let checked = 0;
            let saved = 0;
            let updated = 0;
            let errors = 0;


            // =================================================
            // Check every repository
            // =================================================

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
                    // gitprohub.md found
                    // =================================================

                    if (project) {

                        projects.push(
                            project
                        );


                        // =============================================
                        // Register owner
                        // =============================================

                        registerKnownAccount(
                            username
                        );


                        // =============================================
                        // Save project
                        // =============================================

                        const result =
                            saveProject(
                                project
                            );


                        if (result?.added) {

                            saved++;

                            console.log(
                                `🆕 GitProHub project ADDED: ${username}/${repository.name}`
                            );

                        } else {

                            updated++;

                            console.log(
                                `🔄 GitProHub project UPDATED: ${username}/${repository.name}`
                            );

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


            // =================================================
            // Final result
            // =================================================

            console.log("");

            console.log(
                `🎯 GitProHub projects found: ${projects.length}`
            );

            console.log(
                `🆕 New projects saved: ${saved}`
            );

            console.log(
                `🔄 Existing projects updated: ${updated}`
            );

            console.log(
                `⚠️ Repository check errors: ${errors}`
            );


            res.json({

                success: true,

                username,

                repositories:
                    repositories.length,

                checked,

                total:
                    projects.length,

                saved,

                updated,

                errors,

                projects

            });


        } catch (error) {

            console.error(
                `❌ GitHub account check failed: ${username}`,
                error.message
            );


            res.status(500).json({

                success: false,

                username,

                error:
                    error.message

            });

        }

    }
);


// =========================================================
// Manual Discovery
// =========================================================
//
// Discovery automatic timer se nahi chalega.
//
// Manually run karne ke liye:
//
// POST /api/discovery/run
//
// =========================================================

app.post(
    "/api/discovery/run",
    async (req, res) => {

        try {

            const result =
                await runAutoDiscovery();

            res.json({

                success: true,

                ...result

            });

        } catch (error) {

            console.error(
                "❌ Manual discovery failed:",
                error.message
            );


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// =========================================================
// Server
// =========================================================

const PORT =
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "=========================================="
        );

        console.log(
            `GitProHub Server running on http://localhost:${PORT}`
        );

        console.log(
            "=========================================="
        );

        console.log(
            "🔹 Automatic discovery timer: OFF"
        );

        console.log(
            "🔹 Manual discovery: POST /api/discovery/run"
        );

    }
);
