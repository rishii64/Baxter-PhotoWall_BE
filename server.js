import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dns from "dns";
import upload from "./multer.js";
import { uploadToS3 } from "./aws/s3.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50kb" }));  // Reduced since no more Base64

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
    profileImageUrl: String,  // S3 URL instead of Base64
    imageUrl: String,         // S3 URL instead of Base64
    comment: String,
    date: String,
}, { timestamps: true });

const Post = mongoose.model("Post", postSchema);

// ========================= Routes ===========================
app.post("/api/posts", upload.fields([
    { name: "image", maxCount: 1 },
    { name: "profileImage", maxCount: 1 }
]), async (req, res) => {
    try {
        await connectDB();

        // Log for debugging
        console.log("req.files:", req.files);
        console.log("req.body:", req.body);

        // Validate required fields
        if (!req.body.name || !req.body.empID || !req.body.phTitle) {
            return res.status(400).json({
                error: "Name, Employee ID, and Photo Title are required"
            });
        }

        if (!req.files?.image || req.files.image.length === 0) {
            return res.status(400).json({
                error: "Main image is required"
            });
        }

        // Upload files to S3
        let imageUrl = null;
        let profileImageUrl = null;

        try {
            imageUrl = await uploadToS3(req.files.image[0], "cargillPosts");
            if (req.files.profileImage?.[0]) {
                profileImageUrl = await uploadToS3(req.files.profileImage[0], "profiles");
            }
        } catch (uploadError) {
            console.error("S3 upload error:", uploadError);
            return res.status(500).json({
                error: "Failed to upload image to storage: " + uploadError.message
            });
        }

        // Create and save post
        const post = new Post({
            name: req.body.name.trim(),
            empID: req.body.empID.trim(),
            phTitle: req.body.phTitle.trim(),
            comment: req.body.comment?.trim() || "No comment provided.",
            date: req.body.date,
            imageUrl,
            profileImageUrl
        });

        await post.save();

        res.status(201).json({
            message: "Post created successfully",
            post
        });
    } catch (err) {
        console.error("POST /api/posts error:", err);
        res.status(500).json({
            error: err.message || "Internal server error"
        });
    }
});

app.get("/", (req, res) => {
    res.status(200).json({ msg: 'API running...!' });
});

// GET: Retrieve posts with pagination
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
        console.error("GET /api/posts error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// Global error handler for multer (must be last)
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "File size too large (max 5MB)" });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: "Too many files" });
    }
    if (err.message.includes("Only image files")) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});

export default app;