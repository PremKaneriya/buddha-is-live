const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const shortid = require("shortid");

dotenv.config();
const app = express();
app.use(cors()); // Allow all origins
app.use(express.json());

if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is missing! Add it in Railway environment variables.");
    process.exit(1);
}

// ✅ MongoDB Connection
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

// ✅ Tunnel Schema
const TunnelSchema = new mongoose.Schema({
    id: String,
    target: String,
});
const Tunnel = mongoose.model("Tunnel", TunnelSchema);

// ✅ Create Tunnel
app.post("/create-tunnel", async (req, res) => {
    try {
        const { target } = req.body;
        if (!target) {
            return res.status(400).json({ error: "Target URL is required" });
        }

        const id = shortid.generate();
        const newTunnel = new Tunnel({ id, target });
        await newTunnel.save();

        // ✅ Fix URL construction
        const tunnelUrl = `https://${req.get("host")}/${id}`;
        res.json({ tunnelUrl });
    } catch (error) {
        console.error("❌ Error creating tunnel:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ✅ Proxy Requests with Better Debugging
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
            logLevel: "debug",
            timeout: 5000, // ✅ Timeout to prevent hanging requests
            onError: (err, req, res) => {
                console.error("❌ Proxy Error:", err.message);
                res.status(502).json({ error: "Bad Gateway - Proxy failed" });
            },
        });

        return proxy(req, res, next);
    } catch (error) {
        console.error("❌ Proxy Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Start Server on Railway
const PORT = process.env.PORT || 3000;
console.log("Listening on:", process.env.PORT);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
