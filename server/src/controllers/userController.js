const bcrypt = require('bcryptjs');
const { z } = require('zod');
const userModel = require('../models/userModel');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(['admin', 'member']),
});

exports.schemas = { createUserSchema };

exports.list = async (_req, res) => {
  const users = await userModel.listAll();
  res.json({ users });
};

exports.create = async (req, res) => {
  const { email, password, fullName, role } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userModel.create({ email, passwordHash, fullName, role });

  res.status(201).json({ user });
};

exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = await userModel.updateRole(id, role);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
};
