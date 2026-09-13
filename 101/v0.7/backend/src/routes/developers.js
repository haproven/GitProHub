const express = require("express");

const {
    getAllProjects
} = require("../services/projectIndexService");


const router = express.Router();


// Developer Projects
router.get("/:username", (req, res) => {

    const username =
        req.params.username.toLowerCase();


    const projects =
        getAllProjects().filter(project => {

            return (
                project.developer?.username
                    ?.toLowerCase() === username
            );

        });


    res.json({

        success: true,

        username:
            req.params.username,

        total:
            projects.length,

        projects:
            projects

    });

});


module.exports = router;
