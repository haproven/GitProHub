//  js
const { getGitProHubFile } = require("./githubService");

const { getProject } = require("./projectService");

const { saveProject } = require("./projectIndexService");


const GITHUB_API = "https://api.github.com";


// GitHub API Headers
function getHeaders() {

    return {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
    };

}


// Search GitHub Repositories
async function searchGitProHubProjects(page = 1, perPage = 30) {

    const query = encodeURIComponent(
        "filename:gitprohub.md"
    );


    const url =
        `${GITHUB_API}/search/code?q=${query}` +
        `&per_page=${perPage}` +
        `&page=${page}`;


    const response = await fetch(url, {
        headers: getHeaders()
    });


    if (!response.ok) {

        throw new Error(
            `GitHub Search API Error: ${response.status}`
        );

    }


    const data = await response.json();

    return data;

}


// Check GitProHub File
async function hasGitProHubFile(owner, repo) {

    const content = await getGitProHubFile(
        owner,
        repo
    );


    return content !== null;

}


// Discover GitProHub Projects
async function discoverProjects(page = 1, perPage = 30) {

    const searchResult =
        await searchGitProHubProjects(
            page,
            perPage
        );


    const items =
        searchResult.items || [];


    const projects = [];


    for (const item of items) {

        let owner = "";
        let repo = "";


        try {

            owner =
                item.repository.owner.login;

            repo =
                item.repository.name;


            // Check gitprohub.md
            const hasFile =
                await hasGitProHubFile(
                    owner,
                    repo
                );


            if (!hasFile) {
                continue;
            }


            // Get complete project
            const project =
                await getProject(
                    owner,
                    repo
                );


            if (!project) {
                continue;
            }


            // Save / Update Project Index
            saveProject(project);


            // Add to current discovery result
            projects.push(project);


        } catch (error) {

            console.error(
                `Project discovery failed: ${owner}/${repo}`,
                error.message
            );

        }

    }


    return {

        total: projects.length,

        projects: projects,

        search: {

            total_count:
                searchResult.total_count || 0,

            page: page,

            per_page: perPage

        }

    };

}


// Export
module.exports = {

    searchGitProHubProjects,

    hasGitProHubFile,

    discoverProjects

};
 
