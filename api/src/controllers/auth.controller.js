import bcrypt from "bcryptjs";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../models/user.model.js";
import { signToken } from "../utils/jwt.js";

const SALT_ROUNDS = 10;

export async function signup(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "password must be at least 8 characters" });
    }

    const existing = await findUserByEmail(email.toLowerCase());
    if (existing) {
      return res
        .status(409)
        .json({ error: "an account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser({ email: email.toLowerCase(), passwordHash });
    const token = signToken({ sub: user.id, email: user.email });

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const token = signToken({ sub: user.id, email: user.email });
    res.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
