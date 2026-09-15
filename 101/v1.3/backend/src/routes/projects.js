const express = require("express");

const {
    getAllProjects,
    getProjectByUrl,
    searchProjects,
    removeProject
} = require("../services/projectIndexService");

const {
    discoverProjects,
    discoverProjectsByUser
} = require("../services/discoveryService");

const {
    runAutoDiscovery
} = require("../services/autoDiscoveryService");


const router = express.Router();


// ==========================================
// Manual Automatic Discovery
// ==========================================

router.get("/auto-discover", async (req, res) => {

    try {

        await runAutoDiscovery();


        res.json({

            success: true,

            message:
                "Automatic discovery completed successfully"

        });


    } catch (error) {

        console.error(
            "Auto discovery error:",
            error
        );


        res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


// ==========================================
// Discover Projects By GitHub Username
// ==========================================

router.get("/discover/:username", async (req, res) => {

    try {

        const username =
            req.params.username.trim();


        if (!username) {

            return res.status(400).json({

                success: false,

                message:
                    "GitHub username is required"

            });

        }


        const result =
            await discoverProjectsByUser(
                username
            );


        res.json({

            success: true,

            username:
                username,

            total:
                result.length,

            projects:
                result

        });


    } catch (error) {

        console.error(
            "Username discovery error:",
            error
        );


        res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


// ==========================================
// Global GitProHub Discovery
// ==========================================

router.get("/discover", async (req, res) => {

    try {

        const page =
            Math.max(
                Number(req.query.page) || 1,
                1
            );


        const perPage =
            Math.min(
                Math.max(
                    Number(req.query.per_page) || 30,
                    1
                ),
                100
            );


        const result =
            await discoverProjects(
                page,
                perPage
            );


        res.json({

            success: true,

            ...result

        });


    } catch (error) {

        console.error(
            "Global discovery error:",
            error
        );


        res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


// ==========================================
// Featured Projects
// ==========================================

router.get("/featured", (req, res) => {

    const projects =
        getAllProjects().filter(
            project =>
                project.featured === true
        );


    res.json({

        success: true,

        total:
            projects.length,

        projects:
            projects

    });

});


// ==========================================
// Projects By Category
// ==========================================

router.get("/category/:category", (req, res) => {

    const category =
        req.params.category
            .trim()
            .toLowerCase();


    const projects =
        getAllProjects().filter(
            project =>
                project.category
                    ?.toLowerCase() === category
        );


    res.json({

        success: true,

        category:
            req.params.category,

        total:
            projects.length,

        projects:
            projects

    });

});


// ==========================================
// Projects By Tag
// ==========================================

router.get("/tag/:tag", (req, res) => {

    const tag =
        req.params.tag
            .trim()
            .toLowerCase();


    const projects =
        getAllProjects().filter(
            project =>
                Array.isArray(project.tags) &&
                project.tags.some(
                    item =>
                        item
                            .toLowerCase()
                            === tag
                )
        );


    res.json({

        success: true,

        tag:
            req.params.tag,

        total:
            projects.length,

        projects:
            projects

    });

});


// ==========================================
// Search Projects
// ==========================================

router.get("/search", (req, res) => {

    const query =
        (req.query.q || "").trim();


    const projects =
        searchProjects(query);


    res.json({

        success: true,

        query:
            query,

        total:
            projects.length,

        projects:
            projects

    });

});


// ==========================================
// Single Project
// ==========================================

router.get("/project", (req, res) => {

    const url =
        (req.query.url || "").trim();


    if (!url) {

        return res.status(400).json({

            success: false,

            message:
                "Project URL is required"

        });

    }


    const project =
        getProjectByUrl(url);


    if (!project) {

        return res.status(404).json({

            success: false,

            message:
                "Project not found"

        });

    }


    res.json({

        success: true,

        project:
            project

    });

});


// ==========================================
// All Projects
// ==========================================

router.get("/", (req, res) => {

    const projects =
        getAllProjects();


    res.json({

        success: true,

        total:
            projects.length,

        projects:
            projects

    });

});


// ==========================================
// Remove Project
// ==========================================

router.delete("/", (req, res) => {

    const url =
        (req.query.url || "").trim();


    if (!url) {

        return res.status(400).json({

            success: false,

            message:
                "Project URL is required"

        });

    }


    const removed =
        removeProject(url);


    if (!removed) {

        return res.status(404).json({

            success: false,

            message:
                "Project not found"

        });

    }


    res.json({

        success: true,

        message:
            "Project removed successfully"

    });

});


module.exports = router;
 
