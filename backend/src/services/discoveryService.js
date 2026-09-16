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

const DATA_DIR = path.join(process.cwd(), "data");

const KNOWN_ACCOUNTS_FILE = path.join(
    DATA_DIR,
    "knownAccounts.json"
);

// Sirf confirmed 404 pe remove (empty content pe nahi)
const AUTO_REMOVE_ENABLED = true;

function ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, {
            recursive: true
        });
    }
}

function createDiscoveryStats() {
    return {
        processedProjects: new Set(),
        addedKeys: new Set(),
        updatedKeys: new Set(),
        removedKeys: new Set(),

        newAccountNames: new Set(),

        newProjects: [],
        updatedProjects: [],
        removedProjects: [],

        errors: [],

        accountCache: new Map(),
        accountVerificationErrors: new Map(),

        repositoryCache: new Map(),
        repositoryErrors: new Map(),

        projectFileCache: new Map(),
        projectDataCache: new Map()
    };
}

function addError(stats, error) {
    if (!stats || !error) {
        return;
    }

    if (typeof error === "string") {
        stats.errors.push({
            message: error
        });
        return;
    }

    stats.errors.push({
        username: error.username || null,
        repo: error.repo || null,
        message: error.message || String(error)
    });
}

function readKnownAccounts() {
    ensureDataDirectory();

    if (!fs.existsSync(KNOWN_ACCOUNTS_FILE)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(
            KNOWN_ACCOUNTS_FILE,
            "utf8"
        );

        if (!raw.trim()) {
            return [];
        }

        const data = JSON.parse(raw);

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

function normalizeAccount(account) {
    if (!account) {
        return null;
    }

    if (typeof account === "string") {
        const login = account.trim();

        if (!isValidUsername(login)) {
            return null;
        }

        return {
            id: null,
            login
        };
    }

    if (typeof account === "object") {
        const login = account.login
            ? String(account.login).trim()
            : "";

        if (!isValidUsername(login)) {
            return null;
        }

        return {
            id: account.id ?? null,
            login
        };
    }

    return null;
}

function deduplicateAccounts(accounts) {
    const result = [];
    const byId = new Map();
    const byLogin = new Map();

    for (const rawAccount of accounts) {
        const account = normalizeAccount(rawAccount);

        if (!account) {
            continue;
        }

        const loginKey = account.login.toLowerCase();

        if (account.id !== null && account.id !== undefined) {
            const idKey = String(account.id);

            if (!byId.has(idKey)) {
                byId.set(idKey, {
                    id: account.id,
                    login: account.login
                });
            }
            continue;
        }

        if (!byLogin.has(loginKey)) {
            byLogin.set(loginKey, {
                id: null,
                login: account.login
            });
        }
    }

    for (const account of byId.values()) {
        result.push(account);
    }

    const idsByLogin = new Set(
        result.map(account => account.login.toLowerCase())
    );

    for (const account of byLogin.values()) {
        const loginKey = account.login.toLowerCase();

        if (!idsByLogin.has(loginKey)) {
            result.push(account);
        }
    }

    return result;
}

function writeKnownAccounts(accounts) {
    ensureDataDirectory();

    const cleanAccounts = deduplicateAccounts(
        Array.isArray(accounts) ? accounts : []
    );

    fs.writeFileSync(
        KNOWN_ACCOUNTS_FILE,
        JSON.stringify(cleanAccounts, null, 2),
        "utf8"
    );

    return cleanAccounts;
}

function findAccountById(accounts, id) {
    if (id === null || id === undefined || id === "") {
        return null;
    }

    const targetId = String(id);

    return (
        accounts.find(account => {
            const normalized = normalizeAccount(account);

            if (!normalized || !normalized.id) {
                return false;
            }

            return String(normalized.id) === targetId;
        }) || null
    );
}

function findAccountByLogin(accounts, login) {
    if (!login) {
        return null;
    }

    const cleanLogin = String(login).trim().toLowerCase();

    return (
        accounts.find(account => {
            const normalized = normalizeAccount(account);

            if (!normalized) {
                return false;
            }

            return normalized.login.toLowerCase() === cleanLogin;
        }) || null
    );
}

function getNormalizedKnownAccounts() {
    return deduplicateAccounts(readKnownAccounts());
}

function getKnownGitHubAccounts() {
    const accounts = getNormalizedKnownAccounts();

    const mapById = new Map();
    const mapByLogin = new Map();

    for (const account of accounts) {
        if (account.id !== null && account.id !== undefined) {
            mapById.set(String(account.id), account);
        } else {
            mapByLogin.set(account.login.toLowerCase(), account);
        }
    }

    let projects = [];

    try {
        projects = getProjects();
    } catch (error) {
        console.log(
            "⚠️ Could not read existing projects:",
            error.message
        );
    }

    if (Array.isArray(projects)) {
        for (const project of projects) {
            const username =
                project?.developer?.username ||
                project?.github?.owner?.login ||
                project?.owner ||
                null;

            if (!username) {
                continue;
            }

            const login = String(username).trim();

            if (!isValidUsername(login)) {
                continue;
            }

            const key = login.toLowerCase();

            if (
                !mapByLogin.has(key) &&
                !Array.from(mapById.values()).some(
                    account => account.login.toLowerCase() === key
                )
            ) {
                mapByLogin.set(key, {
                    id: null,
                    login
                });
            }
        }
    }

    return [
        ...Array.from(mapById.values()),
        ...Array.from(mapByLogin.values())
    ];
}

async function verifyGitHubAccount(username) {
    if (!isValidUsername(username)) {
        console.log(
            `⏭️ Invalid GitHub username skipped: ${username}`
        );

        return {
            success: false,
            exists: false,
            error: "Invalid GitHub username"
        };
    }

    const cleanUsername = String(username).trim();

    try {
        console.log(
            `🔍 Verifying GitHub account: ${cleanUsername}`
        );

        const user = await getUser(cleanUsername);

        if (!user || !user.id || !user.login) {
            return {
                success: false,
                exists: false,
                error: "GitHub account not found"
            };
        }

        const verifiedLogin = String(user.login).trim();

        console.log(
            `✅ GitHub account verified: ${verifiedLogin} (ID: ${user.id})`
        );

        return {
            success: true,
            exists: true,
            user,
            id: user.id,
            login: verifiedLogin
        };
    } catch (error) {
        console.log(
            `⚠️ GitHub account verification failed: ${cleanUsername} → ${error.message}`
        );

        return {
            success: false,
            exists: false,
            error: error.message,
            status: error.status || null
        };
    }
}

function saveVerifiedAccount(user) {
    if (!user || !user.id || !user.login) {
        return {
            success: false,
            added: false,
            updated: false,
            newAccount: false
        };
    }

    const githubId = user.id;
    const githubLogin = String(user.login).trim();

    if (!isValidUsername(githubLogin)) {
        return {
            success: false,
            added: false,
            updated: false,
            newAccount: false
        };
    }

    const accounts = getNormalizedKnownAccounts();
    const accountById = findAccountById(accounts, githubId);

    if (accountById) {
        let changed = false;
        const oldLogin = accountById.login;

        if (oldLogin.toLowerCase() !== githubLogin.toLowerCase()) {
            console.log(
                `🔄 GitHub username changed: ${oldLogin} → ${githubLogin}`
            );
            accountById.login = githubLogin;
            changed = true;
        }

        if (String(accountById.id) !== String(githubId)) {
            accountById.id = githubId;
            changed = true;
        }

        if (changed) {
            writeKnownAccounts(accounts);
            console.log(
                `✅ Account record updated: ${githubLogin}`
            );
        }

        return {
            success: true,
            added: false,
            updated: changed,
            newAccount: false,
            username: githubLogin,
            id: githubId
        };
    }

    const accountByLogin = findAccountByLogin(accounts, githubLogin);

    if (accountByLogin) {
        accountByLogin.id = githubId;
        accountByLogin.login = githubLogin;

        writeKnownAccounts(accounts);

        console.log(
            `🔗 GitHub ID attached to existing account: ${githubLogin}`
        );

        return {
            success: true,
            added: false,
            updated: true,
            newAccount: false,
            username: githubLogin,
            id: githubId
        };
    }

    accounts.push({
        id: githubId,
        login: githubLogin
    });

    writeKnownAccounts(accounts);

    console.log(
        `👤 NEW GitHub account added: ${githubLogin}`
    );

    return {
        success: true,
        added: true,
        updated: false,
        newAccount: true,
        username: githubLogin,
        id: githubId
    };
}

async function getAccountRepositories(username, stats) {
    const key = String(username).trim().toLowerCase();

    if (stats.repositoryCache.has(key)) {
        return stats.repositoryCache.get(key);
    }

    if (stats.repositoryErrors.has(key)) {
        throw stats.repositoryErrors.get(key);
    }

    try {
        const repositories = await getUserRepositories(username);
        const result = Array.isArray(repositories) ? repositories : [];

        stats.repositoryCache.set(key, result);
        return result;
    } catch (error) {
        stats.repositoryErrors.set(key, error);
        throw error;
    }
}

async function getCachedGitProHubFile(username, repo, stats) {
    const cacheKey =
        `${String(username).trim().toLowerCase()}/${String(repo).trim().toLowerCase()}`;

    if (stats.projectFileCache.has(cacheKey)) {
        return stats.projectFileCache.get(cacheKey);
    }

    try {
        const content = await getGitProHubFile(username, repo);
        stats.projectFileCache.set(cacheKey, content);
        return content;
    } catch (error) {
        throw error;
    }
}

async function getCachedProject(username, repo, stats) {
    const cacheKey =
        `${String(username).trim().toLowerCase()}/${String(repo).trim().toLowerCase()}`;

    if (stats.projectDataCache.has(cacheKey)) {
        return stats.projectDataCache.get(cacheKey);
    }

    const project = await getProject(username, repo);
    stats.projectDataCache.set(cacheKey, project);
    return project;
}

async function checkAccountGitProHubProjects(username, stats = null) {
    if (!isValidUsername(username)) {
        return {
            success: false,
            hasProject: false,
            projects: [],
            errors: ["Invalid GitHub username"]
        };
    }

    if (!stats) {
        stats = createDiscoveryStats();
    }

    let repositories;

    try {
        repositories = await getAccountRepositories(username, stats);
    } catch (error) {
        console.log(
            `⚠️ Could not scan repositories for ${username}: ${error.message}`
        );

        return {
            success: false,
            hasProject: false,
            projects: [],
            errors: [error.message]
        };
    }

    const projects = [];
    const errors = [];

    for (const repository of repositories) {
        if (!repository?.name) {
            continue;
        }

        const repoName = String(repository.name).trim();

        if (!repoName) {
            continue;
        }

        try {
            const content = await getCachedGitProHubFile(
                username,
                repoName,
                stats
            );

            if (!content) {
                continue;
            }

            projects.push({
                username,
                repo: repoName
            });

            console.log(
                `📄 gitprohub.md found: ${username}/${repoName}`
            );
        } catch (error) {
            const message = `${username}/${repoName}: ${error.message}`;
            errors.push(message);

            console.log(
                `⚠️ Could not check ${username}/${repoName}: ${error.message}`
            );
        }
    }

    return {
        success: true,
        hasProject: projects.length > 0,
        projects,
        errors
    };
}

async function registerKnownAccount(username, options = {}) {
    if (!isValidUsername(username)) {
        console.log(
            `⏭️ Invalid account skipped: ${username}`
        );

        return {
            success: false,
            added: false,
            updated: false,
            removed: false,
            newAccount: false,
            username: null,
            reason: "invalid_username"
        };
    }

    const cleanUsername = String(username).trim();
    let user = options.verifiedUser || null;

    if (!user) {
        const verification = await verifyGitHubAccount(cleanUsername);

        if (!verification.success) {
            console.log(
                `⏭️ Account NOT added: ${cleanUsername}`
            );

            return {
                success: false,
                added: false,
                updated: false,
                removed: false,
                newAccount: false,
                username: cleanUsername,
                reason: "github_account_not_verified",
                error: verification.error,
                status: verification.status || null
            };
        }

        user = verification.user;
    }

    const result = saveVerifiedAccount(user);

    return {
        success: result.success,
        added: result.added,
        updated: result.updated,
        removed: false,
        newAccount: result.newAccount,
        username: result.username,
        id: result.id,
        reason: result.newAccount
            ? "new_account"
            : result.updated
                ? "account_updated"
                : "account_already_known"
    };
}

async function saveDiscoveredProject(username, repo, stats) {
    if (!isValidUsername(username)) {
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

    const cleanUsername = String(username).trim();
    const cleanRepo = repo.trim();
    const key = getProjectKey(cleanUsername, cleanRepo);

    if (stats.processedProjects.has(key)) {
        return {
            success: true,
            added: false,
            updated: false,
            skipped: true,
            duplicate: true
        };
    }

    stats.processedProjects.add(key);

    try {
        const content = await getCachedGitProHubFile(
            cleanUsername,
            cleanRepo,
            stats
        );

        if (!content) {
            console.log(
                `⏭️ Not a GitProHub project: ${cleanUsername}/${cleanRepo}`
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
            `🛡️ Project kept safe: ${cleanUsername}/${cleanRepo} → ${error.message}`
        );

        addError(stats, {
            username: cleanUsername,
            repo: cleanRepo,
            message: error.message
        });

        return {
            success: false,
            added: false,
            updated: false,
            skipped: false
        };
    }

    let project;

    try {
        project = await getCachedProject(
            cleanUsername,
            cleanRepo,
            stats
        );
    } catch (error) {
        console.log(
            `⚠️ Project data fetch failed: ${cleanUsername}/${cleanRepo} → ${error.message}`
        );

        addError(stats, {
            username: cleanUsername,
            repo: cleanRepo,
            message: error.message
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
            `⏭️ GitProHub project data unavailable: ${cleanUsername}/${cleanRepo}`
        );

        return {
            success: true,
            added: false,
            updated: false,
            skipped: true
        };
    }

    try {
        const result = await saveProject(project);

        const added = Boolean(result?.added);
        const updated = Boolean(result?.updated);

        if (added) {
            stats.addedKeys.add(key);
            stats.newProjects.push(project);

            console.log(
                `🆕 NEW GitProHub project added: ${cleanUsername}/${cleanRepo}`
            );
        }

        if (updated) {
            stats.updatedKeys.add(key);
            stats.updatedProjects.push(project);

            console.log(
                `🔄 GitProHub project updated: ${cleanUsername}/${cleanRepo}`
            );
        }

        // ✅ Project save hone par account known list me add
        if (added || updated) {
            try {
                await registerKnownAccount(cleanUsername);
            } catch (err) {
                console.log(
                    `⚠️ Could not register account ${cleanUsername}: ${err.message}`
                );
            }
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
            `❌ Could not save project ${cleanUsername}/${cleanRepo}: ${error.message}`
        );

        addError(stats, {
            username: cleanUsername,
            repo: cleanRepo,
            message: error.message
        });

        return {
            success: false,
            added: false,
            updated: false,
            skipped: false
        };
    }
}

async function scanGitHubAccount(username, stats, options = {}) {
    if (!isValidUsername(username)) {
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

    const cleanUsername = String(username).trim();

    console.log("");
    console.log(
        `👤 Scanning GitHub account: ${cleanUsername}`
    );

    let repositories;

    try {
        repositories = await getAccountRepositories(cleanUsername, stats);
    } catch (error) {
        console.log(
            `⚠️ Could not scan account ${cleanUsername}: ${error.message}`
        );

        addError(stats, {
            username: cleanUsername,
            message: error.message
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

    for (const repository of repositories) {
        if (!repository?.name) {
            continue;
        }

        const repoName = String(repository.name).trim();

        if (!repoName) {
            continue;
        }

        const result = await saveDiscoveredProject(
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
            projects.push(result.project);
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

function isSafeToRemoveProject(error) {
    const status = Number(
        error?.status ||
        error?.response?.status ||
        error?.statusCode ||
        0
    );

    if (status === 404) {
        return true;
    }

    if (status === 403 || status === 429) {
        return false;
    }

    const message = String(error?.message || "").toLowerCase();

    if (
        message.includes("rate limit") ||
        message.includes("api rate") ||
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("fetch failed") ||
        message.includes("econn") ||
        message.includes("enotfound")
    ) {
        return false;
    }

    return false;
}

/**
 * ✅ FIXED: Soft check
 * - empty content → KEEP (remove mat karo)
 * - sirf confirmed 404 → REMOVE
 */
async function checkExistingProjects(stats) {
    let projects;

    try {
        projects = getProjects();
    } catch (error) {
        console.log(
            `❌ Could not load existing projects: ${error.message}`
        );

        addError(stats, {
            message: error.message
        });

        return {
            checked: 0,
            removed: 0,
            updated: 0
        };
    }

    if (!Array.isArray(projects)) {
        return {
            checked: 0,
            removed: 0,
            updated: 0
        };
    }

    let checked = 0;
    let removed = 0;
    let updated = 0;

    for (const storedProject of projects) {
        const username =
            storedProject?.developer?.username ||
            storedProject?.github?.owner?.login ||
            storedProject?.owner ||
            null;

        const repo =
            storedProject?.github?.name ||
            storedProject?.repo ||
            null;

        if (!isValidUsername(username)) {
            console.log("⏭️ Invalid stored project owner skipped.");
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

        const cleanUsername = String(username).trim();
        const cleanRepo = repo.trim();
        const key = getProjectKey(cleanUsername, cleanRepo);

        try {
            const content = await getCachedGitProHubFile(
                cleanUsername,
                cleanRepo,
                stats
            );

            checked++;

            // ✅ FIX: empty content pe REMOVE mat karo
            if (!content) {
                console.log(
                    `🛡️ SAFE MODE: empty content, keeping ${cleanUsername}/${cleanRepo}`
                );
                continue;
            }

            const currentProject = await getCachedProject(
                cleanUsername,
                cleanRepo,
                stats
            );

            if (!currentProject) {
                console.log(
                    `⚠️ Project data unavailable: ${cleanUsername}/${cleanRepo}`
                );
                continue;
            }

            const saveResult = await saveProject(currentProject);

            if (saveResult?.updated) {
                updated++;
                stats.updatedKeys.add(key);

                if (
                    !stats.newProjects.some(project =>
                        getProjectKey(
                            project?.developer?.username ||
                                project?.github?.owner?.login ||
                                project?.owner,
                            project?.github?.name || project?.repo
                        ) === key
                    )
                ) {
                    stats.updatedProjects.push(currentProject);
                }
            }
        } catch (error) {
            // ✅ Sirf confirmed 404 pe remove
            if (AUTO_REMOVE_ENABLED && isSafeToRemoveProject(error)) {
                console.log(
                    `🗑️ Confirmed missing (404): ${cleanUsername}/${cleanRepo}`
                );

                try {
                    await removeProject(cleanUsername, cleanRepo);

                    checked++;
                    removed++;
                    stats.removedKeys.add(key);
                    stats.removedProjects.push(storedProject);
                } catch (removeError) {
                    console.log(
                        `⚠️ Could not remove ${cleanUsername}/${cleanRepo}: ${removeError.message}`
                    );

                    addError(stats, {
                        username: cleanUsername,
                        repo: cleanRepo,
                        message: removeError.message
                    });
                }

                continue;
            }

            // rate limit / network / timeout → KEEP
            console.log(
                `🛡️ SAFE MODE: keeping ${cleanUsername}/${cleanRepo}`
            );
            console.log(`   ⚠️ ${error.message}`);

            addError(stats, {
                username: cleanUsername,
                repo: cleanRepo,
                message: error.message
            });
        }
    }

    return {
        checked,
        removed,
        updated
    };
}

async function discoverNewGitProHubProjects(stats) {
    console.log("");
    console.log(
        "🌐 Starting global GitHub GitProHub discovery..."
    );

    let repositories;

    try {
        repositories = await crawlGitHubGitProHubFiles();
    } catch (error) {
        console.log(
            `❌ Global discovery failed: ${error.message}`
        );

        addError(stats, {
            message: error.message
        });

        return {
            success: false,
            added: 0,
            updated: 0,
            newAccounts: []
        };
    }

    if (!Array.isArray(repositories)) {
        return {
            success: true,
            added: 0,
            updated: 0,
            newAccounts: []
        };
    }

    const newAccounts = new Map();
    const globalProjects = new Map();

    for (const item of repositories) {
        const username =
            item?.username ||
            item?.owner ||
            item?.github?.owner?.login ||
            null;

        const repo =
            item?.repo ||
            item?.repository ||
            item?.name ||
            item?.github?.name ||
            null;

        if (!isValidUsername(username)) {
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

        const accountKey = String(username).trim().toLowerCase();

        let verifiedUser = stats.accountCache.get(accountKey);

        if (
            !verifiedUser &&
            !stats.accountVerificationErrors.has(accountKey)
        ) {
            const verification = await verifyGitHubAccount(username);

            if (!verification.success) {
                stats.accountVerificationErrors.set(
                    accountKey,
                    verification
                );

                console.log(
                    `🛡️ Global account skipped safely: ${username}`
                );
                continue;
            }

            verifiedUser = verification.user;
            stats.accountCache.set(accountKey, verifiedUser);
        }

        if (!verifiedUser) {
            continue;
        }

        const accountResult = saveVerifiedAccount(verifiedUser);

        if (accountResult.newAccount) {
            const login = accountResult.username;

            if (login && !newAccounts.has(login.toLowerCase())) {
                newAccounts.set(login.toLowerCase(), login);
                stats.newAccountNames.add(login);
            }
        }

        const actualUsername = String(verifiedUser.login).trim();
        const projectKey = getProjectKey(actualUsername, repo.trim());

        if (globalProjects.has(projectKey)) {
            continue;
        }

        globalProjects.set(projectKey, true);

        // gitprohub.md milte hi add
        await saveDiscoveredProject(
            actualUsername,
            repo.trim(),
            stats
        );
    }

    return {
        success: true,
        added: 0,
        updated: 0,
        newAccounts: Array.from(newAccounts.values())
    };
}

async function discoverKnownGitHubAccounts(stats) {
    const accounts = getKnownGitHubAccounts();

    console.log("");
    console.log(
        `👥 Known GitHub accounts to scan: ${accounts.length}`
    );

    let added = 0;
    let updated = 0;
    const processedAccounts = new Set();

    for (const account of accounts) {
        const normalized = normalizeAccount(account);

        if (!normalized) {
            continue;
        }

        const accountKey = normalized.id
            ? `id:${normalized.id}`
            : `login:${normalized.login.toLowerCase()}`;

        if (processedAccounts.has(accountKey)) {
            continue;
        }

        processedAccounts.add(accountKey);

        const loginKey = normalized.login.toLowerCase();

        let verifiedUser = stats.accountCache.get(loginKey);

        if (
            !verifiedUser &&
            !stats.accountVerificationErrors.has(loginKey)
        ) {
            const verification = await verifyGitHubAccount(
                normalized.login
            );

            if (!verification.success) {
                console.log(
                    `🛡️ Keeping known account safely: ${normalized.login}`
                );

                stats.accountVerificationErrors.set(
                    loginKey,
                    verification
                );

                addError(stats, {
                    username: normalized.login,
                    message:
                        verification.error ||
                        "GitHub account verification failed"
                });

                continue;
            }

            verifiedUser = verification.user;
            stats.accountCache.set(loginKey, verifiedUser);
        }

        if (!verifiedUser) {
            continue;
        }

        const actualUsername = String(verifiedUser.login).trim();

        saveVerifiedAccount(verifiedUser);

        const result = await scanGitHubAccount(actualUsername, stats);

        added += Number(result.added) || 0;
        updated += Number(result.updated) || 0;
    }

    return {
        success: true,
        added,
        updated
    };
}

async function migrateKnownAccounts(stats) {
    const oldAccounts = readKnownAccounts();

    if (!Array.isArray(oldAccounts)) {
        return {
            migrated: 0,
            updated: 0
        };
    }

    const normalized = deduplicateAccounts(oldAccounts);
    const before = JSON.stringify(oldAccounts);
    const after = JSON.stringify(normalized);

    if (before !== after) {
        writeKnownAccounts(normalized);

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

function uniqueProjects(projects) {
    const map = new Map();

    for (const project of projects) {
        if (!project) {
            continue;
        }

        const username =
            project?.developer?.username ||
            project?.github?.owner?.login ||
            project?.owner ||
            null;

        const repo =
            project?.github?.name ||
            project?.repo ||
            null;

        if (!username || !repo) {
            continue;
        }

        try {
            const key = getProjectKey(username, repo);
            map.set(key, project);
        } catch {
            continue;
        }
    }

    return Array.from(map.values());
}

/**
 * ✅ MODE 1: Link se discover + add
 * Examples:
 *   - https://github.com/codersusheel
 *   - https://github.com/codersusheel/HaproID
 *   - codersusheel
 *   - codersusheel/HaproID
 */
async function discoverFromLink(input) {
    if (!input || typeof input !== "string") {
        return {
            success: false,
            message: "Invalid link or username"
        };
    }

    let clean = input.trim();

    clean = clean
        .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
        .replace(/\.git$/i, "")
        .replace(/\/$/, "");

    const parts = clean.split("/").filter(Boolean);

    if (parts.length === 0) {
        return {
            success: false,
            message: "Could not parse GitHub link"
        };
    }

    const username = parts[0];
    const repo = parts[1] || null;

    if (!isValidUsername(username)) {
        return {
            success: false,
            message: "Invalid GitHub username"
        };
    }

    const stats = createDiscoveryStats();

    const verification = await verifyGitHubAccount(username);

    if (!verification.success) {
        return {
            success: false,
            message: verification.error || "GitHub account not found",
            username
        };
    }

    const accountResult = saveVerifiedAccount(verification.user);
    const actualUsername = String(verification.user.login).trim();

    // Specific repo
    if (repo) {
        console.log(`🔗 Link discovery: ${actualUsername}/${repo}`);

        const result = await saveDiscoveredProject(
            actualUsername,
            repo,
            stats
        );

        if (result.skipped && !result.project) {
            return {
                success: false,
                message: "gitprohub.md not found in this repository",
                username: actualUsername,
                repo
            };
        }

        if (!result.success) {
            return {
                success: false,
                message: "Could not add project",
                username: actualUsername,
                repo,
                errors: stats.errors
            };
        }

        return {
            success: true,
            mode: "single-repo",
            username: actualUsername,
            repo,
            added: result.added,
            updated: result.updated,
            project: result.project || null,
            newAccount: accountResult.newAccount
        };
    }

    // Full account scan
    console.log(`🔗 Link discovery (full account): ${actualUsername}`);

    const scanResult = await scanGitHubAccount(actualUsername, stats);

    return {
        success: true,
        mode: "full-account",
        username: actualUsername,
        added: scanResult.added,
        updated: scanResult.updated,
        projects: scanResult.projects || [],
        newAccount: accountResult.newAccount,
        totalFound: (scanResult.projects || []).length
    };
}

/**
 * ✅ MODE 2: Auto full discovery (30 min scheduler)
 */
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

    const stats = createDiscoveryStats();

    console.log("");
    console.log("1️⃣ Cleaning known GitHub accounts...");
    const migration = await migrateKnownAccounts(stats);

    console.log("");
    console.log("2️⃣ Checking existing GitProHub projects...");
    const existing = await checkExistingProjects(stats);

    console.log("");
    console.log("3️⃣ Running global GitHub discovery...");
    const global = await discoverNewGitProHubProjects(stats);

    for (const username of global.newAccounts || []) {
        stats.newAccountNames.add(username);
    }

    console.log("");
    console.log("4️⃣ Scanning known GitHub accounts...");
    const known = await discoverKnownGitHubAccounts(stats);

    let finalProjects = [];

    try {
        finalProjects = getProjects();
    } catch (error) {
        console.log(
            `❌ Could not load final project list: ${error.message}`
        );

        addError(stats, {
            message: error.message
        });
    }

    if (!Array.isArray(finalProjects)) {
        finalProjects = [];
    }

    finalProjects = uniqueProjects(finalProjects);

    const finalAccounts = getNormalizedKnownAccounts();

    const added = stats.addedKeys.size;
    const updated = stats.updatedKeys.size;
    const removed = stats.removedKeys.size;
    const newAccounts = Array.from(stats.newAccountNames);

    const newProjects = uniqueProjects(stats.newProjects);
    const updatedProjects = uniqueProjects(stats.updatedProjects);
    const removedProjects = uniqueProjects(stats.removedProjects);

    const result = {
        success: stats.errors.length === 0,
        total: finalProjects.length,
        added,
        updated,
        removed,
        newAccounts,
        accounts: finalAccounts,
        projects: finalProjects,
        newProjects,
        updatedProjects,
        removedProjects,
        errors: stats.errors,
        checkedExisting: existing.checked,
        existingRemoved: existing.removed,
        existingUpdated: existing.updated,
        knownAccountsScanned: finalAccounts.length,
        knownAccountsTotal: finalAccounts.length,
        globalSearchSuccess: Boolean(global.success),
        knownAccountsSuccess: Boolean(known.success),
        migration,
        completedAt: new Date().toISOString()
    };

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

    console.log(`📦 Total projects : ${result.total}`);
    console.log(`🆕 New projects   : ${result.added}`);
    console.log(`🔄 Updated        : ${result.updated}`);
    console.log(`🗑️  Removed        : ${result.removed}`);
    console.log(`👤 New accounts   : ${result.newAccounts.length}`);
    console.log(`👥 Known accounts : ${result.knownAccountsScanned}`);
    console.log(`⚠️  Errors         : ${result.errors.length}`);

    if (result.newAccounts.length > 0) {
        console.log("");
        console.log("👤 New GitHub accounts:");
        for (const username of result.newAccounts) {
            console.log(`   ➕ ${username}`);
        }
    }

    if (result.newProjects.length > 0) {
        console.log("");
        console.log("🆕 New GitProHub projects:");
        for (const project of result.newProjects) {
            const username =
                project?.developer?.username ||
                project?.github?.owner?.login ||
                project?.owner ||
                "unknown";
            const repo =
                project?.github?.name ||
                project?.repo ||
                "unknown";
            console.log(`   ➕ ${username}/${repo}`);
        }
    }

    if (result.updatedProjects.length > 0) {
        console.log("");
        console.log("🔄 Updated GitProHub projects:");
        for (const project of result.updatedProjects) {
            const username =
                project?.developer?.username ||
                project?.github?.owner?.login ||
                project?.owner ||
                "unknown";
            const repo =
                project?.github?.name ||
                project?.repo ||
                "unknown";
            console.log(`   🔄 ${username}/${repo}`);
        }
    }

    if (result.removedProjects.length > 0) {
        console.log("");
        console.log("🗑️ Removed GitProHub projects:");
        for (const project of result.removedProjects) {
            const username =
                project?.developer?.username ||
                project?.github?.owner?.login ||
                project?.owner ||
                "unknown";
            const repo =
                project?.github?.name ||
                project?.repo ||
                "unknown";
            console.log(`   🗑️ ${username}/${repo}`);
        }
    }

    if (result.errors.length > 0) {
        console.log("");
        console.log("⚠️ Discovery errors:");
        for (const error of result.errors) {
            const owner = error?.username
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

module.exports = {
    discoverAllGitProHubProjects,
    discoverFromLink,
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
    normalizeAccount,
    getNormalizedKnownAccounts,
    saveVerifiedAccount,
    migrateKnownAccounts,
    createDiscoveryStats
};