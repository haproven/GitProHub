//  js
// GitProHub Project Index

const projects = [];


// Add / Update Project
function saveProject(project) {

    if (!project || !project.github?.url) {
        return null;
    }


    const existingIndex = projects.findIndex(
        item => item.github.url === project.github.url
    );


    if (existingIndex !== -1) {

        projects[existingIndex] = project;

        return projects[existingIndex];

    }


    projects.push(project);

    return project;

}


// Get All Projects
function getAllProjects() {

    return projects;

}


// Get Single Project
function getProjectByUrl(url) {

    return projects.find(
        project => project.github.url === url
    ) || null;

}


// Remove Project
function removeProject(url) {

    const index = projects.findIndex(
        project => project.github.url === url
    );


    if (index === -1) {
        return false;
    }


    projects.splice(index, 1);

    return true;

}


// Search Projects
function searchProjects(query) {

    if (!query) {
        return projects;
    }


    const search = query.toLowerCase();


    return projects.filter(project => {

        const title =
            project.title?.toLowerCase() || "";

        const description =
            project.description?.toLowerCase() || "";

        const category =
            project.category?.toLowerCase() || "";

        const developer =
            project.developer?.username?.toLowerCase() || "";

        const tags =
            project.tags
                ?.join(" ")
                .toLowerCase() || "";


        return (
            title.includes(search) ||
            description.includes(search) ||
            category.includes(search) ||
            developer.includes(search) ||
            tags.includes(search)
        );

    });

}


module.exports = {

    saveProject,
    getAllProjects,
    getProjectByUrl,
    removeProject,
    searchProjects

};
 
