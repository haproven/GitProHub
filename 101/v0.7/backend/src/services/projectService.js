const {
    getUser,
    getGitProHubFile,
    getRepository,
    getReadme,
    getImageFromReadme
} = require("./githubService");

const {
    parseGitProHub
} = require("./gitprohubParser");


// Get Complete GitProHub Project
async function getProject(username, repo) {

    // GitHub User
    const user = await getUser(username);


    // GitHub Repository
    const repository = await getRepository(
        username,
        repo
    );


    // gitprohub.md
    const content = await getGitProHubFile(
        username,
        repo
    );


    // gitprohub.md is required
    if (!content) {
        return null;
    }


    // Parse metadata
    const metadata = parseGitProHub(content);


    // README
    const readme = await getReadme(
        username,
        repo
    );


    // Image Priority
    let image = metadata.image || null;


    // README image
    if (!image) {
        image = getImageFromReadme(readme);
    }


    // GitHub Social Preview
    if (!image) {
        image = `https://opengraph.githubassets.com/1/${username}/${repo}`;
    }


    // Final Project Object
    return {

        // Project metadata
        ...metadata,


        // Final image
        image,


        // README
        readme,


        // GitHub data
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

    };
}


module.exports = {
    getProject
};
 

// ### Ab next step

// Ab **`server.js`** me jo `/github-project/:username/:repo` ka bada code hai, usko `projectService.js` se connect karke **clean** karenge.

// Yani:

//  text
// server.js
//      ↓
// projectService.js
//      ↓
// githubService.js
//      ↓
// GitHub API
 

// Isse aage **Search + Discovery System** banana easy hoga.
