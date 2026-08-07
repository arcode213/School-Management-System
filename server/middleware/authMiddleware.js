const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { effectivePermissions } = require('../config/permissions');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ message: 'Not authorized, user inactive' });
      }

      // Enforce campus / session scoping. contextMiddleware runs globally (before
      // this middleware) and only parses the headers, so the authoritative
      // user-based enforcement must happen here, once req.user exists. A scoped
      // account can never escape its campuses or sessions by sending a different
      // x-campus-id / x-session-id header — an out-of-scope value is not honoured,
      // it is replaced with the first one the account is actually allowed.
      req.allowedCampuses = req.user.role === 'Admin' ? [] : req.user.allowedCampusIds();
      req.allowedSessions = req.user.role === 'Admin' ? [] : req.user.allowedSessionIds();

      if (req.allowedCampuses.length > 0 &&
          (!req.currentCampus || !req.allowedCampuses.includes(req.currentCampus))) {
        req.currentCampus = req.allowedCampuses[0];
      }

      if (req.allowedSessions.length > 0 &&
          (!req.currentSession || !req.allowedSessions.includes(req.currentSession))) {
        req.currentSession = req.allowedSessions[0];
      }

      // The grid this request is judged against, resolved once here so every
      // downstream check and controller reads the same answer.
      //
      // This must come AFTER the campus clamp above: rights can differ per campus,
      // so the answer depends on which campus this request ended up working in.
      // Resolving it first would judge the request against the campus the client
      // asked for rather than the one it was actually allowed.
      req.permissions = effectivePermissions(req.user, req.currentCampus);

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Role-based access control. Still used for the few things that belong to the
// main admin alone — managing accounts and wiping data — where no amount of
// granted permission should substitute for being the Admin.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

/**
 * Permission-based access control: the per-account grid the Admin ticked.
 * Admin passes everything; anyone else needs the exact module/action.
 */
const requirePermission = (moduleKey, action = 'view') => {
  return (req, res, next) => {
    if (req.user?.role === 'Admin') return next();

    if (req.permissions?.[moduleKey]?.[action] === true) return next();

    return res.status(403).json({
      message: `You do not have permission to ${action} ${moduleKey}. Ask an administrator to grant it.`,
      module: moduleKey,
      action,
    });
  };
};

/**
 * Passes if ANY of the given [module, action] pairs is granted.
 *
 * Needed where one endpoint serves two screens: the challan list and the fee
 * ledger both read GET /api/fees, so an account granted only "Challans & Printing"
 * must still be able to load them.
 */
const requireAnyPermission = (...pairs) => {
  return (req, res, next) => {
    if (req.user?.role === 'Admin') return next();

    const ok = pairs.some(([m, a = 'view']) => req.permissions?.[m]?.[a] === true);
    if (ok) return next();

    const wanted = pairs.map(([m, a = 'view']) => `${a} ${m}`).join(' or ');
    return res.status(403).json({
      message: `You do not have permission to ${wanted}. Ask an administrator to grant it.`,
    });
  };
};

module.exports = { protect, authorize, requirePermission, requireAnyPermission };
