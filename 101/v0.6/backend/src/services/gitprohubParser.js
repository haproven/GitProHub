function parseGitProHub(content) {
    const data = {};

    const lines = content.split("\n");

    for (const line of lines) {
        const match = line.match(/^([\w-]+):\s*(.*)$/);

        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();

            data[key] = value;
        }
    }

    return data;
}

module.exports = {
    parseGitProHub
};