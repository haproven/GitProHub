const API_URL = "https://api.github.com";

async function getUser(username) {
    const response = await fetch(`${API_URL}/users/${username}`, {
        headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
    }

    return response.json();
}

async function getGitProHubFile(username, repo) {
    const response = await fetch(
        `${API_URL}/repos/${username}/${repo}/contents/gitprohub.md`,
        {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }

        throw new Error(`GitHub API Error: ${response.status}`);
    }

    const file = await response.json();

    return Buffer.from(file.content, "base64").toString("utf-8");
}

module.exports = {
    getUser,
    getGitProHubFile
};






