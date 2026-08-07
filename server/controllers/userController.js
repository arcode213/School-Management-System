const mongoose = require('mongoose');
const User = require('../models/User');
const {
  MODULES,
  ACTIONS,
  sanitizePermissions,
  sanitizeCampusPermissions,
  defaultPermissionsForRole,
  basePermissions,
} = require('../config/permissions');

const SUPER_ADMIN_EMAIL = 'admin@school.com';

// Keep only well-formed ObjectIds — the scope lists come straight from checkbox
// values, and one stale id should not make the whole save fail.
const toIdList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(id => id && mongoose.Types.ObjectId.isValid(id))
    .map(id => id.toString());
};

// What the client needs to render an account row and the permission editor.
const shapeUser = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  obj.permissions = basePermissions(userDoc);
  obj.campusPermissions = userDoc.campusPermissions || {};
  obj.campusScope = (userDoc.campusScope || []).map(c => (c._id ? c._id.toString() : c.toString()));
  obj.sessionScope = (userDoc.sessionScope || []).map(s => (s._id ? s._id.toString() : s.toString()));
  return obj;
};

// @desc    The module/action catalogue the permission checkboxes are built from
// @route   GET /api/users/permission-catalog
// @access  Private/Admin
const getPermissionCatalog = async (req, res) => {
  res.json({
    actions: ACTIONS,
    modules: MODULES,
    roleDefaults: {
      Admin: defaultPermissionsForRole('Admin'),
      Administrator: defaultPermissionsForRole('Administrator'),
      Staff: defaultPermissionsForRole('Staff'),
    },
  });
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .populate('campus', 'name')
      .populate('campusScope', 'name')
      .populate('sessionScope', 'name')
      .select('-password')
      .sort({ createdAt: -1 });

    // Send the resolved grid, not the raw field: accounts that predate permissions
    // have none stored, and the editor should open showing what they can actually
    // do today rather than an empty grid.
    res.json(users.map(u => {
      const obj = u.toObject();
      delete obj.password;
      obj.permissions = basePermissions(u);
      obj.campusPermissions = u.campusPermissions || {};
      obj.hasCustomPermissions = !!u.permissions;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const {
      name, email, password, role, campus, isActive,
      permissions, campusPermissions, campusScope, sessionScope,
    } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const campuses = toIdList(campusScope);

    const user = await User.create({
      name,
      email,
      password,
      role,
      // The home campus doubles as the default the client lands on; fall back to
      // the first campus the account is scoped to.
      campus: campus || campuses[0] || null,
      campusScope: campuses,
      sessionScope: toIdList(sessionScope),
      // The Admin role is unrestricted by definition, so storing a grid for it
      // would only be misleading.
      permissions: role === 'Admin' ? undefined : sanitizePermissions(permissions),
      // Per-campus overrides are kept only for campuses this account actually
      // works at, so tightening the scope cannot leave a stale grid behind.
      campusPermissions: role === 'Admin' ? undefined : sanitizeCampusPermissions(campusPermissions, campuses),
      isActive,
    });

    res.status(201).json(shapeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const {
      name, email, role, campus, isActive, password,
      permissions, campusPermissions, campusScope, sessionScope,
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // The school must never be able to lock itself out of its own system.
    if (user.email === SUPER_ADMIN_EMAIL) {
      if (role && role !== 'Admin') {
        return res.status(400).json({ message: 'The main admin account must keep the Admin role' });
      }
      if (isActive === false) {
        return res.status(400).json({ message: 'The main admin account cannot be deactivated' });
      }
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    if (isActive !== undefined) user.isActive = isActive;

    if (campusScope !== undefined) user.campusScope = toIdList(campusScope);
    if (sessionScope !== undefined) user.sessionScope = toIdList(sessionScope);

    // An explicit empty value clears the home campus (back to "all campuses"),
    // which `campus || user.campus` could never express.
    if (campus !== undefined) {
      user.campus = campus || user.campusScope[0] || null;
    } else if (user.campus && user.campusScope.length > 0 &&
               !user.campusScope.some(id => id.toString() === user.campus.toString())) {
      // The home campus was just scoped out from under the account.
      user.campus = user.campusScope[0];
    }

    if (user.role === 'Admin') {
      user.permissions = undefined;
      user.campusPermissions = undefined;
      user.markModified('permissions');
      user.markModified('campusPermissions');
    } else {
      if (permissions !== undefined) {
        user.permissions = sanitizePermissions(permissions);
      } else if (!user.permissions) {
        // First save of an account that predates the grid: freeze in what its role
        // used to allow, so a later catalogue change cannot silently widen it.
        user.permissions = defaultPermissionsForRole(user.role);
      }
      user.markModified('permissions'); // Mixed paths are not change-tracked

      if (campusPermissions !== undefined) {
        // Scoped to the campuses saved on this same request, not the ones the
        // account had before it — an override for a campus just removed from the
        // scope is dropped rather than left waiting.
        const allowed = user.campusScope.map(id => id.toString());
        user.campusPermissions = sanitizeCampusPermissions(campusPermissions, allowed);
        user.markModified('campusPermissions');
      }
    }

    if (password) {
      user.password = password;
    }

    const updatedUser = await user.save();
    res.json(shapeUser(updatedUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting the super admin
    if (user.email === SUPER_ADMIN_EMAIL) {
      return res.status(400).json({ message: 'Cannot delete super admin' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    await user.deleteOne();
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, getPermissionCatalog };
