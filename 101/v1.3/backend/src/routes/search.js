//  js id="v7k2qa"
const express = require("express");

const {
    // searchProjects
} = require("../services/projectIndexService");


const router = express.Router();


// Search Projects
router.get("/", (req, res) => {

    const query =
        req.query.q || "";


    if (!query.trim()) {

        return res.status(400).json({

            success: false,

            message: "Search query is required"

        });

    }


    const projects =
        searchProjects(query);


    res.json({

        success: true,

        query: query,

        total: projects.length,

        projects: projects

    });

});


module.exports = router;
 
