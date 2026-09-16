


const express = require("express");

const {
    getAllProjects
} = require("../services/projectIndexService");


const router = express.Router();


// ==========================================
// Developer Projects
// ==========================================

router.get("/:username", (req, res) => {

    const username =
        (req.params.username || "")
            .trim();


    if (!username) {

        return res.status(400).json({

            success: false,

            message:
                "GitHub username is required"

        });

    }


    const projects =
        getAllProjects().filter(
            project =>
                project.developer?.username
                    ?.toLowerCase() ===
                username.toLowerCase()
        );


    res.json({

        success: true,

        username:
            username,

        total:
            projects.length,

        projects:
            projects

    });

});


module.exports = router;
 
