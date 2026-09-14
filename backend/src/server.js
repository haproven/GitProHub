require("dotenv").config();

const express = require("express");


// ==========================================
// Services
// ==========================================

const {
    getUser,
    getGitProHubFile
} = require("./services/githubService");


const {
    parseGitProHub
} = require("./services/gitprohubParser");


const {
    getProject
} = require("./services/projectService");


// Automatic Discovery
const {
    startAutoDiscovery
} = require("./services/autoDiscoveryService");


// ==========================================
// Routes
// ==========================================

const projectsRouter =
    require("./routes/projects");


const developersRouter =
    require("./routes/developers");


// ==========================================
// App
// ==========================================

const app = express();

const PORT =
    process.env.PORT || 3000;


// ==========================================
// JSON Middleware
// ==========================================

app.use(express.json());


// ==========================================
// Home
// ==========================================

app.get("/", (req, res) => {

    res.send(
        "GitProHub API is running 🚀"
    );

});


// ==========================================
// GitHub User
// ==========================================

app.get(
    "/github/:username",
    async (req, res) => {

        try {

            const user =
                await getUser(
                    req.params.username
                );


            res.json({

                success: true,

                username:
                    user.login,

                name:
                    user.name,

                avatar:
                    user.avatar_url,

                github:
                    user.html_url,

                public_repos:
                    user.public_repos

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// GitProHub Parser Test
// ==========================================

app.get(
    "/test-parser",
    (req, res) => {

        const content = `
title: GitProHub
description: Universal GitHub project platform
category: Developer Tools
status: In Development
tags: github, api, open-source
featured: true
open_source: true
`;


        const data =
            parseGitProHub(
                content
            );


        res.json({

            success: true,

            data:
                data

        });

    }
);


// ==========================================
// GitProHub File Test
// ==========================================

app.get(
    "/test-gitprohub/:username/:repo",
    async (req, res) => {

        try {

            const content =
                await getGitProHubFile(
                    req.params.username,
                    req.params.repo
                );


            res.json({

                success: true,

                found:
                    content !== null,

                content:
                    content

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// GitProHub Project
// ==========================================

app.get(
    "/github-project/:username/:repo",
    async (req, res) => {

        try {

            const project =
                await getProject(
                    req.params.username,
                    req.params.repo
                );


            // gitprohub.md not found
            if (!project) {

                return res.status(404).json({

                    success: false,

                    message:
                        "gitprohub.md not found"

                });

            }


            res.json({

                success: true,

                project:
                    project

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// Projects API
// ==========================================

app.use(
    "/api/projects",
    projectsRouter
);


// ==========================================
// Developers API
// ==========================================

app.use(
    "/api/developers",
    developersRouter
);


// ==========================================
// Start Server
// ==========================================

app.listen(PORT, () => {

    console.log(
        `GitProHub Server running on http://localhost:${PORT}`
    );


    // Start Automatic Discovery
    startAutoDiscovery();

});
 
