// =========================================================
// GitProHub Markdown Parser
// =========================================================

function cleanValue(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .trim()
        .replace(/^["']|["']$/g, "");
}


// =========================================================
// Parse GitProHub
// =========================================================

function parseGitProHub(content) {

    if (!content) {
        return {
            title: "",
            description: "",
            category: "",
            status: "",
            developer: "",
            live: "",
            github: "",
            image: "",
            tags: []
        };
    }


    const metadata = {
        title: "",
        description: "",
        category: "",
        status: "",
        developer: "",
        live: "",
        github: "",
        image: "",
        tags: []
    };


    const lines =
        content.split(/\r?\n/);


    // =====================================================
    // YAML Front Matter
    // =====================================================

    let frontMatter = {};

    if (
        lines[0] &&
        lines[0].trim() === "---"
    ) {

        let endIndex = -1;

        for (
            let i = 1;
            i < lines.length;
            i++
        ) {

            if (
                lines[i].trim() === "---"
            ) {
                endIndex = i;
                break;
            }

        }


        if (endIndex !== -1) {

            for (
                let i = 1;
                i < endIndex;
                i++
            ) {

                const line =
                    lines[i];

                const match =
                    line.match(
                        /^([^:#]+):\s*(.*)$/
                    );

                if (!match) {
                    continue;
                }


                const key =
                    match[1]
                        .trim()
                        .toLowerCase();


                const value =
                    cleanValue(
                        match[2]
                    );


                frontMatter[key] =
                    value;

            }

        }

    }


    // =====================================================
    // Helper
    // =====================================================

    function findField(names) {

        // First check YAML front matter

        for (const name of names) {

            if (
                frontMatter[name] !== undefined &&
                frontMatter[name] !== ""
            ) {

                return cleanValue(
                    frontMatter[name]
                );

            }

        }


        // Then check normal GitProHub markdown fields

        for (const line of lines) {

            const match =
                line.match(
                    /^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/
                );

            if (!match) {
                continue;
            }


            const key =
                match[1]
                    .trim()
                    .toLowerCase();


            if (
                names.includes(key)
            ) {

                return cleanValue(
                    match[2]
                );

            }

        }


        return "";

    }


    // =====================================================
    // Basic Fields
    // =====================================================

    metadata.title =
        findField([
            "title",
            "name",
            "project"
        ]);


    metadata.description =
        findField([
            "description",
            "desc",
            "about"
        ]);


    metadata.category =
        findField([
            "category",
            "type"
        ]);


    metadata.status =
        findField([
            "status"
        ]);


    metadata.developer =
        findField([
            "developer",
            "author",
            "owner"
        ]);


    metadata.live =
        findField([
            "live",
            "live_url",
            "website",
            "demo"
        ]);


    metadata.github =
        findField([
            "github",
            "github_url",
            "repository"
        ]);


    // =====================================================
    // Image
    // =====================================================

    metadata.image =
        findField([
            "image",
            "image_url",
            "thumbnail"
        ]);


    // =====================================================
    // Tags
    // =====================================================

    const tags =
        findField([
            "tags",
            "tag"
        ]);


    if (tags) {

        metadata.tags =
            tags
                .replace(/^\[/, "")
                .replace(/\]$/, "")
                .split(",")
                .map(
                    tag =>
                        tag
                            .trim()
                            .replace(
                                /^["']|["']$/g,
                                ""
                            )
                )
                .filter(Boolean);

    }


    // =====================================================
    // Markdown Heading Fallback
    // =====================================================

    if (!metadata.title) {

        const heading =
            content.match(
                /^#\s+(.+)$/m
            );


        if (heading) {

            metadata.title =
                heading[1].trim();

        }

    }


    // =====================================================
    // Description Fallback
    // =====================================================

    if (!metadata.description) {

        const description =
            content
                .replace(
                    /^---[\s\S]*?---/,
                    ""
                )
                .split(/\r?\n/)
                .map(
                    line =>
                        line.trim()
                )
                .filter(
                    line =>
                        line &&
                        !line.startsWith("#") &&
                        !line.startsWith("!")
                )
                .slice(0, 2)
                .join(" ");


        metadata.description =
            description;

    }


    // =====================================================
    // Return
    // =====================================================

    return metadata;

}


// =========================================================
// Export
// =========================================================

module.exports = {
    parseGitProHub
};