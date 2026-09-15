// =========================================================
// GitProHub - Project Index Service
// =========================================================

const fs = require("fs");
const path = require("path");

// =========================================================
// DATA DIRECTORY
// =========================================================

const DATA_DIR = path.join(
    process.cwd(),
    "data"
);

// =========================================================
// INDEX FILE
// =========================================================

const INDEX_FILE = path.join(
    DATA_DIR,
    "projects.json"
);

// =========================================================
// ENSURE DATA DIRECTORY
// =========================================================

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

// =========================================================
// READ PROJECT INDEX
// =========================================================

function readProjects() {
    ensureDataDirectory();

    if (!fs.existsSync(INDEX_FILE)) {
        return [];
    }

    try {
        const content = fs.readFileSync(
            INDEX_FILE,
            "utf8"
        );

        if (!content.trim()) {
            return [];
        }

        const data = JSON.parse(content);

        if (Array.isArray(data)) {
            return data;
        }

        if (
            data &&
            Array.isArray(data.projects)
        ) {
            return data.projects;
        }

        return [];
    } catch (error) {
        console.error(
            "❌ Project index read error:",
            error.message
        );

        return [];
    }
}

// =========================================================
// WRITE PROJECT INDEX
// =========================================================

function writeProjects(projects = []) {
    ensureDataDirectory();

    const tempFile = `${INDEX_FILE}.tmp`;

    const content = JSON.stringify(
        projects,
        null,
        2
    );

    fs.writeFileSync(
        tempFile,
        content,
        "utf8"
    );

    try {
        fs.renameSync(
            tempFile,
            INDEX_FILE
        );
    } catch (error) {
        try {
            if (fs.existsSync(INDEX_FILE)) {
                fs.unlinkSync(INDEX_FILE);
            }

            fs.renameSync(
                tempFile,
                INDEX_FILE
            );
        } catch (renameError) {
            if (fs.existsSync(tempFile)) {
                try {
                    fs.unlinkSync(tempFile);
                } catch {}
            }

            throw renameError;
        }
    }
}

// =========================================================
// PROJECT KEY
// =========================================================

// Unique project:
// username/repository

// Example:
// codersusheel/haprobase

// Haproven/HaproID
// =========================================================

function getProjectKey(project) {
    const username =
        project?.developer?.username ||
        project?.github?.owner?.login ||
        project?.owner?.login ||
        project?.username ||
        "";

    const repo =
        project?.github?.name ||
        project?.repo ||
        project?.repository?.name ||
        "";

    if (!username || !repo) {
        return null;
    }

    return (
        `${String(username).trim()}/${String(repo).trim()}`
    ).toLowerCase();
}

// =========================================================
// NORMALIZE PROJECT
// =========================================================

function normalizeProject(project) {
    if (!project) {
        return null;
    }

    const key = getProjectKey(project);

    if (!key) {
        return null;
    }

    return project;
}

// =========================================================
// REMOVE DUPLICATE PROJECTS
// =========================================================

function removeDuplicateProjects(projects) {
    const unique = new Map();

    for (const project of projects) {
        const key = getProjectKey(project);

        if (!key) {
            continue;
        }

        if (!unique.has(key)) {
            unique.set(
                key,
                project
            );
        }
    }

    return Array.from(
        unique.values()
    );
}

// =========================================================
// SAVE / UPDATE PROJECT
// =========================================================

// Return:
//
// {
//     added: true/false,
//     updated: true/false,
//     project,
//     key
// }
//
// =========================================================

function saveProject(project) {
    const normalizedProject =
        normalizeProject(project);

    if (!normalizedProject) {
        console.error(
            "❌ Cannot save project: invalid project key"
        );

        return {
            added: false,
            updated: false,
            project: null,
            key: null
        };
    }

    // -----------------------------------------
    // Read current index
    // -----------------------------------------

    let projects = readProjects();

    // -----------------------------------------
    // Clean accidental duplicates first
    // -----------------------------------------

    projects =
        removeDuplicateProjects(
            projects
        );

    // -----------------------------------------
    // Project key
    // -----------------------------------------

    const key =
        getProjectKey(
            normalizedProject
        );

    // -----------------------------------------
    // Find existing project
    // -----------------------------------------

    const index =
        projects.findIndex(
            existing =>
                getProjectKey(existing) ===
                key
        );

    // -----------------------------------------
    // Current time
    // -----------------------------------------

    const now =
        new Date().toISOString();

    // -----------------------------------------
    // Existing sync data
    // -----------------------------------------

    const oldSync =
        index !== -1 &&
        projects[index]?.sync
            ? projects[index].sync
            : {};

    // -----------------------------------------
    // New project
    // -----------------------------------------

    if (index === -1) {
        const newProject = {
            ...normalizedProject,

            sync: {
                ...(normalizedProject.sync || {}),

                firstSeenAt:
                    normalizedProject?.sync
                        ?.firstSeenAt ||
                    now,

                lastCheckedAt:
                    now,

                lastUpdatedAt:
                    now
            }
        };

        projects.push(
            newProject
        );

        writeProjects(
            projects
        );

        console.log(
            `🆕 Added: ${key}`
        );

        return {
            added: true,
            updated: false,
            project: newProject,
            key
        };
    }

    // -----------------------------------------
    // Existing project
    // -----------------------------------------

    const updatedProject = {
        ...projects[index],
        ...normalizedProject,

        sync: {
            ...oldSync,
            ...(normalizedProject.sync || {}),

            firstSeenAt:
                oldSync.firstSeenAt ||
                normalizedProject?.sync
                    ?.firstSeenAt ||
                now,

            lastCheckedAt:
                now,

            lastUpdatedAt:
                now
        }
    };

    projects[index] =
        updatedProject;

    // -----------------------------------------
    // Final duplicate cleanup
    // -----------------------------------------

    projects =
        removeDuplicateProjects(
            projects
        );

    writeProjects(
        projects
    );

    console.log(
        `🔄 Updated: ${key}`
    );

    return {
        added: false,
        updated: true,
        project: updatedProject,
        key
    };
}

// =========================================================
// REMOVE ONE PROJECT
// =========================================================

function removeProject(
    username,
    repo
) {
    if (!username || !repo) {
        return false;
    }

    const projects =
        readProjects();

    const key =
        `${String(username).trim()}/${String(repo).trim()}`
            .toLowerCase();

    const filtered =
        projects.filter(
            project =>
                getProjectKey(project) !==
                key
        );

    if (
        filtered.length ===
        projects.length
    ) {
        return false;
    }

    writeProjects(
        filtered
    );

    console.log(
        `🗑️ Removed: ${key}`
    );

    return true;
}

// =========================================================
// REMOVE PROJECTS NOT FOUND DURING SYNC
// =========================================================

// IMPORTANT:
//
// Is function ko global discovery ke baad
// blindly use nahi karna chahiye.
//
// GitHub global search incomplete ho sakta hai.
//
// Existing discoveryService is function ko
// use nahi kar raha, jo correct hai.
//
// =========================================================

function removeMissingProjects(
    discoveredKeys = []
) {
    const projects =
        readProjects();

    const validKeys =
        new Set(
            discoveredKeys
                .filter(Boolean)
                .map(
                    key =>
                        String(key)
                            .toLowerCase()
                )
        );

    const removed = [];

    const filtered =
        projects.filter(
            project => {
                const key =
                    getProjectKey(
                        project
                    );

                if (!key) {
                    return false;
                }

                if (
                    validKeys.has(
                        key
                    )
                ) {
                    return true;
                }

                removed.push(
                    key
                );

                return false;
            }
        );

    if (
        removed.length > 0
    ) {
        writeProjects(
            filtered
        );

        for (
            const key
            of removed
        ) {
            console.log(
                `🗑️ Missing/Removed: ${key}`
            );
        }
    }

    return removed;
}

// =========================================================
// GET ALL PROJECTS
// =========================================================

function getProjects() {
    return readProjects();
}

// =========================================================
// GET ONE PROJECT
// =========================================================

function getProjectFromIndex(
    username,
    repo
) {
    if (!username || !repo) {
        return null;
    }

    const key =
        `${String(username).trim()}/${String(repo).trim()}`
            .toLowerCase();

    const projects =
        readProjects();

    return (
        projects.find(
            project =>
                getProjectKey(project) ===
                key
        ) ||
        null
    );
}

// =========================================================
// GET INDEX STATS
// =========================================================

function getIndexStats() {
    const projects =
        readProjects();

    let lastUpdated =
        null;

    for (
        const project
        of projects
    ) {
        const date =
            project?.sync?.lastCheckedAt ||
            project?.sync?.lastUpdatedAt ||
            null;

        if (!date) {
            continue;
        }

        if (
            !lastUpdated ||
            date > lastUpdated
        ) {
            lastUpdated =
                date;
        }
    }

    return {
        // Actual unique projects

        total:
            removeDuplicateProjects(
                projects
            ).length,

        lastUpdated
    };
}

// =========================================================
// GET TOTAL PROJECT COUNT
// =========================================================

function getProjectCount() {
    const projects =
        readProjects();

    return removeDuplicateProjects(
        projects
    ).length;
}

// =========================================================
// EXPORT
// =========================================================

module.exports = {
    saveProject,
    removeProject,
    removeMissingProjects,
    getProjects,
    getProjectCount,
    getProjectFromIndex,
    getIndexStats,
    readProjects,
    writeProjects,
    getProjectKey
};
