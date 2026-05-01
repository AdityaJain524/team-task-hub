const userModel = require('../models/userModel');

exports.list = async (_req, res) => {
  const users = await userModel.listAll();
  res.json({ users });
};
