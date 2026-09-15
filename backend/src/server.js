// =========================================================
// GitProHub Server
// =========================================================

require("dotenv").config();

const express =
    require("express");

const cors =
    require("cors");

const {
    getProjects,
    getProjectFromIndex,
    getIndexStats
} = require("./services/projectIndexService");

const {
    getProject
} = require("./services/projectService");

const {
    getUserRepositories
} = require("./services/githubService");

const {
    runAutoDiscovery,
    startAutoDiscovery
} = require("./services/autoDiscoveryService");


// =========================================================
// App
// =========================================================

const app =
    express();

app.use(
    cors()
);

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

            res.status(500).json({

                success: false,

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

            const indexed =
                getProjectFromIndex(
                    username,
                    repo
                );

            if (indexed) {

                return res.json({

                    success: true,

                    project:
                        indexed

                });

            }


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


            res.json({

                success: true,

                project

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
// Check GitHub Account
// =========================================================
//
// Example:
//
// http://localhost:3000/api/github/codersusheel
//
// This checks all PUBLIC repositories of the account
// and finds repositories containing root gitprohub.md
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

            // Get all public repositories
            const repositories =
                await getUserRepositories(
                    username
                );


            console.log(
                `📦 Public repositories found: ${repositories.length}`
            );


            const projects = [];

            let checked = 0;


            // Check every repository
            for (const repository of repositories) {

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


                    // gitprohub.md found
                    if (project) {

                        projects.push(
                            project
                        );


                        console.log(
                            `✅ GitProHub project found: ${username}/${repository.name}`
                        );

                    }

                } catch (error) {

                    console.error(

                        `⚠️ Could not check ${username}/${repository.name}:`,

                        error.message

                    );

                }

            }


            console.log("");

            console.log(
                `🎯 GitProHub projects found: ${projects.length}`
            );


            res.json({

                success: true,

                username,

                repositories:
                    repositories.length,

                checked,

                total:
                    projects.length,

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


        // Start universal discovery
        startAutoDiscovery(
            1 * 60 * 1000
        );

    }
);
