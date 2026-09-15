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

async function getUser(username) {

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
// GET USER REPOSITORIES - ONE PAGE
// =========================================================

async function getUserRepositoriesPage(
    username,
    page = 1,
    perPage = 100
) {

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
// IMPORTANT:
//
// 100 se zyada repositories hone par bhi
// sab repositories fetch hongi.
//
// =========================================================

async function getUserRepositories(
    username
) {

    if (!username) {
        return [];
    }

    const allRepositories = [];

    let page = 1;

    const perPage = 100;

    while (true) {

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

        // -----------------------------------------
        // Last page
        // -----------------------------------------

        if (
            repositories.length < perPage
        ) {
            break;
        }

        page++;

        // -----------------------------------------
        // Safety protection
        // -----------------------------------------

        if (page > 100) {

            console.log(
                `⚠️ Repository pagination safety limit reached for ${username}.`
            );

            break;
        }
    }

    // -----------------------------------------
    // Remove duplicate repositories
    // -----------------------------------------

    const unique =
        new Map();

    for (
        const repository
        of allRepositories
    ) {

        if (!repository?.name) {
            continue;
        }

        const key =
            String(
                repository.name
            ).toLowerCase();

        if (!unique.has(key)) {

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

        // -----------------------------------------
        // 404 means root gitprohub.md not found
        // -----------------------------------------

        if (
            error.message.includes(
                "GitHub API 404"
            )
        ) {

            return null;

        }

        // -----------------------------------------
        // Other errors must propagate
        // -----------------------------------------

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

        // README optional hai.
        // README missing hone par project
        // fail nahi hona chahiye.

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

    // -----------------------------------------
    // Markdown image
    // -----------------------------------------

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

    // -----------------------------------------
    // HTML image
    // -----------------------------------------

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

        // Metadata optional hai.
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
//
// Root-level gitprohub.md.
//
// GitHub search:
//
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

    if (!item) {
        return null;
    }

    // -----------------------------------------
    // item.repository.owner.login
    // -----------------------------------------

    if (
        item.repository?.owner?.login
    ) {

        return String(
            item.repository.owner.login
        ).trim();

    }

    // -----------------------------------------
    // item.repository.full_name
    // -----------------------------------------

    if (
        item.repository?.full_name
    ) {

        const parts =
            String(
                item.repository.full_name
            ).split("/");

        if (parts.length >= 2) {

            return parts[0].trim();

        }
    }

    // -----------------------------------------
    // item.repository.name
    // -----------------------------------------

    if (
        item.repository?.name &&
        String(
            item.repository.name
        ).includes("/")
    ) {

        const parts =
            String(
                item.repository.name
            ).split("/");

        return parts[0].trim();

    }

    return null;
}

// =========================================================
// GET SEARCH RESULT REPOSITORY
// =========================================================

function getSearchResultRepository(
    item
) {

    if (!item) {
        return null;
    }

    // -----------------------------------------
    // repository.name
    // -----------------------------------------

    if (
        item.repository?.name
    ) {

        return String(
            item.repository.name
        ).trim();

    }

    // -----------------------------------------
    // item.repository.full_name
    // -----------------------------------------

    if (
        item.repository?.full_name
    ) {

        const parts =
            String(
                item.repository.full_name
            ).split("/");

        if (parts.length >= 2) {

            return parts
                .slice(1)
                .join("/")
                .trim();

        }
    }

    return null;
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

    const perPage = 100;

    let page = 1;

    let searchCompleted =
        false;

    // -----------------------------------------
    // GitHub Code Search currently exposes
    // a finite searchable result window.
    //
    // Safety limit prevents endless requests.
    // -----------------------------------------

    const MAX_SEARCH_PAGES = 10;

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

            // -----------------------------------------
            // IMPORTANT
            //
            // Already discovered results preserve.
            // Existing projects are NOT deleted.
            // -----------------------------------------

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

        // -----------------------------------------
        // No more results
        // -----------------------------------------

        if (
            items.length === 0
        ) {

            searchCompleted =
                true;

            break;
        }

        // -----------------------------------------
        // Process every result
        // -----------------------------------------

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

            if (
                !username ||
                !repo
            ) {

                console.log(
                    "⚠️ Could not determine owner/repository from search result."
                );

                continue;
            }

            const key =
                `${username}/${repo}`
                    .toLowerCase();

            // -----------------------------------------
            // Unique repository
            // -----------------------------------------

            repositories.set(
                key,
                {
                    username,
                    repo
                }
            );
        }

        // -----------------------------------------
        // Less than 100 = last page
        // -----------------------------------------

        if (
            items.length < perPage
        ) {

            searchCompleted =
                true;

            break;
        }

        page++;
    }

    // -----------------------------------------
    // Safety limit
    // -----------------------------------------

    if (
        page > MAX_SEARCH_PAGES
    ) {

        console.log(
            "⚠️ Global search page safety limit reached."
        );

    }

    // -----------------------------------------
    // Final result
    // -----------------------------------------

    const result =
        Array.from(
            repositories.values()
        );

    console.log("");

    console.log(
        `🌐 Unique GitHub repositories found: ${result.length}`
    );

    // -----------------------------------------
    // Unique accounts
    // -----------------------------------------

    const accountMap =
        new Map();

    for (
        const repository
        of result
    ) {

        const key =
            repository.username
                .toLowerCase();

        if (
            !accountMap.has(key)
        ) {

            accountMap.set(
                key,
                repository.username
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