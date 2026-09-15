const fs = require("fs");
const path = require("path");

const {
    getUser,
    getUserRepositories,
    getGitProHubFile,
    crawlGitHubGitProHubFiles,
    isValidUsername
} = require("./githubService");

const {
    getProject
} = require("./projectService");

const {
    saveProject,
    getProjects,
    removeProject,
    getProjectKey
} = require("./projectIndexService");


// ============================================================
// PATHS
// ============================================================

const DATA_DIR =
    path.join(process.cwd(), "data");

const KNOWN_ACCOUNTS_FILE =
    path.join(
        DATA_DIR,
        "knownAccounts.json"
    );


// ============================================================
// ENSURE DATA DIRECTORY
// ============================================================

function ensureDataDirectory() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

}


// ============================================================
// READ KNOWN ACCOUNTS
// ============================================================

function readKnownAccounts() {

    ensureDataDirectory();

    if (!fs.existsSync(KNOWN_ACCOUNTS_FILE)) {
        return [];
    }

    try {

        const raw =
            fs.readFileSync(
                KNOWN_ACCOUNTS_FILE,
                "utf8"
            );

        if (!raw.trim()) {
            return [];
        }

        const data =
            JSON.parse(raw);

        if (!Array.isArray(data)) {

            console.log(
                "⚠️ knownAccounts.json is not an array."
            );

            return [];
        }

        return data;

    } catch (error) {

        console.error(
            "❌ Could not read knownAccounts.json:",
            error.message
        );

        return [];
    }

}


// ============================================================
// WRITE KNOWN ACCOUNTS
// ============================================================

function writeKnownAccounts(accounts) {

    ensureDataDirectory();

    const byId =
        new Map();

    const byLogin =
        new Map();

    for (const account of accounts) {

        if (!account) {
            continue;
        }

        let id = null;
        let login = null;

        // ----------------------------------------------------
        // New format
        // ----------------------------------------------------

        if (
            typeof account === "object"
        ) {

            id =
                account.id ??
                null;

            login =
                account.login ??
                null;

        }

        // ----------------------------------------------------
        // Old format
        // ----------------------------------------------------

        if (
            typeof account === "string"
        ) {

            login =
                account;

        }

        if (!login) {
            continue;
        }

        login =
            String(login).trim();

        if (
            !isValidUsername(login)
        ) {
            continue;
        }

        const normalizedLogin =
            login.toLowerCase();

        const cleanAccount = {
            id:
                id || null,

            login
        };

        // ----------------------------------------------------
        // GitHub ID has highest priority
        // ----------------------------------------------------

        if (id) {

            byId.set(
                String(id),
                cleanAccount
            );

        } else if (
            !byLogin.has(
                normalizedLogin
            )
        ) {

            byLogin.set(
                normalizedLogin,
                cleanAccount
            );

        }

    }


    // --------------------------------------------------------
    // Merge login-only accounts that do not conflict with ID
    // --------------------------------------------------------

    for (const account of byLogin.values()) {

        const alreadyExists =
            Array.from(
                byId.values()
            ).some(
                item =>
                    item.login.toLowerCase() ===
                    account.login.toLowerCase()
            );

        if (!alreadyExists) {

            byLogin.set(
                account.login.toLowerCase(),
                account
            );

        }

    }


    const result =
        Array.from(
            new Map(
                [
                    ...Array.from(
                        byId.values()
                    ),
                    ...Array.from(
                        byLogin.values()
                    )
                ].map(
                    account => [
                        account.id
                            ? `id:${account.id}`
                            : `login:${account.login.toLowerCase()}`,
                        account
                    ]
                )
            ).values()
        );


    fs.writeFileSync(
        KNOWN_ACCOUNTS_FILE,
        JSON.stringify(
            result,
            null,
            2
        ),
        "utf8"
    );


    return result;
}


// ============================================================
// NORMALIZE ACCOUNT
// ============================================================

function normalizeAccount(account) {

    if (!account) {
        return null;
    }


    // --------------------------------------------------------
    // Old string format
    // --------------------------------------------------------

    if (
        typeof account === "string"
    ) {

        const login =
            account.trim();

        if (
            !isValidUsername(login)
        ) {
            return null;
        }

        return {
            id: null,
            login
        };

    }


    // --------------------------------------------------------
    // New object format
    // --------------------------------------------------------

    if (
        typeof account === "object"
    ) {

        const login =
            account.login
                ? String(
                    account.login
                ).trim()
                : "";

        if (
            !isValidUsername(login)
        ) {
            return null;
        }

        return {
            id:
                account.id ??
                null,

            login
        };

    }


    return null;
}


// ============================================================
// FIND ACCOUNT BY ID
// ============================================================

function findAccountById(
    accounts,
    id
) {

    if (!id) {
        return null;
    }

    return accounts.find(
        account => {

            const normalized =
                normalizeAccount(
                    account
                );

            if (!normalized) {
                return false;
            }

            return (
                normalized.id &&
                String(
                    normalized.id
                ) ===
                String(id)
            );

        }
    ) || null;
}


// ============================================================
// FIND ACCOUNT BY LOGIN
// ============================================================

function findAccountByLogin(
    accounts,
    login
) {

    if (!login) {
        return null;
    }

    const cleanLogin =
        String(login)
            .trim()
            .toLowerCase();

    return accounts.find(
        account => {

            const normalized =
                normalizeAccount(
                    account
                );

            if (!normalized) {
                return false;
            }

            return (
                normalized.login
                    .toLowerCase() ===
                cleanLogin
            );

        }
    ) || null;
}


// ============================================================
// GET NORMALIZED KNOWN ACCOUNTS
// ============================================================

function getNormalizedKnownAccounts() {

    const rawAccounts =
        readKnownAccounts();

    const normalized = [];

    const seenIds =
        new Set();

    const seenLogins =
        new Set();


    for (
        const account
        of rawAccounts
    ) {

        const item =
            normalizeAccount(
                account
            );

        if (!item) {
            continue;
        }


        // ----------------------------------------------------
        // ID based duplicate protection
        // ----------------------------------------------------

        if (item.id) {

            const idKey =
                String(item.id);

            if (
                seenIds.has(idKey)
            ) {
                continue;
            }

            seenIds.add(idKey);

        }


        // ----------------------------------------------------
        // Login based duplicate protection
        // ----------------------------------------------------

        const loginKey =
            item.login.toLowerCase();

        if (
            seenLogins.has(loginKey)
        ) {
            continue;
        }

        seenLogins.add(loginKey);


        normalized.push(item);

    }


    return normalized;
}


// ============================================================
// GET KNOWN GITHUB ACCOUNTS
// ============================================================
//
// Known accounts + existing project owners
//
// No GitHub API request is made here.
// ============================================================

function getKnownGitHubAccounts() {

    const accounts =
        getNormalizedKnownAccounts();

    const mapById =
        new Map();

    const mapByLogin =
        new Map();


    // --------------------------------------------------------
    // Known accounts
    // --------------------------------------------------------

    for (
        const account
        of accounts
    ) {

        if (account.id) {

            mapById.set(
                String(account.id),
                account
            );

        } else {

            mapByLogin.set(
                account.login.toLowerCase(),
                account
            );

        }

    }


    // --------------------------------------------------------
    // Existing project owners
    // --------------------------------------------------------

    let projects = [];

    try {

        projects =
            getProjects();

    } catch (error) {

        console.log(
            "⚠️ Could not read existing projects:",
            error.message
        );

    }


    if (
        Array.isArray(projects)
    ) {

        for (
            const project
            of projects
        ) {

            const username =
                project?.developer?.username ||
                project?.github?.owner?.login ||
                project?.owner ||
                null;

            if (!username) {
                continue;
            }

            const login =
                String(username).trim();

            if (
                !isValidUsername(login)
            ) {
                continue;
            }


            const key =
                login.toLowerCase();


            if (
                !mapByLogin.has(key)
            ) {

                mapByLogin.set(
                    key,
                    {
                        id: null,
                        login
                    }
                );

            }

        }

    }


    return [
        ...Array.from(
            mapById.values()
        ),
        ...Array.from(
            mapByLogin.values()
        )
    ];

}


// ============================================================
// VERIFY GITHUB ACCOUNT
// ============================================================
//
// IMPORTANT:
// One caller should cache this result for the current cycle.
// ============================================================

async function verifyGitHubAccount(
    username
) {

    if (
        !isValidUsername(username)
    ) {

        console.log(
            `⏭️ Invalid GitHub username skipped: ${username}`
        );

        return {
            success: false,
            exists: false,
            error:
                "Invalid GitHub username"
        };

    }


    const cleanUsername =
        String(username).trim();


    try {

        console.log(
            `🔍 Verifying GitHub account: ${cleanUsername}`
        );


        const user =
            await getUser(
                cleanUsername
            );


        if (
            !user ||
            !user.id ||
            !user.login
        ) {

            return {
                success: false,
                exists: false,
                error:
                    "GitHub account not found"
            };

        }


        const verifiedLogin =
            String(
                user.login
            ).trim();


        console.log(
            `✅ GitHub account verified: ${verifiedLogin} (ID: ${user.id})`
        );


        return {

            success: true,

            exists: true,

            user,

            id:
                user.id,

            login:
                verifiedLogin

        };


    } catch (error) {

        console.log(
            `⚠️ GitHub account verification failed: ${cleanUsername} → ${error.message}`
        );


        return {

            success: false,

            exists: false,

            error:
                error.message,

            status:
                error.status ||
                null

        };

    }

}


// ============================================================
// UPDATE KNOWN ACCOUNT FROM VERIFIED USER
// ============================================================
//
// IMPORTANT:
// No GitHub API call here.
// User has already been verified.
// ============================================================

function saveVerifiedAccount(
    user
) {

    if (
        !user ||
        !user.id ||
        !user.login
    ) {

        return {
            success: false,
            added: false,
            updated: false,
            newAccount: false
        };

    }


    const githubId =
        user.id;

    const githubLogin =
        String(
            user.login
        ).trim();


    if (
        !isValidUsername(
            githubLogin
        )
    ) {

        return {
            success: false,
            added: false,
            updated: false,
            newAccount: false
        };

    }


    const accounts =
        getNormalizedKnownAccounts();


    // --------------------------------------------------------
    // Find by GitHub ID first
    // --------------------------------------------------------

    const accountById =
        findAccountById(
            accounts,
            githubId
        );


    if (accountById) {

        let changed = false;

        const oldLogin =
            accountById.login;


        // ----------------------------------------------------
        // Username rename
        // ----------------------------------------------------

        if (
            oldLogin.toLowerCase() !==
            githubLogin.toLowerCase()
        ) {

            console.log(
                `🔄 GitHub username changed: ${oldLogin} → ${githubLogin}`
            );

            accountById.login =
                githubLogin;

            changed = true;

        }


        if (
            String(accountById.id) !==
            String(githubId)
        ) {

            accountById.id =
                githubId;

            changed = true;

        }


        if (changed) {

            writeKnownAccounts(
                accounts
            );

            console.log(
                `✅ Account record updated: ${githubLogin}`
            );

        }


        return {

            success: true,

            added: false,

            updated: changed,

            newAccount: false,

            username:
                githubLogin,

            id:
                githubId

        };

    }


    // --------------------------------------------------------
    // Find by login
    // --------------------------------------------------------

    const accountByLogin =
        findAccountByLogin(
            accounts,
            githubLogin
        );


    if (accountByLogin) {

        accountByLogin.id =
            githubId;

        accountByLogin.login =
            githubLogin;


        writeKnownAccounts(
            accounts
        );


        console.log(
            `🔗 GitHub ID attached to existing account: ${githubLogin}`
        );


        return {

            success: true,

            added: false,

            updated: true,

            newAccount: false,

            username:
                githubLogin,

            id:
                githubId

        };

    }


    // --------------------------------------------------------
    // New account
    // --------------------------------------------------------

    accounts.push({

        id:
            githubId,

        login:
            githubLogin

    });


    writeKnownAccounts(
        accounts
    );


    console.log(
        `👤 NEW GitHub account added: ${githubLogin}`
    );


    return {

        success: true,

        added: true,

        updated: false,

        newAccount: true,

        username:
            githubLogin,

        id:
            githubId

    };

}


// ============================================================
// GET ACCOUNT REPOSITORIES
// ============================================================
//
// Cached per discovery cycle.
// ============================================================

async function getAccountRepositories(
    username,
    stats
) {

    const key =
        String(username)
            .trim()
            .toLowerCase();


    if (
        stats.repositoryCache.has(key)
    ) {

        return (
            stats.repositoryCache.get(key)
        );

    }


    try {

        const repositories =
            await getUserRepositories(
                username
            );


        const result =
            Array.isArray(
                repositories
            )
                ? repositories
                : [];


        stats.repositoryCache.set(
            key,
            result
        );


        return result;


    } catch (error) {

        stats.repositoryErrors.set(
            key,
            error
        );

        throw error;

    }

}


// ============================================================
// CHECK ACCOUNT GITPROHUB PROJECTS
// ============================================================
//
// This function does NOT verify account again.
// It uses cached repositories.
//
// ============================================================

async function checkAccountGitProHubProjects(
    username,
    stats = null
) {

    if (
        !isValidUsername(username)
    ) {

        return {

            success: false,

            hasProject: false,

            projects: [],

            errors: [
                "Invalid GitHub username"
            ]

        };

    }


    // --------------------------------------------------------
    // Temporary stats object when called independently
    // --------------------------------------------------------

    if (!stats) {

        stats = {

            repositoryCache:
                new Map(),

            repositoryErrors:
                new Map(),

            projectFileCache:
                new Map(),

            processedProjects:
                new Set(),

            addedKeys:
                new Set(),

            updatedKeys:
                new Set(),

            removedKeys:
                new Set(),

            newAccountNames:
                new Set(),

            errors: []

        };

    }


    let repositories;


    try {

        repositories =
            await getAccountRepositories(
                username,
                stats
            );

    } catch (error) {

        console.log(
            `⚠️ Could not scan repositories for ${username}: ${error.message}`
        );


        return {

            success: false,

            hasProject: false,

            projects: [],

            errors: [
                error.message
            ]

        };

    }


    const projects = [];
    const errors = [];


    for (
        const repository
        of repositories
    ) {

        if (
            !repository?.name
        ) {
            continue;
        }


        const repoName =
            String(
                repository.name
            ).trim();


        if (!repoName) {
            continue;
        }


        const cacheKey =
            `${username.toLowerCase()}/${repoName.toLowerCase()}`;


        let content;


        try {

            if (
                stats.projectFileCache.has(
                    cacheKey
                )
            ) {

                content =
                    stats.projectFileCache.get(
                        cacheKey
                    );

            } else {

                content =
                    await getGitProHubFile(
                        username,
                        repoName
                    );


                stats.projectFileCache.set(
                    cacheKey,
                    content
                );

            }


            if (!content) {
                continue;
            }


            projects.push({

                username,

                repo:
                    repoName

            });


            console.log(
                `📄 gitprohub.md found: ${username}/${repoName}`
            );


        } catch (error) {

            errors.push(
                `${username}/${repoName}: ${error.message}`
            );


            console.log(
                `⚠️ Could not check ${username}/${repoName}: ${error.message}`
            );

        }

    }


    return {

        success: true,

        hasProject:
            projects.length > 0,

        projects,

        errors

    };

}


// ============================================================
// REGISTER KNOWN ACCOUNT
// ============================================================
//
// IMPORTANT:
// This function is now lightweight.
//
// It verifies the account ONCE,
// but does NOT scan all repositories again.
//
// Use options.verifiedUser when the account was already
// verified in the current discovery cycle.
//
// ============================================================

async function registerKnownAccount(
    username,
    options = {}
) {

    if (
        !isValidUsername(username)
    ) {

        console.log(
            `⏭️ Invalid account skipped: ${username}`
        );

        return {

            success: false,

            added: false,

            updated: false,

            newAccount: false,

            username: null,

            reason:
                "invalid_username"

        };

    }


    const cleanUsername =
        String(username).trim();


    let user =
        options.verifiedUser ||
        null;


    // --------------------------------------------------------
    // Verify only when user is not already verified
    // --------------------------------------------------------

    if (!user) {

        const verification =
            await verifyGitHubAccount(
                cleanUsername
            );


        if (
            !verification.success
        ) {

            console.log(
                `⏭️ Account NOT added: ${cleanUsername}`
            );


            return {

                success: false,

                added: false,

                updated: false,

                newAccount: false,

                username:
                    cleanUsername,

                reason:
                    "github_account_not_verified",

                error:
                    verification.error,

                status:
                    verification.status

            };

        }


        user =
            verification.user;

    }


    // --------------------------------------------------------
    // Save verified account
    // --------------------------------------------------------

    const result =
        saveVerifiedAccount(
            user
        );


    return {

        success:
            result.success,

        added:
            result.added,

        updated:
            result.updated,

        removed: false,

        newAccount:
            result.newAccount,

        username:
            result.username,

        id:
            result.id,

        reason:
            result.newAccount
                ? "new_account"
                : result.updated
                    ? "account_updated"
                    : "account_already_known"

    };

}


// ============================================================
// SAVE DISCOVERED PROJECT
// ============================================================
//
// Uses processedProjects Set to prevent duplicate processing.
// ============================================================

async function saveDiscoveredProject(
    username,
    repo,
    stats
) {

    if (
        !isValidUsername(username)
    ) {

        console.log(
            `⏭️ Invalid project owner skipped: ${username}`
        );

        return {

            success: false,

            added: false,

            updated: false,

            skipped: true

        };

    }


    if (
        typeof repo !== "string" ||
        !repo.trim() ||
        repo.includes("/")
    ) {

        console.log(
            `⏭️ Invalid repository skipped: ${username}/${repo}`
        );

        return {

            success: false,

            added: false,

            updated: false,

            skipped: true

        };

    }


    repo =
        repo.trim();


    const key =
        getProjectKey(
            username,
            repo
        );


    // --------------------------------------------------------
    // Duplicate protection
    // --------------------------------------------------------

    if (
        stats.processedProjects.has(
            key
        )
    ) {

        return {

            success: true,

            added: false,

            updated: false,

            skipped: true,

            duplicate: true

        };

    }


    stats.processedProjects.add(
        key
    );


    // --------------------------------------------------------
    // Check cached gitprohub.md first
    // --------------------------------------------------------

    const fileCacheKey =
        `${username.toLowerCase()}/${repo.toLowerCase()}`;


    try {

        let content;


        if (
            stats.projectFileCache.has(
                fileCacheKey
            )
        ) {

            content =
                stats.projectFileCache.get(
                    fileCacheKey
                );

        } else {

            content =
                await getGitProHubFile(
                    username,
                    repo
                );


            stats.projectFileCache.set(
                fileCacheKey,
                content
            );

        }


        // ----------------------------------------------------
        // Missing file
        // ----------------------------------------------------

        if (!content) {

            console.log(
                `⏭️ Not a GitProHub project: ${username}/${repo}`
            );

            return {

                success: true,

                added: false,

                updated: false,

                skipped: true

            };

        }


    } catch (error) {

        console.log(
            `🛡️ Project kept safe: ${username}/${repo} → ${error.message}`
        );


        stats.errors.push({

            username,

            repo,

            message:
                error.message

        });


        return {

            success: false,

            added: false,

            updated: false,

            skipped: false

        };

    }


    // --------------------------------------------------------
    // Get full project data
    // --------------------------------------------------------

    let project;


    try {

        project =
            await getProject(
                username,
                repo
            );


    } catch (error) {

        console.log(
            `⚠️ Project data fetch failed: ${username}/${repo} → ${error.message}`
        );


        stats.errors.push({

            username,

            repo,

            message:
                error.message

        });


        return {

            success: false,

            added: false,

            updated: false,

            skipped: false

        };

    }


    if (!project) {

        console.log(
            `⏭️ GitProHub project data unavailable: ${username}/${repo}`
        );

        return {

            success: true,

            added: false,

            updated: false,

            skipped: true

        };

    }


    // --------------------------------------------------------
    // Save project
    // --------------------------------------------------------

    try {

        const result =
            await saveProject(
                project
            );


        const added =
            Boolean(
                result?.added
            );


        const updated =
            Boolean(
                result?.updated
            );


        if (added) {

            stats.addedKeys.add(
                key
            );


            console.log(
                `🆕 NEW GitProHub project added: ${username}/${repo}`
            );

        }


        if (updated) {

            stats.updatedKeys.add(
                key
            );


            console.log(
                `🔄 GitProHub project updated: ${username}/${repo}`
            );

        }


        return {

            success: true,

            added,

            updated,

            skipped: false,

            project

        };


    } catch (error) {

        console.log(
            `❌ Could not save project ${username}/${repo}: ${error.message}`
        );


        stats.errors.push({

            username,

            repo,

            message:
                error.message

        });


        return {

            success: false,

            added: false,

            updated: false,

            skipped: false

        };

    }

}


// ============================================================
// SCAN ONE GITHUB ACCOUNT
// ============================================================
//
// IMPORTANT:
// Account verification happens outside this function.
// This function only scans repositories once.
//
// ============================================================

async function scanGitHubAccount(
    username,
    stats,
    options = {}
) {

    if (
        !isValidUsername(username)
    ) {

        console.log(
            `⏭️ Invalid account skipped: ${username}`
        );

        return {

            success: false,

            added: 0,

            updated: 0,

            projects: []

        };

    }


    const cleanUsername =
        String(username).trim();


    console.log("");

    console.log(
        `👤 Scanning GitHub account: ${cleanUsername}`
    );


    let repositories;


    try {

        repositories =
            await getAccountRepositories(
                cleanUsername,
                stats
            );


    } catch (error) {

        console.log(
            `⚠️ Could not scan account ${cleanUsername}: ${error.message}`
        );


        stats.errors.push({

            username:
                cleanUsername,

            message:
                error.message

        });


        return {

            success: false,

            added: 0,

            updated: 0,

            projects: []

        };

    }


    let added = 0;
    let updated = 0;

    const projects = [];


    for (
        const repository
        of repositories
    ) {

        if (
            !repository?.name
        ) {
            continue;
        }


        const repoName =
            String(
                repository.name
            ).trim();


        if (!repoName) {
            continue;
        }


        const result =
            await saveDiscoveredProject(
                cleanUsername,
                repoName,
                stats
            );


        if (result.added) {
            added++;
        }


        if (result.updated) {
            updated++;
        }


        if (result.project) {

            projects.push(
                result.project
            );

        }

    }


    console.log(
        `📦 ${cleanUsername}: ${repositories.length} repositories scanned`
    );


    console.log(
        `🆕 ${cleanUsername}: ${added} new project(s)`
    );


    console.log(
        `🔄 ${cleanUsername}: ${updated} updated project(s)`
    );


    return {

        success: true,

        added,

        updated,

        projects

    };

}


// ============================================================
// CHECK EXISTING PROJECTS
// ============================================================
//
// VERY IMPORTANT:
//
// 404 / missing gitprohub.md
//     → remove project
//
// 403 / rate limit / network error
//     → KEEP project
//
// ============================================================

async function checkExistingProjects(
    stats
) {

    let projects;


    try {

        projects =
            getProjects();


    } catch (error) {

        console.log(
            `❌ Could not load existing projects: ${error.message}`
        );


        stats.errors.push({

            message:
                error.message

        });


        return {

            checked: 0,

            removed: 0,

            updated: 0

        };

    }


    if (
        !Array.isArray(projects)
    ) {

        return {

            checked: 0,

            removed: 0,

            updated: 0

        };

    }


    let checked = 0;
    let removed = 0;
    let updated = 0;


    for (
        const storedProject
        of projects
    ) {

        const username =
            storedProject?.developer?.username ||
            storedProject?.github?.owner?.login ||
            storedProject?.owner ||
            null;


        const repo =
            storedProject?.github?.name ||
            storedProject?.repo ||
            null;


        if (
            !isValidUsername(username)
        ) {

            console.log(
                "⏭️ Invalid stored project owner skipped."
            );

            continue;

        }


        if (
            typeof repo !== "string" ||
            !repo.trim() ||
            repo.includes("/")
        ) {

            console.log(
                `⏭️ Invalid stored repository skipped: ${username}/${repo}`
            );

            continue;

        }


        const cleanUsername =
            String(
                username
            ).trim();


        const cleanRepo =
            repo.trim();


        const key =
            getProjectKey(
                cleanUsername,
                cleanRepo
            );


        const cacheKey =
            `${cleanUsername.toLowerCase()}/${cleanRepo.toLowerCase()}`;


        try {

            let content;


            // ------------------------------------------------
            // Use cache when available
            // ------------------------------------------------

            if (
                stats.projectFileCache.has(
                    cacheKey
                )
            ) {

                content =
                    stats.projectFileCache.get(
                        cacheKey
                    );

            } else {

                content =
                    await getGitProHubFile(
                        cleanUsername,
                        cleanRepo
                    );


                stats.projectFileCache.set(
                    cacheKey,
                    content
                );

            }


            checked++;


            // ------------------------------------------------
            // Confirmed missing gitprohub.md
            // ------------------------------------------------

            if (!content) {

                console.log(
                    `🗑️ GitProHub project removed: ${cleanUsername}/${cleanRepo}`
                );


                try {

                    await removeProject(
                        cleanUsername,
                        cleanRepo
                    );


                    removed++;


                    stats.removedKeys.add(
                        key
                    );


                } catch (removeError) {

                    console.log(
                        `⚠️ Could not remove ${cleanUsername}/${cleanRepo}: ${removeError.message}`
                    );


                    stats.errors.push({

                        username:
                            cleanUsername,

                        repo:
                            cleanRepo,

                        message:
                            removeError.message

                    });

                }


                continue;

            }


            // ------------------------------------------------
            // gitprohub.md still exists
            // ------------------------------------------------

            const currentProject =
                await getProject(
                    cleanUsername,
                    cleanRepo
                );


            if (!currentProject) {

                console.log(
                    `⚠️ Project data unavailable: ${cleanUsername}/${cleanRepo}`
                );

                continue;

            }


            const saveResult =
                await saveProject(
                    currentProject
                );


            if (
                saveResult?.updated
            ) {

                updated++;


                stats.updatedKeys.add(
                    key
                );

            }


        } catch (error) {

            // ------------------------------------------------
            // SAFE MODE
            // ------------------------------------------------

            console.log(
                `🛡️ SAFE MODE: keeping ${cleanUsername}/${cleanRepo}`
            );


            console.log(
                `   ⚠️ ${error.message}`
            );


            stats.errors.push({

                username:
                    cleanUsername,

                repo:
                    cleanRepo,

                message:
                    error.message

            });

        }

    }


    return {

        checked,

        removed,

        updated

    };

}


// ============================================================
// DISCOVER NEW PROJECTS FROM GLOBAL GITHUB SEARCH
// ============================================================
//
// IMPORTANT:
//
// Global search result already tells us:
// username + repository
//
// Therefore:
// DO NOT scan the entire account here.
//
// ============================================================

async function discoverNewGitProHubProjects(
    stats
) {

    console.log("");

    console.log(
        "🌐 Starting global GitHub GitProHub discovery..."
    );


    let repositories;


    try {

        repositories =
            await crawlGitHubGitProHubFiles();


    } catch (error) {

        console.log(
            `❌ Global discovery failed: ${error.message}`
        );


        stats.errors.push({

            message:
                error.message

        });


        return {

            success: false,

            added: 0,

            updated: 0,

            newAccounts: []

        };

    }


    if (
        !Array.isArray(repositories)
    ) {

        return {

            success: true,

            added: 0,

            updated: 0,

            newAccounts: []

        };

    }


    const newAccounts =
        new Map();


    const processedGlobalAccounts =
        new Set();


    for (
        const item
        of repositories
    ) {

        const username =
            item?.username ||
            item?.owner ||
            null;


        const repo =
            item?.repo ||
            item?.repository ||
            null;


        if (
            !isValidUsername(username)
        ) {

            console.log(
                `⏭️ Invalid global search username skipped: ${username}`
            );

            continue;

        }


        if (
            typeof repo !== "string" ||
            !repo.trim() ||
            repo.includes("/")
        ) {

            console.log(
                `⏭️ Invalid global search repository skipped: ${username}/${repo}`
            );

            continue;

        }


        // ----------------------------------------------------
        // Verify account only once
        // ----------------------------------------------------

        const accountKey =
            String(
                username
            ).trim().toLowerCase();


        let verifiedUser =
            stats.accountCache.get(
                accountKey
            );


        if (
            !verifiedUser &&
            !stats.accountVerificationErrors.has(
                accountKey
            )
        ) {

            const verification =
                await verifyGitHubAccount(
                    username
                );


            if (
                !verification.success
            ) {

                stats.accountVerificationErrors.set(
                    accountKey,
                    verification
                );


                console.log(
                    `🛡️ Global account skipped safely: ${username}`
                );

                continue;

            }


            verifiedUser =
                verification.user;


            stats.accountCache.set(
                accountKey,
                verifiedUser
            );

        }


        if (!verifiedUser) {
            continue;
        }


        // ----------------------------------------------------
        // Save account using already verified user
        // ----------------------------------------------------

        const accountResult =
            saveVerifiedAccount(
                verifiedUser
            );


        if (
            accountResult.newAccount
        ) {

            const login =
                accountResult.username;


            if (
                login &&
                !newAccounts.has(
                    login.toLowerCase()
                )
            ) {

                newAccounts.set(
                    login.toLowerCase(),
                    login
                );

            }

        }


        // ----------------------------------------------------
        // Save only this discovered project
        // ----------------------------------------------------

        await saveDiscoveredProject(
            verifiedUser.login,
            repo,
            stats
        );


        processedGlobalAccounts.add(
            accountKey
        );

    }


    return {

        success: true,

        added: 0,

        updated: 0,

        newAccounts:
            Array.from(
                newAccounts.values()
            )

    };

}


// ============================================================
// DISCOVER PROJECTS FROM KNOWN ACCOUNTS
// ============================================================
//
// Flow:
//
// account
//   ↓
// verify ONCE
//   ↓
// update GitHub ID/login
//   ↓
// get repositories ONCE
//   ↓
// check gitprohub.md
//   ↓
// save projects
//
// ============================================================

async function discoverKnownGitHubAccounts(
    stats
) {

    const accounts =
        getKnownGitHubAccounts();


    console.log("");

    console.log(
        `👥 Known GitHub accounts to scan: ${accounts.length}`
    );


    let added = 0;
    let updated = 0;


    // --------------------------------------------------------
    // Account deduplication
    // --------------------------------------------------------

    const processedAccounts =
        new Set();


    for (
        const account
        of accounts
    ) {

        const normalized =
            normalizeAccount(
                account
            );


        if (!normalized) {
            continue;
        }


        const accountKey =
            normalized.id
                ? `id:${normalized.id}`
                : `login:${normalized.login.toLowerCase()}`;


        if (
            processedAccounts.has(
                accountKey
            )
        ) {

            continue;

        }


        processedAccounts.add(
            accountKey
        );


        // ----------------------------------------------------
        // Verify account ONCE
        // ----------------------------------------------------

        const loginKey =
            normalized.login.toLowerCase();


        let verifiedUser =
            stats.accountCache.get(
                loginKey
            );


        if (
            !verifiedUser &&
            !stats.accountVerificationErrors.has(
                loginKey
            )
        ) {

            const verification =
                await verifyGitHubAccount(
                    normalized.login
                );


            if (
                !verification.success
            ) {

                console.log(
                    `🛡️ Keeping known account safely: ${normalized.login}`
                );


                stats.accountVerificationErrors.set(
                    loginKey,
                    verification
                );


                stats.errors.push({

                    username:
                        normalized.login,

                    message:
                        verification.error ||
                        "GitHub account verification failed"

                });


                continue;

            }


            verifiedUser =
                verification.user;


            stats.accountCache.set(
                loginKey,
                verifiedUser
            );

        }


        if (!verifiedUser) {
            continue;
        }


        const actualUsername =
            String(
                verifiedUser.login
            ).trim();


        // ----------------------------------------------------
        // Update account ID/login WITHOUT API call
        // ----------------------------------------------------

        saveVerifiedAccount(
            verifiedUser
        );


        // ----------------------------------------------------
        // Scan account ONCE
        // ----------------------------------------------------

        const result =
            await scanGitHubAccount(
                actualUsername,
                stats
            );


        added +=
            Number(
                result.added
            ) || 0;


        updated +=
            Number(
                result.updated
            ) || 0;

    }


    return {

        success:
            true,

        added,

        updated

    };

}


// ============================================================
// CLEAN / MIGRATE KNOWN ACCOUNTS
// ============================================================
//
// IMPORTANT:
//
// This function does NOT call GitHub API.
//
// It only:
// - removes malformed entries
// - converts strings to objects
// - removes duplicates
//
// GitHub ID/login verification happens later,
// exactly once per account.
// ============================================================

async function migrateKnownAccounts(
    stats
) {

    const oldAccounts =
        readKnownAccounts();


    if (
        !Array.isArray(oldAccounts)
    ) {

        return {

            migrated: 0,

            updated: 0

        };

    }


    const normalized = [];

    const seenIds =
        new Set();

    const seenLogins =
        new Set();


    for (
        const account
        of oldAccounts
    ) {

        const item =
            normalizeAccount(
                account
            );


        if (!item) {

            console.log(
                "🧹 Removing malformed known account entry."
            );

            continue;

        }


        if (item.id) {

            const id =
                String(
                    item.id
                );


            if (
                seenIds.has(id)
            ) {
                continue;
            }


            seenIds.add(id);

        }


        const login =
            item.login.toLowerCase();


        if (
            seenLogins.has(login)
        ) {
            continue;
        }


        seenLogins.add(
            login
        );


        normalized.push(
            item
        );

    }


    const before =
        JSON.stringify(
            oldAccounts
        );


    const after =
        JSON.stringify(
            normalized
        );


    if (
        before !== after
    ) {

        writeKnownAccounts(
            normalized
        );


        console.log(
            `🧹 knownAccounts.json cleaned: ${oldAccounts.length} → ${normalized.length}`
        );


        return {

            migrated: 1,

            updated: 1

        };

    }


    return {

        migrated: 0,

        updated: 0

    };

}


// ============================================================
// MAIN DISCOVERY
// ============================================================

async function discoverAllGitProHubProjects() {

    console.log("");

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
        "🚀 GitProHub discovery started"
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );


    // --------------------------------------------------------
    // Per-run statistics
    // --------------------------------------------------------

    const stats = {

        processedProjects:
            new Set(),

        addedKeys:
            new Set(),

        updatedKeys:
            new Set(),

        removedKeys:
            new Set(),

        newAccountNames:
            new Set(),

        errors: [],


        // ----------------------------------------------------
        // API caches
        // ----------------------------------------------------

        accountCache:
            new Map(),

        accountVerificationErrors:
            new Map(),

        repositoryCache:
            new Map(),

        repositoryErrors:
            new Map(),

        projectFileCache:
            new Map()

    };


    // ========================================================
    // STEP 1
    // ========================================================

    console.log("");

    console.log(
        "1️⃣ Cleaning known GitHub accounts..."
    );


    await migrateKnownAccounts(
        stats
    );


    // ========================================================
    // STEP 2
    // ========================================================

    console.log("");

    console.log(
        "2️⃣ Checking existing GitProHub projects..."
    );


    const existing =
        await checkExistingProjects(
            stats
        );


    // ========================================================
    // STEP 3
    // ========================================================

    console.log("");

    console.log(
        "3️⃣ Running global GitHub discovery..."
    );


    const global =
        await discoverNewGitProHubProjects(
            stats
        );


    for (
        const username
        of global.newAccounts || []
    ) {

        stats.newAccountNames.add(
            username
        );

    }


    // ========================================================
    // STEP 4
    // ========================================================

    console.log("");

    console.log(
        "4️⃣ Scanning known GitHub accounts..."
    );


    const known =
        await discoverKnownGitHubAccounts(
            stats
        );


    // ========================================================
    // FINAL PROJECT LIST
    // ========================================================

    let finalProjects = [];


    try {

        finalProjects =
            getProjects();


    } catch (error) {

        console.log(
            `❌ Could not load final project list: ${error.message}`
        );


        stats.errors.push({

            message:
                error.message

        });

    }


    if (
        !Array.isArray(finalProjects)
    ) {

        finalProjects = [];

    }


    // ========================================================
    // FINAL ACCOUNT LIST
    // ========================================================

    const finalAccounts =
        getNormalizedKnownAccounts();


    // ========================================================
    // FINAL COUNTS
    // ========================================================

    const added =
        stats.addedKeys.size;


    const updated =
        stats.updatedKeys.size;


    const removed =
        stats.removedKeys.size;


    const newAccounts =
        Array.from(
            stats.newAccountNames
        );


    // ========================================================
    // RESULT
    // ========================================================

    const result = {

        success:
            stats.errors.length === 0,

        total:
            finalProjects.length,

        added,

        updated,

        removed,

        newAccounts,

        accounts:
            finalAccounts,

        projects:
            finalProjects,

        errors:
            stats.errors,

        checkedExisting:
            existing.checked,

        existingRemoved:
            existing.removed,

        existingUpdated:
            existing.updated,

        knownAccountsScanned:
            finalAccounts.length,

        globalSearchSuccess:
            global.success,

        knownAccountsSuccess:
            known.success,

        completedAt:
            new Date().toISOString()

    };


    // ========================================================
    // LOG
    // ========================================================

    console.log("");

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
        "✅ GitProHub discovery completed"
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
        `📦 Total projects : ${result.total}`
    );

    console.log(
        `🆕 New projects   : ${result.added}`
    );

    console.log(
        `🔄 Updated        : ${result.updated}`
    );

    console.log(
        `🗑️ Removed         : ${result.removed}`
    );

    console.log(
        `👤 New accounts   : ${result.newAccounts.length}`
    );

    console.log(
        `👥 Known accounts : ${result.knownAccountsScanned}`
    );

    console.log(
        `⚠️ Errors          : ${result.errors.length}`
    );


    if (
        result.newAccounts.length > 0
    ) {

        console.log("");

        console.log(
            "👤 New GitHub accounts:"
        );


        for (
            const username
            of result.newAccounts
        ) {

            console.log(
                `   ➕ ${username}`
            );

        }

    }


    if (
        result.errors.length > 0
    ) {

        console.log("");

        console.log(
            "⚠️ Discovery errors:"
        );


        for (
            const error
            of result.errors
        ) {

            if (
                typeof error === "string"
            ) {

                console.log(
                    `   • ${error}`
                );

                continue;

            }


            const owner =
                error?.username
                    ? `${error.username}${error.repo ? `/${error.repo}` : ""}: `
                    : "";


            console.log(
                `   • ${owner}${error?.message || JSON.stringify(error)}`
            );

        }

    }


    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log("");


    return result;

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    discoverAllGitProHubProjects,

    discoverNewGitProHubProjects,

    discoverKnownGitHubAccounts,

    scanGitHubAccount,

    saveDiscoveredProject,

    checkExistingProjects,

    registerKnownAccount,

    verifyGitHubAccount,

    checkAccountGitProHubProjects,

    getKnownGitHubAccounts,

    readKnownAccounts,

    writeKnownAccounts,

    normalizeAccount

};
