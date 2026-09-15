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


    /*
     * GitHub token available hai to
     * authenticated API request use hogi.
     */

    if (
        process.env.GITHUB_TOKEN
    ) {

        headers.Authorization =
            `Bearer ${process.env.GITHUB_TOKEN}`;

    }


    return headers;

}


// =========================================================
// VALIDATION HELPERS
// =========================================================

function isValidUsername(username) {
    if (typeof username !== "string") {
        return false;
    }

    const clean = username.trim();

    if (!clean) {
        return false;
    }

    if (
        clean.includes("/") ||
        clean.includes("\\") ||
        clean.includes(":") ||
        clean.includes(" ")
    ) {
        return false;
    }

    return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(clean);
}


function isValidRepo(
    repo
) {

    if (
        typeof repo !== "string"
    ) {
        return false;
    }

    const clean =
        repo.trim();


    if (!clean) {
        return false;
    }


    if (
        clean.toLowerCase() ===
            "undefined" ||
        clean.toLowerCase() ===
            "null" ||
        clean.toLowerCase() ===
            "unknown"
    ) {

        return false;

    }


    /*
     * Repository name me owner/repo nahi hona chahiye.
     */

    if (
        clean.includes("/") ||
        clean.includes("\\")
    ) {

        return false;

    }


    return true;

}


function isValidRepositoryPath(
    username,
    repo
) {

    return (
        isValidUsername(username) &&
        isValidRepo(repo)
    );

}


// =========================================================
// GITHUB REQUEST
// =========================================================

async function githubRequest(
    url
) {

    const response =
        await fetch(
            url,
            {
                headers:
                    getHeaders()
            }
        );


    /*
     * Successful response.
     */

    if (
        response.ok
    ) {

        return response.json();

    }


    /*
     * Read GitHub error body.
     */

    let text = "";

    try {

        text =
            await response.text();

    } catch {

        text = "";

    }


    /*
     * Keep error short enough for logs.
     */

    let message =
        text || response.statusText || "Unknown GitHub error";


    try {

        const parsed =
            JSON.parse(text);

        if (
            parsed?.message
        ) {

            message =
                parsed.message;

        }

    } catch {

        // Keep original text.

    }


    const error =
        new Error(
            `GitHub API ${response.status}: ${message}`
        );


    /*
     * Useful for callers.
     */

    error.status =
        response.status;

    error.url =
        url;


    throw error;

}


// =========================================================
// GET USER
// =========================================================

async function getUser(
    username
) {

    if (
        !isValidUsername(
            username
        )
    ) {

        throw new Error(
            `Invalid GitHub username: ${username}`
        );

    }


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

    if (
        !isValidRepositoryPath(
            username,
            repo
        )
    ) {

        throw new Error(
            `Invalid GitHub repository: ${username}/${repo}`
        );

    }


    return githubRequest(

        `${GITHUB_API}/repos/` +
        `${encodeURIComponent(username)}/` +
        `${encodeURIComponent(repo)}`

    );

}


// =========================================================
// GET USER REPOSITORIES - ONE PAGE
// =========================================================

async function getUserRepositoriesPage(
    username,
    page = 1,
    perPage = 100
) {

    if (
        !isValidUsername(
            username
        )
    ) {

        throw new Error(
            `Invalid GitHub username: ${username}`
        );

    }


    /*
     * Safety validation.
     */

    page =
        Math.max(
            1,
            Number(page) || 1
        );


    perPage =
        Math.min(
            100,
            Math.max(
                1,
                Number(perPage) || 100
            )
        );


    return githubRequest(

        `${GITHUB_API}/users/` +
        `${encodeURIComponent(username)}/repos` +

        `?per_page=${perPage}` +

        `&page=${page}` +

        `&sort=updated` +

        `&direction=desc`

    );

}


// =========================================================
// GET ALL USER REPOSITORIES
// =========================================================
//
// 100 se zyada repositories hone par bhi
// pagination ke through repositories fetch hongi.
//
// =========================================================

async function getUserRepositories(
    username
) {

    if (
        !isValidUsername(
            username
        )
    ) {

        console.log(
            `⏭️ Invalid GitHub username skipped: ${username}`
        );

        return [];

    }


    const allRepositories =
        [];

    let page =
        1;

    const perPage =
        100;


    /*
     * Safety limit.
     */

    const MAX_PAGES =
        100;


    while (
        page <= MAX_PAGES
    ) {

        const repositories =
            await getUserRepositoriesPage(
                username,
                page,
                perPage
            );


        if (
            !Array.isArray(
                repositories
            )
        ) {

            break;

        }


        allRepositories.push(
            ...repositories
        );


        console.log(
            `📦 ${username} repositories page ${page}: ${repositories.length}`
        );


        /*
         * Last page.
         */

        if (
            repositories.length <
            perPage
        ) {

            break;

        }


        page++;

    }


    /*
     * Safety message.
     */

    if (
        page > MAX_PAGES
    ) {

        console.log(
            `⚠️ Repository pagination safety limit reached for ${username}.`
        );

    }


    /*
     * Remove duplicate repositories.
     */

    const unique =
        new Map();


    for (
        const repository
        of allRepositories
    ) {

        if (
            !repository?.name
        ) {

            continue;

        }


        const name =
            String(
                repository.name
            ).trim();


        if (
            !isValidRepo(
                name
            )
        ) {

            continue;

        }


        const key =
            name.toLowerCase();


        if (
            !unique.has(
                key
            )
        ) {

            unique.set(
                key,
                repository
            );

        }

    }


    return Array.from(
        unique.values()
    );

}


// =========================================================
// GET ROOT gitprohub.md
// =========================================================
//
// IMPORTANT:
// Only root-level gitprohub.md is accepted.
//
// =========================================================

async function getGitProHubFile(
    username,
    repo
) {

    if (
        !isValidRepositoryPath(
            username,
            repo
        )
    ) {

        return null;

    }


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

        /*
         * 404 means root gitprohub.md
         * does not exist.
         *
         * This is NOT an error.
         */

        if (
            error.status === 404
        ) {

            return null;

        }


        /*
         * Other API/network errors must
         * propagate to caller.
         */

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

    if (
        !isValidRepositoryPath(
            username,
            repo
        )
    ) {

        return "";

    }


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

        /*
         * README is optional.
         *
         * Missing README should not
         * make project fail.
         */

        if (
            error.status === 404
        ) {

            return "";

        }


        /*
         * Other README errors are also
         * ignored because README is
         * optional.
         */

        return "";

    }

}


// =========================================================
// GET IMAGE FROM README
// =========================================================

function getImageFromReadme(
    readme
) {

    if (
        !readme
    ) {

        return null;

    }


    /*
     * Markdown image.
     */

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


    /*
     * HTML image.
     */

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

    if (
        !isValidRepositoryPath(
            username,
            repo
        )
    ) {

        return null;

    }


    if (
        !filePath ||
        typeof filePath !== "string"
    ) {

        return null;

    }


    try {

        return await githubRequest(

            `${GITHUB_API}/repos/` +
            `${encodeURIComponent(username)}/` +
            `${encodeURIComponent(repo)}/contents/` +
            `${filePath
                .split("/")
                .map(
                    part =>
                        encodeURIComponent(part)
                )
                .join("/")}`

        );


    } catch (error) {

        /*
         * File missing = optional.
         */

        if (
            error.status === 404
        ) {

            return null;

        }


        /*
         * IMPORTANT:
         *
         * API/network/rate-limit errors
         * should NOT silently disappear.
         */

        throw error;

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

    if (
        !query ||
        typeof query !== "string"
    ) {

        throw new Error(
            "GitHub search query is required."
        );

    }


    page =
        Math.max(
            1,
            Number(page) || 1
        );


    perPage =
        Math.min(
            100,
            Math.max(
                1,
                Number(perPage) || 100
            )
        );


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
//
// Root-level gitprohub.md.
//
// GitHub Code Search query:
// filename:gitprohub.md
//
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
// GET SEARCH RESULT OWNER
// =========================================================

function getSearchResultOwner(
    item
) {

    if (
        !item
    ) {

        return null;

    }


    let username =
        null;


    /*
     * repository.owner.login
     */

    if (
        item.repository?.owner?.login
    ) {

        username =
            item.repository.owner.login;

    }


    /*
     * repository.full_name
     */

    else if (
        item.repository?.full_name
    ) {

        const parts =
            String(
                item.repository.full_name
            ).split("/");


        if (
            parts.length >= 2
        ) {

            username =
                parts[0].trim();

        }

    }


    /*
     * repository.name may contain
     * owner/repo in some responses.
     */

    else if (
        item.repository?.name &&
        String(
            item.repository.name
        ).includes("/")
    ) {

        const parts =
            String(
                item.repository.name
            ).split("/");


        username =
            parts[0].trim();

    }


    if (
        !isValidUsername(
            username
        )
    ) {

        return null;

    }


    return String(
        username
    ).trim();

}


// =========================================================
// GET SEARCH RESULT REPOSITORY
// =========================================================

function getSearchResultRepository(
    item
) {

    if (
        !item
    ) {

        return null;

    }


    let repo =
        null;


    /*
     * repository.name
     *
     * GitHub Code Search normally provides
     * the repository name here.
     */

    if (
        item.repository?.name
    ) {

        repo =
            String(
                item.repository.name
            ).trim();

    }


    /*
     * Fallback: full_name
     */

    else if (
        item.repository?.full_name
    ) {

        const parts =
            String(
                item.repository.full_name
            ).split("/");


        if (
            parts.length >= 2
        ) {

            repo =
                parts
                    .slice(1)
                    .join("/")
                    .trim();

        }

    }


    /*
     * Some API responses may expose
     * name directly.
     */

    else if (
        item.name
    ) {

        repo =
            String(
                item.name
            ).trim();

    }


    /*
     * If repository.name itself is owner/repo,
     * extract only repository part.
     */

    if (
        repo &&
        repo.includes("/")
    ) {

        repo =
            repo
                .split("/")
                .slice(1)
                .join("/")
                .trim();

    }


    if (
        !isValidRepo(
            repo
        )
    ) {

        return null;

    }


    return repo;

}


// =========================================================
// GLOBAL GITHUB CRAWLER
// =========================================================
//
// Search:
//     filename:gitprohub.md
//
// Result:
//     username
//     repo
//
// No username hardcoded.
//
// =========================================================

async function crawlGitHubGitProHubFiles() {

    const repositories =
        new Map();


    console.log("");

    console.log(
        "🔎 Global GitHub search: filename:gitprohub.md"
    );

    console.log(
        "🌍 Searching across public GitHub repositories..."
    );


    const perPage =
        100;

    let page =
        1;

    let searchCompleted =
        false;


    /*
     * GitHub Code Search has a finite
     * searchable result window.
     */

    const MAX_SEARCH_PAGES =
        10;


    while (
        page <= MAX_SEARCH_PAGES
    ) {

        let result;


        try {

            result =
                await searchGitProHubFiles(
                    page,
                    perPage
                );


        } catch (error) {

            console.error(
                `❌ GitHub global search failed on page ${page}:`,
                error.message
            );


            /*
             * IMPORTANT:
             *
             * Already discovered repositories
             * are preserved.
             *
             * Do not delete existing projects.
             */

            break;

        }


        const items =
            Array.isArray(
                result?.items
            )
                ? result.items
                : [];


        console.log(
            `📦 Global search page ${page}: ${items.length} result(s)`
        );


        /*
         * No more results.
         */

        if (
            items.length === 0
        ) {

            searchCompleted =
                true;

            break;

        }


        /*
         * Process search results.
         */

        for (
            const item
            of items
        ) {

            const username =
                getSearchResultOwner(
                    item
                );


            const repo =
                getSearchResultRepository(
                    item
                );


            /*
             * Reject malformed search result.
             */

            if (
                !isValidRepositoryPath(
                    username,
                    repo
                )
            ) {

                console.log(
                    "⏭️ Invalid GitHub search result skipped."
                );

                continue;

            }


            const key =
                `${username}/${repo}`
                    .toLowerCase();


            /*
             * Unique repository.
             */

            if (
                !repositories.has(
                    key
                )
            ) {

                repositories.set(
                    key,
                    {
                        username,
                        repo
                    }
                );

            }

        }


        /*
         * Less than perPage =
         * last page.
         */

        if (
            items.length <
            perPage
        ) {

            searchCompleted =
                true;

            break;

        }


        page++;

    }


    /*
     * Safety limit reached.
     */

    if (
        page > MAX_SEARCH_PAGES
    ) {

        console.log(
            "⚠️ Global search page safety limit reached."
        );

    }


    /*
     * Final result.
     */

    const result =
        Array.from(
            repositories.values()
        );


    console.log("");

    console.log(
        `🌐 Unique GitHub repositories found: ${result.length}`
    );


    /*
     * Unique accounts.
     */

    const accountMap =
        new Map();


    for (
        const repository
        of result
    ) {

        const username =
            repository.username;


        const key =
            username.toLowerCase();


        if (
            !accountMap.has(
                key
            )
        ) {

            accountMap.set(
                key,
                username
            );

        }

    }


    console.log(
        `👥 Unique GitHub accounts discovered: ${accountMap.size}`
    );


    for (
        const username
        of accountMap.values()
    ) {

        console.log(
            `   👤 ${username}`
        );

    }


    console.log("");


    for (
        const repository
        of result
    ) {

        console.log(
            `   • ${repository.username}/${repository.repo}`
        );

    }


    if (
        searchCompleted
    ) {

        console.log(
            "✅ Global GitHub search completed."
        );

    } else {

        console.log(
            "⚠️ Global GitHub search stopped before complete pagination."
        );

    }


    return result;

}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {
    getUser,
    getRepository,
    getUserRepositoriesPage,
    getUserRepositories,
    getGitProHubFile,
    getGitProHubFileMetadata,
    getReadme,
    getImageFromReadme,
    getFileMetadata,
    searchGitHubCode,
    searchGitProHubFiles,
    getSearchResultOwner,
    getSearchResultRepository,
    crawlGitHubGitProHubFiles,

    // IMPORTANT
    isValidUsername
};


