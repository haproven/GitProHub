 js
// GitProHub Project Model

function createProject(data) {

    return {

        // GitProHub metadata
        title: data.title || data.github?.name || "",
        description: data.description || data.github?.description || "",
        category: data.category || "Other",
        status: data.status || "Active",
        image: data.image || null,

        // Links
        live: data.live || "",
        demo: data.demo || "",
        documentation: data.documentation || "",

        // Discover
        tags: Array.isArray(data.tags)
            ? data.tags
            : [],

        featured: Boolean(data.featured),
        open_source: Boolean(data.open_source),

        // GitHub data
        github: {
            name: data.github?.name || "",
            url: data.github?.url || "",
            description: data.github?.description || "",
            stars: data.github?.stars || 0,
            forks: data.github?.forks || 0,
            language: data.github?.language || null,
            license: data.github?.license || null,
            created_at: data.github?.created_at || null,
            updated_at: data.github?.updated_at || null,
            default_branch: data.github?.default_branch || "main",
            topics: data.github?.topics || []
        },

        // Developer
        developer: {
            name: data.developer?.name || "",
            username: data.developer?.username || "",
            avatar: data.developer?.avatar || "",
            github: data.developer?.github || ""
        },

        // README
        readme: data.readme || null

    };

}


module.exports = {
    createProject
};
 
