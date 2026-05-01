const { z } = require('zod');
const taskModel = require('../models/taskModel');
const projectModel = require('../models/projectModel');

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
});

const statusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']),
});

exports.schemas = { createSchema, updateSchema, statusSchema };

exports.listByProject = async (req, res) => {
  if (req.params.projectId === 'all') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const tasks = await taskModel.listAll();
    return res.json({ tasks });
  }
  const project = await projectModel.findById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'admin') {
    const member = await projectModel.isMember(project.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });
  }
  const tasks = await taskModel.listForProject(project.id);
  res.json({ tasks });
};

exports.myTasks = async (req, res) => {
  const tasks = await taskModel.listForUser(req.user.id);
  res.json({ tasks });
};

exports.create = async (req, res) => {
  const task = await taskModel.create({
    projectId: req.body.projectId,
    title: req.body.title,
    description: req.body.description ?? null,
    deadline: req.body.deadline ?? null,
    assignedTo: req.body.assignedTo ?? null,
    priority: req.body.priority ?? 'medium',
    createdBy: req.user.id,
  });
  res.status(201).json({ task });
};

exports.update = async (req, res) => {
  const task = await taskModel.update(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
};

exports.updateStatus = async (req, res) => {
  const existing = await taskModel.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'admin' && existing.assigned_to !== req.user.id) {
    return res.status(403).json({ error: 'Only the assignee or an admin can update status' });
  }
  const task = await taskModel.updateStatus(req.params.id, req.body.status);
  res.json({ task });
};

exports.remove = async (req, res) => {
  await taskModel.remove(req.params.id);
  res.status(204).end();
};

exports.dashboard = async (req, res) => {
  const stats = await taskModel.dashboardStats({
    userId: req.user.id,
    isAdmin: req.user.role === 'admin',
  });
  res.json({ stats });
};
