require("dotenv").config();

const express = require("express");

const {
getUser,
getGitProHubFile,
getRepository
} = require("./services/githubService");

const {
parseGitProHub
} = require("./services/gitprohubParser");

const app = express();

const PORT = process.env.PORT || 3000;

// Home
app.get("/", (req, res) => {
res.send("GitProHub API is running 🚀");
});

// GitHub User
app.get("/github/:username", async (req, res) => {
try {
const user = await getUser(req.params.username);

    res.json({
        success: true,
        username: user.login,
        name: user.name,
        avatar: user.avatar_url,
        github: user.html_url,
        public_repos: user.public_repos
    });

} catch (error) {
    res.status(500).json({
        success: false,
        error: error.message
    });
}

});

// GitProHub Parser Test
app.get("/test-parser", (req, res) => {
const content = `title: GitProHub
description: Universal GitHub project platform
category: Developer Tools
status: In Development`;

const data = parseGitProHub(content);

res.json({
    success: true,
    data: data
});


});

// GitProHub File Test
app.get("/test-gitprohub/:username/:repo", async (req, res) => {
try {
const content = await getGitProHubFile(
req.params.username,
req.params.repo
);

    res.json({
        success: true,
        found: content !== null,
        content: content
    });

} catch (error) {
    res.status(500).json({
        success: false,
        error: error.message
    });
}


});

// GitProHub Project
app.get("/github-project/:username/:repo", async (req, res) => {
try {
const username = req.params.username;
const repo = req.params.repo;

    // GitHub User
    const user = await getUser(username);

    // GitHub Repository
    const repository = await getRepository(username, repo);

    // gitprohub.md
    const content = await getGitProHubFile(username, repo);

    if (!content) {
        return res.json({
            success: false,
            message: "gitprohub.md not found"
        });
    }

    // Parse gitprohub.md
    const metadata = parseGitProHub(content);

    res.json({
        success: true,

        project: {
            // gitprohub.md data
            ...metadata,

            // GitHub repository data
            github: {
                name: repository.name,
                url: repository.html_url,
                description: repository.description,
                stars: repository.stargazers_count,
                forks: repository.forks_count,
                language: repository.language,
                license: repository.license
                    ? repository.license.spdx_id
                    : null,
                created_at: repository.created_at,
                updated_at: repository.updated_at,
                default_branch: repository.default_branch,
                topics: repository.topics || []
            },

            // Developer data
            developer: {
                name: user.name,
                username: user.login,
                avatar: user.avatar_url,
                github: user.html_url
            }
        }
    });

} catch (error) {
    res.status(500).json({
        success: false,
        error: error.message
    });
}

});

// Start Server
app.listen(PORT, () => {
console.log(
`GitProHub Server running on http://localhost:${PORT}`
);
});
