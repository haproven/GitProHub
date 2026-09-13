function parseGitProHub(content) {

    const data = {};

    const lines = content.split("\n");

    for (const line of lines) {

        const match = line.match(/^([\w-]+):\s*(.*)$/);

        if (!match) {
            continue;
        }

        const key = match[1].trim();
        let value = match[2].trim();


        // Tags → Array
        if (key === "tags") {

            value = value
                ? value
                    .split(",")
                    .map(tag => tag.trim())
                    .filter(Boolean)
                : [];

        }


        // Boolean values
        if (key === "featured" || key === "open_source") {

            value = value.toLowerCase() === "true";

        }


        data[key] = value;
    }


    return data;
}


module.exports = {
    parseGitProHub
};
 

// Iske baad **server.js change nahi karna hai**. `npm start` karke `/github-project/haproven/HaproID` test karo.
