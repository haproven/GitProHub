// =========================================================
// GitProHub Project Service
// =========================================================

const {

    getUser,
    getGitProHubFile,
    getGitProHubFileMetadata,
    getRepository,
    getReadme,
    getImageFromReadme

} = require("./githubService");


const {
    parseGitProHub
} = require("./gitprohubParser");


// =========================================================
// Get Complete Project
// =========================================================

async function getProject(
    username,
    repo
) {

    const repository =
        await getRepository(
            username,
            repo
        );


    // -----------------------------------------------------
    // Private / unavailable repository
    // -----------------------------------------------------

    if (
        !repository ||
        repository.private
    ) {

        return null;
    }


    // -----------------------------------------------------
    // Get gitprohub.md
    // -----------------------------------------------------

    const content =
        await getGitProHubFile(
            username,
            repo
        );


    if (!content) {

        return null;
    }


    // -----------------------------------------------------
    // Parse
    // -----------------------------------------------------

    const metadata =
        parseGitProHub(
            content
        );


    // -----------------------------------------------------
    // User
    // -----------------------------------------------------

    const user =
        await getUser(
            username
        );


    // -----------------------------------------------------
    // README
    // -----------------------------------------------------

    const readme =
        await getReadme(
            username,
            repo
        );


    // -----------------------------------------------------
    // Image
    // -----------------------------------------------------

    let image =
        metadata.image ||
        null;


    if (!image) {

        image =
            getImageFromReadme(
                readme
            );
    }


    if (!image) {

        image =
            `https://opengraph.githubassets.com/1/` +
            `${username}/${repo}`;
    }


    // -----------------------------------------------------
    // gitprohub.md metadata
    // -----------------------------------------------------

    const fileMetadata =
        await getGitProHubFileMetadata(
            username,
            repo
        );


    // -----------------------------------------------------
    // Complete Project
    // -----------------------------------------------------

    return {

        ...metadata,

        image,

        gitprohub: {

            path: "gitprohub.md",

            sha:
                fileMetadata?.sha ||
                null,

            size:
                fileMetadata?.size ||
                null,

            url:
                fileMetadata?.html_url ||
                null

        },

        readme,

        github: {

            name:
                repository.name,

            url:
                repository.html_url,

            description:
                repository.description,

            stars:
                repository.stargazers_count,

            forks:
                repository.forks_count,

            language:
                repository.language,

            license:
                repository.license
                    ? repository.license.spdx_id
                    : null,

            created_at:
                repository.created_at,

            updated_at:
                repository.updated_at,

            pushed_at:
                repository.pushed_at,

            default_branch:
                repository.default_branch,

            topics:
                repository.topics || [],

            archived:
                repository.archived,

            fork:
                repository.fork
        },


        developer: {

            name:
                user.name,

            username:
                user.login,

            avatar:
                user.avatar_url,

            github:
                user.html_url,

            bio:
                user.bio,

            followers:
                user.followers,

            public_repos:
                user.public_repos
        }

    };
}


// =========================================================
// Check Project
// =========================================================

async function checkProject(
    username,
    repo
) {

    try {

        const project =
            await getProject(
                username,
                repo
            );


        if (!project) {

            return {
                exists: false,
                project: null
            };
        }


        return {

            exists: true,
            project

        };

    } catch (error) {

        console.error(
            `Project check failed: ${username}/${repo}`,
            error.message
        );


        return {

            exists: false,
            project: null,
            error: error.message

        };
    }
}


// =========================================================
// Export
// =========================================================

module.exports = {

    getProject,
    checkProject

};