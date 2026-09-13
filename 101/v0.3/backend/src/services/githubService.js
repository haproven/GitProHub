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

module.exports = {
    getUser
};