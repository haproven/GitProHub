//  js id="h4p8xk"
const express = require("express");

const {
    getAllProjects,
    getProjectByUrl,
    searchProjects,
    removeProject
} = require("../services/projectIndexService");

const {
    discoverProjects
} = require("../services/discoveryService");


const router = express.Router();


// Discover GitHub Projects
router.get("/discover", async (req, res) => {

    try {

        const page =
            Number(req.query.page) || 1;

        const perPage =
            Number(req.query.per_page) || 30;


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

        console.error(error);


        res.status(500).json({

            success: false,

            error: error.message

        });

    }

});


// Featured Projects
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


// Projects By Category
router.get("/category/:category", (req, res) => {

    const category =
        req.params.category
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


// Search Projects
router.get("/search", (req, res) => {

    const query =
        req.query.q || "";


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


// Single Project
router.get("/project", (req, res) => {

    const url =
        req.query.url;


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


// All Projects
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


// Remove Project
router.delete("/", (req, res) => {

    const url =
        req.query.url;


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
 
