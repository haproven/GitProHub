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
    runAutoDiscovery,
    startAutoDiscovery,
    getAutoDiscoveryStatus
} = require("./services/autoDiscoveryService");


const app = express();

app.use(cors());

app.use(
    express.json()
);


app.get(
    "/",
    (req, res) => {

        const discoveryStatus =
            getAutoDiscoveryStatus();

        res.json({

            success: true,

            name:
                "GitProHub API",

            message:
                "GitProHub is running",

            discovery: {
                running:
                    discoveryStatus.running,

                scheduled:
                    discoveryStatus.scheduled,

                interval:
                    discoveryStatus.interval
            },

            endpoints: [
                "/api/projects",
                "/api/projects/stats",
                "/api/project/:username/:repo",
                "/api/github/:username",
                "/api/discovery/run",
                "/api/discovery/status"
            ]
        });
    }
);


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

                registerKnownAccount(
                    username
                );

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


            registerKnownAccount(
                username
            );


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


                    if (project) {

                        projects.push(
                            project
                        );


                        registerKnownAccount(
                            username
                        );


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


app.post(
    "/api/discovery/run",
    async (req, res) => {

        try {

            const result =
                await runAutoDiscovery();


            res.json({

                success:
                    result?.success !== false,

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


app.get(
    "/api/discovery/status",
    (req, res) => {

        try {

            const status =
                getAutoDiscoveryStatus();


            res.json({

                success: true,

                ...status

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


const PORT =
    Number(process.env.PORT) ||
    3000;


const SERVER_START_TIME =
    new Date();


const server =
    app.listen(
        PORT,
        () => {

            console.log("");

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log(
                "🚀 GitProHub Backend Server"
            );

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log(
                `🌐 API: http://localhost:${PORT}`
            );

            console.log(
                `🕐 Started: ${SERVER_START_TIME.toISOString()}`
            );

            console.log(
                "🔐 GitHub API: READY"
            );

            console.log(
                "📦 Project index: READY"
            );

            console.log(
                "🔎 Global discovery: ENABLED"
            );

            console.log(
                "👤 Account discovery: ENABLED"
            );

            console.log(
                "🆕 New project detection: ENABLED"
            );

            console.log(
                "🔄 Project auto-update: ENABLED"
            );

            console.log(
                "🗑️ Removed project detection: ENABLED"
            );

            console.log(
                "🛡️ Discovery error protection: ENABLED"
            );

            console.log(
                "♾️ Continuous discovery: ENABLED"
            );

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log("");


            const discovery =
                startAutoDiscovery(
                    1 * 60 * 1000
                );


            if (discovery?.success) {

                console.log(
                    "✅ Automatic discovery timer: ON"
                );

                console.log(
                    "⏱️ Discovery interval: 1 minute"
                );

            } else {

                console.log(
                    "⚠️ Automatic discovery timer: NOT STARTED"
                );
            }


            console.log("");

            console.log(
                "📡 Manual discovery: POST /api/discovery/run"
            );

            console.log(
                "📊 Discovery status: GET /api/discovery/status"
            );

            console.log(
                "📦 Projects API: GET /api/projects"
            );

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log("");
        }
    );


process.on(
    "SIGINT",
    () => {

        console.log("");

        console.log(
            "🛑 Shutting down GitProHub..."
        );

        server.close(
            () => {

                console.log(
                    "✅ GitProHub server stopped."
                );

                process.exit(0);
            }
        );
    }
);


process.on(
    "SIGTERM",
    () => {

        console.log("");

        console.log(
            "🛑 Shutting down GitProHub..."
        );

        server.close(
            () => {

                console.log(
                    "✅ GitProHub server stopped."
                );

                process.exit(0);
            }
        );
    }
);