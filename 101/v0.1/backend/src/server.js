const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
    res.send("GitProHub API is running 🚀");
});

app.listen(PORT, () => {
    console.log(`GitProHub Server running on http://localhost:${PORT}`);
});