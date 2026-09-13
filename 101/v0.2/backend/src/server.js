require("dotenv").config();

const express = require("express");
const { getUser } = require("./services/githubService");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("GitProHub API is running 🚀");
});

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

app.listen(PORT, () => {
    console.log(`GitProHub Server running on http://localhost:${PORT}`);
});