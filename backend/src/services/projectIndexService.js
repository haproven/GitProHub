const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(
    process.cwd(),
    "data"
);

const INDEX_FILE = path.join(
    DATA_DIR,
    "projects.json"
);

const TEMP_FILE = `${INDEX_FILE}.tmp`;

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

function readProjects() {

    ensureDataDirectory();

    if (!fs.existsSync(INDEX_FILE)) {
        return [];
    }

    try {

        const content =
            fs.readFileSync(
                INDEX_FILE,
                "utf8"
            );

        if (!content.trim()) {
            return [];
        }

        const data =
            JSON.parse(content);

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

function writeProjects(
    projects = []
) {

    ensureDataDirectory();

    const safeProjects =
        Array.isArray(projects)
            ? projects
            : [];

    const content =
        JSON.stringify(
            safeProjects,
            null,
            2
        );

    fs.writeFileSync(
        TEMP_FILE,
        content,
        "utf8"
    );

    try {

        fs.renameSync(
            TEMP_FILE,
            INDEX_FILE
        );

    } catch (error) {

        try {

            if (
                fs.existsSync(
                    INDEX_FILE
                )
            ) {

                fs.unlinkSync(
                    INDEX_FILE
                );
            }

            fs.renameSync(
                TEMP_FILE,
                INDEX_FILE
            );

        } catch (renameError) {

            if (
                fs.existsSync(
                    TEMP_FILE
                )
            ) {

                try {

                    fs.unlinkSync(
                        TEMP_FILE
                    );

                } catch {}
            }

            throw renameError;
        }
    }
}

function getProjectKey(
    project
) {

    if (!project) {
        return null;
    }

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

    const cleanUsername =
        String(username).trim();

    const cleanRepo =
        String(repo).trim();

    if (
        !cleanUsername ||
        !cleanRepo
    ) {
        return null;
    }

    return (
        `${cleanUsername}/${cleanRepo}`
    ).toLowerCase();
}

function normalizeProject(
    project
) {

    if (
        !project ||
        typeof project !== "object"
    ) {
        return null;
    }

    const key =
        getProjectKey(
            project
        );

    if (!key) {
        return null;
    }

    return project;
}

function removeDuplicateProjects(
    projects = []
) {

    if (
        !Array.isArray(projects)
    ) {
        return [];
    }

    const unique =
        new Map();

    for (
        const project
        of projects
    ) {

        const key =
            getProjectKey(
                project
            );

        if (!key) {
            continue;
        }

        if (
            !unique.has(
                key
            )
        ) {

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

function saveProject(
    project
) {

    const normalizedProject =
        normalizeProject(
            project
        );

    if (
        !normalizedProject
    ) {

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

    let projects =
        readProjects();

    projects =
        removeDuplicateProjects(
            projects
        );

    const key =
        getProjectKey(
            normalizedProject
        );

    const index =
        projects.findIndex(
            existing =>
                getProjectKey(
                    existing
                ) === key
        );

    const now =
        new Date().toISOString();

    const oldProject =
        index !== -1
            ? projects[index]
            : null;

    const oldSync =
        oldProject?.sync &&
        typeof oldProject.sync === "object"
            ? oldProject.sync
            : {};

    if (
        index === -1
    ) {

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

        projects =
            removeDuplicateProjects(
                projects
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

            project:
                newProject,

            key
        };
    }

    const updatedProject = {

        ...oldProject,

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

        project:
            updatedProject,

        key
    };
}

function removeProject(
    username,
    repo
) {

    if (
        !username ||
        !repo
    ) {
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
                getProjectKey(
                    project
                ) !== key
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

function removeMissingProjects(
    discoveredKeys = []
) {

    const projects =
        readProjects();

    const validKeys =
        new Set(
            Array.isArray(
                discoveredKeys
            )
                ? discoveredKeys
                    .filter(Boolean)
                    .map(
                        key =>
                            String(key)
                                .trim()
                                .toLowerCase()
                    )
                : []
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

function getProjects() {

    return removeDuplicateProjects(
        readProjects()
    );
}

function getProjectFromIndex(
    username,
    repo
) {

    if (
        !username ||
        !repo
    ) {
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
                getProjectKey(
                    project
                ) === key
        ) ||
        null
    );
}

function getIndexStats() {

    const projects =
        removeDuplicateProjects(
            readProjects()
        );

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

        total:
            projects.length,

        lastUpdated
    };
}

function getProjectCount() {

    return removeDuplicateProjects(
        readProjects()
    ).length;
}

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
