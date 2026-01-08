require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Resend } = require("resend");

const User = require("../models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// =======================
// RESEND
// =======================
const resend = new Resend(process.env.RESEND_API_KEY);

// =======================
// MIDDLEWARE
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "../public")));

// =======================
// HEALTH CHECK (RENDER)
// =======================
app.get("/health", (_, res) => res.send("OK"));

// =======================
// PAGES
// =======================
app.get("/", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/home.html"))
);

app.get("/create-account", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/register.html"))
);

app.get("/confirm", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/confirm.html"))
);

app.get("/PlayTheGame", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/PlayTheGame.html"))
);

app.get("/follow-us", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/follow.html"))
);

app.get("/about", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/about.html"))
);

app.get("/screenshots", (_, res) =>
    res.sendFile(path.join(__dirname, "../views/Screenshots.html"))
);

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// =======================
// MONGODB
// =======================
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("🟢 MongoDB connected"))
    .catch(err => console.error("🔴 MongoDB error:", err));

// =======================
// REGISTER
// =======================
app.post("/register", async (req, res) => {
    try {
        const { email, username, password, captcha } = req.body;

        if (!email || !username || !password || !captcha)
            return res.status(400).send("Missing fields");

        if (captcha !== "7")
            return res.status(400).send("Captcha failed");

        if (await User.findOne({ email }))
            return res.send("Email already exists");

        if (await User.findOne({ username }))
            return res.send("Username already exists");

        const hashedPassword = await bcrypt.hash(password, 10);
        const confirmCode = crypto.randomInt(100000, 999999).toString();

        await User.create({
            email,
            username,
            password: hashedPassword,
            confirmCode,
            confirmed: false
        });

        let emailSent = false;

        try {
            await resend.emails.send({
                from: "Silent Bay Studios <onboarding@resend.dev>", // sandbox
                to: email,
                subject: "Confirm your account",
                html: `
          <h2>Welcome to Escape From The Court</h2>
          <p>Your confirmation code:</p>
          <h1>${confirmCode}</h1>
        `
            });
            emailSent = true;
        } catch (mailErr) {
            console.warn("⚠️ EMAIL NOT SENT (sandbox):", mailErr.message);
        }

        console.log("🔐 CONFIRM CODE:", confirmCode);

        // 🔁 redirect + fallback
        res.send(`
      <h2>Account created</h2>
      ${emailSent
                ? "<p>Check your email for the confirmation code.</p>"
                : `<p><b>Email not delivered (sandbox).</b><br>Your confirmation code is:</p>
             <h1>${confirmCode}</h1>`
            }
      <a href="/confirm">Go to confirmation</a>
    `);

    } catch (err) {
        console.error("REGISTER ERROR:", err);
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

// =======================
// LOGIN (UNITY)
// =======================
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.json({ success: false, message: "Missing fields" });

        const user = await User.findOne({ username, confirmed: true });
        if (!user)
            return res.json({ success: false, message: "Invalid username" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.json({ success: false, message: "Wrong password" });

        res.json({ success: true, message: "Login successful" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
