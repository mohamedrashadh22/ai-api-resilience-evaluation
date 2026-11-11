const app = require("./app");

const PORT = process.env.MOCK_MODEL_PORT || 4001;

app.listen(PORT, () => {
    console.log(`Mock AI Model Service running on http://localhost:${PORT}`);
});