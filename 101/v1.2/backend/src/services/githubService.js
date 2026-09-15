// =========================================================
// GitProHub - GitHub Service
// =========================================================

const GITHUB_API =
    "https://api.github.com";


// =========================================================
// GITHUB HEADERS
// =========================================================

function getHeaders() {

    const headers = {

        Accept:
            "application/vnd.github+json",

        "X-GitHub-Api-Version":
            "2022-11-28"
    };


    if (process.env.GITHUB_TOKEN) {

        headers.Authorization =
            `Bearer ${process.env.GITHUB_TOKEN}`;
    }


    return headers;
}


// =========================================================
// GITHUB REQUEST
// =========================================================

async function githubRequest(url) {

    const response =
        await fetch(
            url,
            {
                headers:
                    getHeaders()
            }
        );


    if (!response.ok) {

        const text =
            await response.text();


        throw new Error(
            `GitHub API ${response.status}: ${text}`
        );
    }


    return response.json();
}


// =========================================================
// GET USER
// =========================================================

async function getUser(
    username
) {

    return githubRequest(
        `${GITHUB_API}/users/` +
        `${encodeURIComponent(username)}`
    );
}


// =========================================================
// GET REPOSITORY
// =========================================================

async function getRepository(
    username,
    repo
) {

    return githubRequest(
        `${GITHUB_API}/repos/` +
        `${encodeURIComponent(username)}/` +
        `${encodeURIComponent(repo)}`
    );
}


// =========================================================
// GET USER REPOSITORIES
// =========================================================

async function getUserRepositories(
    username,
    page = 1,
    perPage = 100
) {

    return githubRequest(

        `${GITHUB_API}/users/` +
        `${encodeURIComponent(username)}/repos` +

        `?per_page=${perPage}` +
        `&page=${page}` +
        `&sort=updated`
    );
}


// =========================================================
// GET ROOT gitprohub.md
// =========================================================

async function getGitProHubFile(
    username,
    repo
) {

    try {

        const data =
            await githubRequest(

                `${GITHUB_API}/repos/` +
                `${encodeURIComponent(username)}/` +
                `${encodeURIComponent(repo)}/contents/gitprohub.md`
            );


        if (
            !data ||
            !data.content
        ) {

            return null;
        }


        return Buffer
            .from(
                data.content,
                "base64"
            )
            .toString("utf8");


    } catch (error) {

        // 404 = gitprohub.md does not exist
        if (
            error.message.includes(
                "GitHub API 404"
            )
        ) {

            return null;
        }


        // Network/API error must be
        // passed to discoveryService.
        throw error;
    }
}


// =========================================================
// GET README
// =========================================================

async function getReadme(
    username,
    repo
) {

    try {

        const data =
            await githubRequest(

                `${GITHUB_API}/repos/` +
                `${encodeURIComponent(username)}/` +
                `${encodeURIComponent(repo)}/readme`
            );


        if (
            !data ||
            !data.content
        ) {

            return "";
        }


        return Buffer
            .from(
                data.content,
                "base64"
            )
            .toString("utf8");


    } catch (error) {

        if (
            error.message.includes(
                "GitHub API 404"
            )
        ) {

            return "";
        }


        return "";
    }
}


// =========================================================
// GET IMAGE FROM README
// =========================================================

function getImageFromReadme(
    readme
) {

    if (!readme) {

        return null;
    }


    const markdownImage =
        readme.match(
            /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i
        );


    if (
        markdownImage &&
        markdownImage[1]
    ) {

        return markdownImage[1];
    }


    const htmlImage =
        readme.match(
            /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i
        );


    if (
        htmlImage &&
        htmlImage[1]
    ) {

        return htmlImage[1];
    }


    return null;
}


// =========================================================
// GET FILE METADATA
// =========================================================

async function getFileMetadata(
    username,
    repo,
    filePath
) {

    try {

        return await githubRequest(

            `${GITHUB_API}/repos/` +
            `${encodeURIComponent(username)}/` +
            `${encodeURIComponent(repo)}/contents/` +
            `${filePath}`
        );


    } catch (error) {

        return null;
    }
}


// =========================================================
// GET gitprohub.md METADATA
// =========================================================

async function getGitProHubFileMetadata(
    username,
    repo
) {

    return getFileMetadata(
        username,
        repo,
        "gitprohub.md"
    );
}


// =========================================================
// GITHUB CODE SEARCH
// =========================================================

async function searchGitHubCode(
    query,
    page = 1,
    perPage = 100
) {

    const encodedQuery =
        encodeURIComponent(
            query
        );


    return githubRequest(

        `${GITHUB_API}/search/code` +

        `?q=${encodedQuery}` +

        `&per_page=${perPage}` +

        `&page=${page}`
    );
}


// =========================================================
// SEARCH gitprohub.md
// =========================================================

async function searchGitProHubFiles(
    page = 1,
    perPage = 100
) {

    return searchGitHubCode(
        "filename:gitprohub.md",
        page,
        perPage
    );
}


// =========================================================
// GLOBAL GITHUB CRAWLER
// =========================================================
//
// IMPORTANT:
//
// Sirf:
//     filename:gitprohub.md
//
// Koi username hardcode nahi hai.
//
// GitHub search result se automatically:
//
//     owner → username
//     repository → repo
//
// milega.
// =========================================================

async function crawlGitHubGitProHubFiles() {

    const repositories =
        new Map();


    console.log("");
    console.log(
        "🔎 Global GitHub search: filename:gitprohub.md"
    );


    let page = 1;


    while (true) {

        let result;


        try {

            result =
                await searchGitProHubFiles(
                    page,
                    100
                );


        } catch (error) {

            console.error(
                "❌ GitHub global search failed:",
                error.message
            );


            // IMPORTANT:
            //
            // Search error par existing projects
            // delete nahi honge.
            //
            // Jo results already mile hain
            // unko return karenge.

            break;
        }


        const items =
            result?.items || [];


        console.log(
            `📦 Page ${page}: ${items.length} result(s)`
        );


        if (
            items.length === 0
        ) {

            break;
        }


        // =====================================================
        // GET REPOSITORIES FROM SEARCH RESULTS
        // =====================================================

        for (
            const item of items
        ) {

            const repository =
                item?.repository;


            const username =
                repository?.owner?.login;


            const repo =
                repository?.name;


            if (
                !username ||
                !repo
            ) {

                continue;
            }


            const key =
                `${username}/${repo}`
                    .toLowerCase();


            repositories.set(
                key,
                {
                    username,
                    repo
                }
            );
        }


        // =====================================================
        // LAST PAGE
        // =====================================================

        if (
            items.length < 100
        ) {

            break;
        }


        page++;


        // Safety limit
        //
        // GitHub search API ko unlimited
        // requests nahi bhejne hain.

        if (
            page > 10
        ) {

            console.log(
                "⚠️ Search safety limit reached."
            );

            break;
        }
    }


    console.log("");
    console.log(
        `🌐 Unique GitHub repositories found: ${repositories.size}`
    );


    for (
        const repository of repositories.values()
    ) {

        console.log(
            `   • ${repository.username}/${repository.repo}`
        );
    }


    return [
        ...repositories.values()
    ];
}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

    getUser,

    getRepository,

    getUserRepositories,

    getGitProHubFile,

    getGitProHubFileMetadata,

    getReadme,

    getImageFromReadme,

    getFileMetadata,

    searchGitHubCode,

    searchGitProHubFiles,

    crawlGitHubGitProHubFiles
};
