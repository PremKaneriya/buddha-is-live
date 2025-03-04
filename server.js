const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const shortid = require("shortid");

dotenv.config();
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Ensure MongoDB URI is provided
if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is missing! Add it in Railway environment variables.");
    process.exit(1);
}

// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    });

// Define Mongoose Schema & Model
const TunnelSchema = new mongoose.Schema({
    id: String,
    target: String,
});
const Tunnel = mongoose.model("Tunnel", TunnelSchema);

// Create a new tunnel
app.post("/create-tunnel", async (req, res) => {
    try {
        const { target } = req.body;
        if (!target) {
            return res.status(400).json({ error: "Target URL is required" });
        }

        const id = shortid.generate();
        const newTunnel = new Tunnel({ id, target });
        await newTunnel.save();

        res.json({ tunnelUrl: `${req.hostname}/${id}` });
    } catch (error) {
        console.error("❌ Error creating tunnel:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Proxy traffic to the target URL
app.use("/:id", async (req, res, next) => {
    try {
        const tunnel = await Tunnel.findOne({ id: req.params.id });

        if (!tunnel) {
            return res.status(404).json({ error: "Tunnel not found" });
        }

        console.log(`🔀 Proxying request to ${tunnel.target}`);

        const proxy = createProxyMiddleware({
            target: tunnel.target,
            changeOrigin: true,
            logLevel: "debug", // Enable logging for debugging
        });

        return proxy(req, res, next);
    } catch (error) {
        console.error("❌ Proxy Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
