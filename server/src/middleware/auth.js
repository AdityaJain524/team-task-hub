const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const cfg = require('../config');

/**
 * Sign a JWT for a user. Includes issuer/audience for stronger verification.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    cfg.JWT_SECRET,
    {
      expiresIn: cfg.JWT_EXPIRES_IN,
      issuer: cfg.JWT_ISSUER,
      audience: cfg.JWT_AUDIENCE,
    }
  );
}

/**
 * Verify a raw JWT string. Throws on invalid/expired.
 * Returns the decoded payload.
 */
function verifyToken(token) {
  return jwt.verify(token, cfg.JWT_SECRET, {
    issuer: cfg.JWT_ISSUER,
    audience: cfg.JWT_AUDIENCE,
  });
}

/**
 * Express middleware: requires a valid Bearer JWT.
 * Loads the user from DB and attaches to req.user. Also exposes req.tokenPayload.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }
    const token = header.slice(7).trim();
    if (!token) return res.status(401).json({ error: 'Empty token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      const reason =
        err.name === 'TokenExpiredError' ? 'Token expired' :
        err.name === 'JsonWebTokenError' ? 'Invalid token' :
        'Token verification failed';
      return res.status(401).json({ error: reason });
    }

    const user = await userModel.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    // Defense-in-depth: role in token must still match DB
    if (payload.role && payload.role !== user.role) {
      return res.status(401).json({ error: 'Role mismatch — please re-login' });
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, signToken, verifyToken };
