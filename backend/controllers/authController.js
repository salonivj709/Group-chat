const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (![name, email, phone, password].every(value => typeof value === "string" && value.trim())) {
      return res.status(400).json({ success: false, message: "Name, email, phone and password are required." });
    }
    if (name.trim().length < 2) return res.status(400).json({ success: false, message: "Name must contain at least 2 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    if (!/^[0-9]{10}$/.test(phone.trim())) return res.status(400).json({ success: false, message: "Phone number must contain exactly 10 digits." });
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must contain at least 8 characters." });

    const [existing] = await db.execute(
      "SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1",
      [email.trim().toLowerCase(), phone.trim()]
    );
    if (existing.length) return res.status(409).json({ success: false, message: "Email or phone number is already registered." });

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash]
    );
    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please log in.",
      user: { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase() }
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ success: false, message: "Unable to create account right now." });
  }
};



exports.login = async (req, res) => {
    try {
        const { identifier, email, password } = req.body;

        // Support both identifier and email
        const loginIdentifier = (identifier || email || "").trim();

        if (!loginIdentifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Email/phone and password are required."
            });
        }

        // Find user using email or phone
        const [users] = await db.execute(
            `SELECT id, name, email, phone, password_hash
             FROM users
             WHERE email = ? OR phone = ?
             LIMIT 1`,
            [
                loginIdentifier.toLowerCase(),
                loginIdentifier
            ]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email/phone or password."
            });
        }

        const user = users[0];

        // Compare entered password with bcrypt hash
        const isMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email/phone or password."
            });
        }

        // Generate JWT token
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing in environment variables.");
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

