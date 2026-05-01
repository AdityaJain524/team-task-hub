const { z } = require('zod');
const projectModel = require('../models/projectModel');
const userModel = require('../models/userModel');

const projectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
});

const memberSchema = z.object({
  userId: z.string().uuid(),
});

exports.schemas = { projectSchema, memberSchema };

exports.list = async (req, res) => {
  const items = req.user.role === 'admin'
    ? await projectModel.listForAdmin()
    : await projectModel.listForMember(req.user.id);
  res.json({ projects: items });
};

exports.get = async (req, res) => {
  const project = await projectModel.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.user.role !== 'admin') {
    const member = await projectModel.isMember(project.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ project });
};

exports.create = async (req, res) => {
  const project = await projectModel.create({
    name: req.body.name,
    description: req.body.description ?? null,
    createdBy: req.user.id,
  });
  res.status(201).json({ project });
};

exports.update = async (req, res) => {
  const project = await projectModel.update(req.params.id, {
    name: req.body.name,
    description: req.body.description ?? null,
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
};

exports.remove = async (req, res) => {
  await projectModel.remove(req.params.id);
  res.status(204).end();
};

exports.listMembers = async (req, res) => {
  const project = await projectModel.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'admin') {
    const member = await projectModel.isMember(project.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });
  }
  const members = await projectModel.listMembers(project.id);
  res.json({ members });
};

exports.addMember = async (req, res) => {
  const project = await projectModel.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const user = await userModel.findById(req.body.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await projectModel.addMember(project.id, user.id);
  res.status(201).json({ ok: true });
};

exports.removeMember = async (req, res) => {
  await projectModel.removeMember(req.params.id, req.params.userId);
  res.status(204).end();
};
