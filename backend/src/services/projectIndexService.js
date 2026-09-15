// =========================================================
// GitProHub Project Index Service
// =========================================================

const fs = require("fs");
const path = require("path");


// =========================================================
// Data Directory
// =========================================================

const DATA_DIR =
    path.join(
        process.cwd(),
        "data"
    );


// =========================================================
// Index File
// =========================================================

const INDEX_FILE =
    path.join(
        DATA_DIR,
        "projects.json"
    );


// =========================================================
// Ensure Data Directory
// =========================================================

function ensureDataDirectory() {

    if (
        !fs.existsSync(DATA_DIR)
    ) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }
}


// =========================================================
// Read Index
// =========================================================

function readProjects() {

    ensureDataDirectory();

    if (
        !fs.existsSync(INDEX_FILE)
    ) {

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


        if (
            Array.isArray(data)
        ) {

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
// Write Index
// =========================================================

function writeProjects(
    projects
) {

    ensureDataDirectory();


    const tempFile =
        `${INDEX_FILE}.tmp`;


    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            projects,
            null,
            2
        ),
        "utf8"
    );


    fs.renameSync(
        tempFile,
        INDEX_FILE
    );
}


// =========================================================
// Project Key
// =========================================================

function getProjectKey(
    project
) {

    const username =
        project?.developer?.username ||
        project?.owner?.login ||
        project?.username ||
        "";


    const repo =
        project?.github?.name ||
        project?.repo ||
        "";


    if (
        !username ||
        !repo
    ) {

        return null;
    }


    return (
        `${username}/${repo}`
            .toLowerCase()
    );
}


// =========================================================
// Save / Update Project
// =========================================================

function saveProject(
    project
) {

    const projects =
        readProjects();


    const key =
        getProjectKey(project);


    if (!key) {

        console.error(
            "❌ Cannot save project: invalid project key"
        );

        return null;
    }


    const index =
        projects.findIndex(
            existing =>
                getProjectKey(existing) === key
        );


    const now =
        new Date().toISOString();


    const updatedProject = {

        ...project,

        sync: {
            ...(project.sync || {}),
            lastCheckedAt: now,
            lastUpdatedAt:
                index === -1
                    ? now
                    : (
                        projects[index]?.sync
                            ?.lastUpdatedAt ||
                        now
                    )
        }

    };


    // =====================================================
    // New Project
    // =====================================================

    if (index === -1) {

        projects.push(
            updatedProject
        );

        writeProjects(
            projects
        );

        console.log(
            `🆕 Added: ${key}`
        );

        return updatedProject;
    }


    // =====================================================
    // Existing Project
    // =====================================================

    projects[index] =
        updatedProject;


    writeProjects(
        projects
    );


    console.log(
        `🔄 Updated: ${key}`
    );


    return updatedProject;
}


// =========================================================
// Remove Project
// =========================================================

function removeProject(
    username,
    repo
) {

    const projects =
        readProjects();


    const key =
        `${username}/${repo}`
            .toLowerCase();


    const filtered =
        projects.filter(
            project =>
                getProjectKey(project) !== key
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
// Remove Projects Not Found During Sync
// =========================================================

function removeMissingProjects(
    discoveredKeys
) {

    const projects =
        readProjects();


    const validKeys =
        new Set(
            discoveredKeys.map(
                key =>
                    key.toLowerCase()
            )
        );


    const removed = [];


    const filtered =
        projects.filter(
            project => {

                const key =
                    getProjectKey(project);


                if (!key) {
                    return false;
                }


                if (
                    validKeys.has(
                        key.toLowerCase()
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
            const key of removed
        ) {

            console.log(
                `🗑️ Missing/Removed: ${key}`
            );
        }
    }


    return removed;
}


// =========================================================
// Get All Projects
// =========================================================

function getProjects() {

    return readProjects();
}


// =========================================================
// Get One Project
// =========================================================

function getProjectFromIndex(
    username,
    repo
) {

    const key =
        `${username}/${repo}`
            .toLowerCase();


    const projects =
        readProjects();


    return (
        projects.find(
            project =>
                getProjectKey(project) === key
        ) ||
        null
    );
}


// =========================================================
// Stats
// =========================================================

function getIndexStats() {

    const projects =
        readProjects();


    return {

        total:
            projects.length,

        lastUpdated:
            projects.reduce(
                (
                    latest,
                    project
                ) => {

                    const date =
                        project?.sync
                            ?.lastCheckedAt;

                    if (!date) {
                        return latest;
                    }

                    if (
                        !latest ||
                        date > latest
                    ) {
                        return date;
                    }

                    return latest;
                },
                null
            )
    };
}


// =========================================================
// Export
// =========================================================

module.exports = {

    saveProject,
    removeProject,
    removeMissingProjects,

    getProjects,
    getProjectFromIndex,

    getIndexStats,

    readProjects,
    writeProjects,

    getProjectKey

};