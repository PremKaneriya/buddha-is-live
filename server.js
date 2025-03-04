const express = require("express");
const { createProxyMiddleware } = require("http-proxy");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const shortid = require("shortid");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const TunnelSchema = new mongoose.Schema({
    id: String,
    target: String,
});
const Tunnel = mongoose.model("Tunnel", TunnelSchema);

// Create a new tunnel
app.post("/create-tunnel", async (req, res) => {
    const { target } = req.body;
    const id = shortid.generate();
    const newTunnel = new Tunnel({ id, target });
    await newTunnel.save();
    res.json({ tunnelUrl: `${req.hostname}/${id}` });
});

// Proxy traffic to the target URL
app.use("/:id", async (req, res, next) => {
    const tunnel = await Tunnel.findOne({ id: req.params.id });
    if (!tunnel) return res.status(404).send("Tunnel not found");
    createProxyMiddleware({ target: tunnel.target, changeOrigin: true })(req, res, next);
});

app.listen(3000, () => console.log("Tunnel server running on port 3000"));
