// =========================================================
// GitProHub - Discovery Service (Upgraded)
// =========================================================

const {
    crawlGitHubGitProHubFiles,
    getUserRepositories
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

const fs = require("fs");
const path = require("path");

// =========================================================
// CONFIG
// =========================================================

const DATA_DIR = path.join(__dirname, "..", "data");
const KNOWN_ACCOUNTS_FILE = path.join(DATA_DIR, "knownAccounts.json");

// =========================================================
// FILE HELPERS
// =========================================================

function ensureKnownAccountsFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(KNOWN_ACCOUNTS_FILE)) {
        fs.writeFileSync(KNOWN_ACCOUNTS_FILE, JSON.stringify([], null, 2), "utf8");
    }
}

function getStoredKnownAccounts() {
    ensureKnownAccountsFile();

    try {
        const data = fs.readFileSync(KNOWN_ACCOUNTS_FILE, "utf8");
        const accounts = JSON.parse(data);

        if (!Array.isArray(accounts)) return [];

        return accounts
            .filter(Boolean)
            .map(u => String(u).trim())
            .filter(Boolean);
    } catch (error) {
        console.error("⚠️ Could not read knownAccounts.json:", error.message);
        return [];
    }
}

function saveKnownAccounts(accounts = []) {
    ensureKnownAccountsFile();

    const uniqueMap = new Map();

    for (const username of accounts) {
        if (!username) continue;

        const clean = String(username).trim();
        if (!clean) continue;

        const key = clean.toLowerCase();
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, clean);
        }
    }

    const uniqueAccounts = Array.from(uniqueMap.values());

    fs.writeFileSync(
        KNOWN_ACCOUNTS_FILE,
        JSON.stringify(uniqueAccounts, null, 2),
        "utf8"
    );

    return uniqueAccounts;
}

// =========================================================
// ACCOUNT REGISTRATION
// =========================================================

function registerKnownAccount(username) {
    if (!username) return false;

    const clean = String(username).trim();
    if (!clean) return false;

    const accounts = getStoredKnownAccounts();
    const exists = accounts.some(
        a => String(a).toLowerCase() === clean.toLowerCase()
    );

    if (exists) return false;

    accounts.push(clean);
    saveKnownAccounts(accounts);

    console.log(`👤 NEW GitHub account added: ${clean}`);
    return true;
}

function registerKnownAccounts(usernames = []) {
    if (!Array.isArray(usernames)) return 0;

    let added = 0;
    for (const username of usernames) {
        if (registerKnownAccount(username)) {
            added++;
        }
    }
    return added;
}

// =========================================================
// HELPERS - OWNER & REPO EXTRACTION
// =========================================================

function getProjectOwnerUsername(project) {
    if (!project) return null;

    return (
        project?.developer?.username ||
        project?.github?.owner?.login ||
        project?.owner?.login ||
        null
    );
}

function getRepositoryOwner(repository) {
    if (!repository) return null;

    if (repository.username) {
        return String(repository.username).trim();
    }

    if (repository.owner?.login) {
        return String(repository.owner.login).trim();
    }

    if (repository.owner?.username) {
        return String(repository.owner.username).trim();
    }

    if (repository.full_name) {
        const parts = String(repository.full_name).split("/");
        if (parts.length >= 2) return parts[0].trim();
    }

    if (repository.name && String(repository.name).includes("/")) {
        const parts = String(repository.name).split("/");
        if (parts.length >= 2) return parts[0].trim();
    }

    return null;
}

function getRepositoryName(repository) {
    if (!repository) return null;

    if (repository.repo) {
        return String(repository.repo).trim();
    }

    if (repository.repository && typeof repository.repository === "string") {
        return String(repository.repository).trim();
    }

    if (repository.full_name) {
        const parts = String(repository.full_name).split("/");
        if (parts.length >= 2) {
            return parts.slice(1).join("/").trim();
        }
    }

    if (repository.name) {
        const name = String(repository.name).trim();
        if (name.includes("/")) {
            return name.split("/").slice(1).join("/").trim();
        }
        return name;
    }

    return null;
}

function registerProjectOwner(project) {
    const username = getProjectOwnerUsername(project);
    if (!username) return false;
    return registerKnownAccount(username);
}

// =========================================================
// GET ALL KNOWN ACCOUNTS
// =========================================================

function getKnownGitHubAccounts() {
    const accounts = new Map();

    // 1. From knownAccounts.json
    for (const username of getStoredKnownAccounts()) {
        if (username) {
            accounts.set(username.toLowerCase(), username);
        }
    }

    // 2. From projects.json
    const projects = getProjects();

    for (const project of projects) {
        const key = getProjectKey(project);

        if (key) {
            const parts = key.split("/");
            if (parts.length === 2 && parts[0]) {
                accounts.set(parts[0].toLowerCase(), parts[0]);
            }
        }

        const owner = getProjectOwnerUsername(project);
        if (owner) {
            accounts.set(owner.toLowerCase(), owner);
        }
    }

    // Sync permanently
    const finalAccounts = Array.from(accounts.values());
    saveKnownAccounts([...getStoredKnownAccounts(), ...finalAccounts]);

    return getStoredKnownAccounts();
}

// =========================================================
// CHECK EXISTING PROJECTS
// =========================================================

async function checkExistingProjects() {
    const projects = getProjects();
    let updated = 0;
    let removed = 0;
    let errors = 0;

    console.log(`📂 Checking ${projects.length} existing project(s)...`);

    for (const project of projects) {
        const key = getProjectKey(project);
        if (!key) continue;

        const parts = key.split("/");
        if (parts.length !== 2) continue;

        const [username, repo] = parts;

        try {
            const freshProject = await getProject(username, repo);

            if (!freshProject) {
                const wasRemoved = removeProject(username, repo);
                if (wasRemoved) {
                    removed++;
                    console.log(`🗑️ Removed: ${username}/${repo}`);
                }
                continue;
            }

            registerProjectOwner(freshProject);
            saveProject(freshProject);
            updated++;
            console.log(`🔄 Updated: ${username}/${repo}`);

        } catch (error) {
            errors++;
            console.error(`⚠️ Could not check ${username}/${repo}:`, error.message);
        }
    }

    return {
        checked: projects.length,
        updated,
        removed,
        errors
    };
}

// =========================================================
// SAVE DISCOVERED PROJECT
// =========================================================

function saveDiscoveredProject(project) {
    if (!project) {
        return { added: false, updated: false };
    }

    const username = getProjectOwnerUsername(project);
    const repo = project?.github?.name || project?.repo || null;

    if (!username || !repo) {
        console.log("⚠️ Project username/repository missing.");
        return { added: false, updated: false };
    }

    registerKnownAccount(username);

    const projects = getProjects();
    const newKey = getProjectKey(project);
    const exists = projects.some(p => getProjectKey(p) === newKey);

    saveProject(project);

    if (exists) {
        console.log(`🔄 Existing project updated: ${username}/${repo}`);
        return { added: false, updated: true };
    }

    console.log(`🆕 NEW GitProHub project added: ${username}/${repo}`);
    return { added: true, updated: false };
}

// =========================================================
// SCAN ONE GITHUB ACCOUNT
// =========================================================

async function scanGitHubAccount(username) {
    if (!username) {
        return {
            username,
            repositories: 0,
            checked: 0,
            found: 0,
            added: 0,
            updated: 0,
            errors: 0
        };
    }

    registerKnownAccount(username);

    console.log("\n==========================================");
    console.log(`🔎 Checking GitHub account: ${username}`);
    console.log("==========================================");

    let repositories = [];

    try {
        repositories = await getUserRepositories(username);
        if (!Array.isArray(repositories)) repositories = [];
    } catch (error) {
        console.error(`❌ Could not load account ${username}:`, error.message);
        return {
            username,
            repositories: 0,
            checked: 0,
            found: 0,
            added: 0,
            updated: 0,
            errors: 1
        };
    }

    console.log(`📦 Public repositories found: ${repositories.length}`);

    let checked = 0;
    let found = 0;
    let added = 0;
    let updated = 0;
    let errors = 0;

    for (const repository of repositories) {
        const repoName = repository?.name;
        if (!repoName) continue;

        checked++;
        console.log(`🔍 [${checked}/${repositories.length}] ${username}/${repoName}`);

        try {
            const project = await getProject(username, repoName);

            if (project) {
                found++;
                registerProjectOwner(project);

                const result = saveDiscoveredProject(project);
                if (result.added) added++;
                if (result.updated) updated++;
            }
        } catch (error) {
            errors++;
            console.error(`⚠️ Could not check ${username}/${repoName}:`, error.message);
        }
    }

    console.log(`\n🎯 GitProHub projects found in ${username}: ${found}`);

    return {
        username,
        repositories: repositories.length,
        checked,
        found,
        added,
        updated,
        errors
    };
}

// =========================================================
// GLOBAL SEARCH (filename:gitprohub.md)
// =========================================================

async function discoverNewGitProHubProjects() {
    console.log("\n🔎 Searching GitHub for new GitProHub projects...");

    let repositories = [];

    try {
        repositories = await crawlGitHubGitProHubFiles();
        if (!Array.isArray(repositories)) repositories = [];
    } catch (error) {
        console.error("❌ Global GitHub discovery failed:", error.message);
        return {
            discovered: 0,
            added: 0,
            updated: 0,
            errors: 1,
            repositories: [],
            newAccounts: []
        };
    }

    console.log(`\n🌐 GitHub repositories discovered: ${repositories.length}`);

    let added = 0;
    let updated = 0;
    let errors = 0;
    const newAccounts = new Set();
    const processed = new Set();

    for (const repository of repositories) {
        const username = getRepositoryOwner(repository);
        const repo = getRepositoryName(repository);

        if (!username || !repo) {
            console.log("⚠️ Invalid global search result:", repository);
            continue;
        }

        const projectKey = `${username}/${repo}`.toLowerCase();
        if (processed.has(projectKey)) continue;
        processed.add(projectKey);

        // New account discovery
        if (registerKnownAccount(username)) {
            newAccounts.add(username);
            console.log(`🆕 NEW ACCOUNT DISCOVERED: ${username}`);
        }

        console.log(`🔍 Checking global project: ${username}/${repo}`);

        try {
            const project = await getProject(username, repo);

            if (!project) {
                console.log(`⏭️ Skipped: ${username}/${repo}`);
                continue;
            }

            const result = saveDiscoveredProject(project);
            if (result.added) added++;
            if (result.updated) updated++;

        } catch (error) {
            errors++;
            console.error(`⚠️ Failed: ${username}/${repo}`, error.message);
        }
    }

    return {
        discovered: repositories.length,
        added,
        updated,
        errors,
        repositories,
        newAccounts: Array.from(newAccounts)
    };
}

// =========================================================
// SCAN ALL KNOWN ACCOUNTS
// =========================================================

async function discoverKnownGitHubAccounts() {
    const accounts = getKnownGitHubAccounts();

    console.log("\n==========================================");
    console.log("👥 KNOWN GITHUB ACCOUNT SCANNER");
    console.log(`👤 Accounts to scan: ${accounts.length}`);
    console.log("==========================================");

    let repositories = 0;
    let checked = 0;
    let found = 0;
    let added = 0;
    let updated = 0;
    let errors = 0;

    for (const username of accounts) {
        const result = await scanGitHubAccount(username);

        repositories += result.repositories;
        checked += result.checked;
        found += result.found;
        added += result.added;
        updated += result.updated;
        errors += result.errors;
    }

    return {
        accounts: accounts.length,
        repositories,
        checked,
        found,
        added,
        updated,
        errors
    };
}

// =========================================================
// MAIN GLOBAL DISCOVERY
// =========================================================

async function discoverAllGitProHubProjects() {
    console.log("\n==========================================");
    console.log("🌍 GLOBAL GITHUB CRAWLER");
    console.log("==========================================");

    // STEP 1: Check existing projects
    const existing = await checkExistingProjects();

    // STEP 2: Global search (discovers new accounts)
    const discovered = await discoverNewGitProHubProjects();

    // STEP 3: Scan all known accounts (includes newly discovered ones)
    const accounts = await discoverKnownGitHubAccounts();

    // STEP 4: Final list
    const projects = getProjects();

    const totalAdded = discovered.added + accounts.added;
    const totalUpdated = existing.updated + discovered.updated + accounts.updated;
    const totalErrors = existing.errors + discovered.errors + accounts.errors;

    console.log("\n==========================================");
    console.log(`🎯 Total GitProHub Projects: ${projects.length}`);
    console.log(`🆕 New projects added: ${totalAdded}`);
    console.log(`🔄 Projects updated: ${totalUpdated}`);
    console.log(`🗑️ Projects removed: ${existing.removed}`);
    console.log(`⚠️ Errors: ${totalErrors}`);
    console.log("==========================================");

    return {
        success: true,
        total: projects.length,
        projects,
        discovered: discovered.discovered,
        added: totalAdded,
        updated: totalUpdated,
        removed: existing.removed,
        checked: existing.checked,
        errors: totalErrors,
        accounts: accounts.accounts,
        accountRepositories: accounts.repositories,
        accountProjectsFound: accounts.found,
        newAccounts: discovered.newAccounts || []
    };
}

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
    checkExistingProjects,
    saveDiscoveredProject,
    scanGitHubAccount,
    discoverNewGitProHubProjects,
    discoverKnownGitHubAccounts,
    getKnownGitHubAccounts,
    registerKnownAccount,
    registerKnownAccounts,
    discoverAllGitProHubProjects
};