const express = require('express');
const cors = require('cors');
const cfg = require('./config');

const authRoutes    = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes    = require('./routes/taskRoutes');
const userRoutes    = require('./routes/userRoutes');
const errorHandler  = require('./middleware/error');

const app = express();

app.use(cors({ origin: cfg.CORS_ORIGIN }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks',    taskRoutes);
app.use('/api/users',    userRoutes);

app.use(errorHandler);

app.listen(cfg.PORT, () => console.log(`API listening on http://localhost:${cfg.PORT}`));
