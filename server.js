import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dns from "dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // important for base64 images

// ======================== MongoDB Connection ===================
// Global variable to cache the connection in serverless environments
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        return;
    }
    try {
        const db = await mongoose.connect(process.env.MONGO_URI);
        isConnected = db.connections[0].readyState === 1;
        console.log("MongoDB Connected");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw error;
    }
};

// ========================= Schema ===========================
const postSchema = new mongoose.Schema({
    name: String,
    empID: String,
    phTitle: String,
    profileImage: String,   // base64 image
    image: String,   // base64 image
    comment: String,
    date: String,
}, { timestamps: true });

const Post = mongoose.model("Post", postSchema);

app.post("/api/posts", async (req, res) => {
    try {
        await connectDB(); // Ensure DB is connected before operation
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: "Image is required" });
        }
        const post = new Post(req.body);
        await post.save();
        res.status(201).json({ message: "Post saved", post });
    } catch (err) {
        console.error("POST /api/posts error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/", (req, res) => {
    res.status(200).json({ msg: 'API running...!' });
});

app.get("/api/posts", async (req, res) => {
    try {
        await connectDB(); // Ensure DB is connected before operation
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const total = await Post.countDocuments();
        const posts = await Post.find().sort({ _id: -1 }).skip(skip).limit(limit);
        
        res.json({ posts, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});

export default app;