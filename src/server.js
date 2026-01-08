require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// =======================
// MIDDLEWARE
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "../public")));

// =======================
// HEALTH CHECK (FONDAMENTALE PER RENDER)
// =======================
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// =======================
// ROUTES (PAGES)
// =======================
app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/home.html"))
);

app.get("/create-account", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/register.html"))
);

app.get("/PlayTheGame", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/PlayTheGame.html"))
);

app.get("/follow-us", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/follow.html"))
);

app.get("/about", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/about.html"))
);

app.get("/screenshots", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/Screenshots.html"))
);

app.get("/confirm", (req, res) =>
    res.sendFile(path.join(__dirname, "../views/confirm.html"))
);

// =======================
// START SERVER (PRIMA DI TUTTO)
// =======================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// =======================
// MONGODB (DOPO LO START)
// =======================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("🟢 MongoDB connected"))
    .catch(err => console.error("🔴 MongoDB error:", err));

// =======================
// EMAIL (SENZA verify)
// =======================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// =======================
// REGISTER
// =======================
app.post("/register", async (req, res) => {
    try {
        const { email, username, password, captcha } = req.body;

        if (!email || !username || !password || !captcha) {
            return res.send("Missing fields");
        }

        if (captcha !== "7") {
            return res.send("Captcha failed");
        }

        const emailExists = await User.findOne({ email });
        if (emailExists) return res.send("Email already exists");

        const usernameExists = await User.findOne({ username });
        if (usernameExists) return res.send("Username already exists");

        const hashedPassword = await bcrypt.hash(password, 10);
        const confirmCode = crypto.randomInt(100000, 999999).toString();

        await User.create({
            email,
            username,
            password: hashedPassword,
            confirmCode,
            confirmed: false
        });

        await transporter.sendMail({
            from: `Silent Bay Studios <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Confirm your account",
            html: `
                <h2>Welcome to Escape From The Court</h2>
                <p>Your confirmation code:</p>
                <h1>${confirmCode}</h1>
            `
        });

        res.send(`
            <h2>Account created</h2>
            <p>Check your email for the confirmation code.</p>
            <a href="/confirm">Confirm account</a>
        `);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// =======================
// CONFIRM ACCOUNT
// =======================
app.post("/confirm", async (req, res) => {
    try {
        const { email, code } = req.body;

        const user = await User.findOne({ email, confirmCode: code });
        if (!user) return res.send("Invalid confirmation code");

        user.confirmed = true;
        user.confirmCode = null;
        await user.save();

        res.send(`
            <h2>Account confirmed successfully!</h2>
            <a href="/">Go Home</a>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
