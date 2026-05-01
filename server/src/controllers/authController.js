const bcrypt = require('bcryptjs');
const { z } = require('zod');
const userModel = require('../models/userModel');
const { signToken, verifyToken } = require('../middleware/auth');

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  fullName: z.string().min(2).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  token: z.string().min(10),
});

exports.schemas = { signupSchema, loginSchema, verifySchema };

exports.signup = async (req, res) => {
  const { email, password, fullName } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const count = await userModel.countAll();
  const role = count === 0 ? 'admin' : 'member';

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userModel.create({ email, passwordHash, fullName, role });

  res.status(201).json({ user, token: signToken(user) });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const safe = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
  res.json({ user: safe, token: signToken(safe) });
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};
