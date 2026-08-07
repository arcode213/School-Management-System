const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const {
  describeRoute, ACTION_BY_METHOD, labelFor, diffDocs, safeSnapshot, buildDescription,
} = require('../utils/audit');

/**
 * Records every action taken through the API.
 *
 * Mounted once, globally, ahead of the routes. It reads the record before the
 * handler runs and again after the response is sent, and the difference is what
 * gets logged — so the log covers endpoints nobody remembered to instrument,
 * including ones added later.
 *
 * Two rules this must never break:
 *   1. It must never fail a request. Everything is wrapped, and the write happens
 *      after the response has already gone out. A broken logger loses the log,
 *      not the fee payment.
 *   2. It must never persist a credential. Passwords are stripped from snapshots
 *      and diffs, and auth requests never contribute their body at all.
 */

// Reads change nothing, and logging every list refresh would bury the actions
// that matter under thousands of rows. Denials are the exception: an attempt to
// reach something you are not allowed is worth keeping whatever the method.
const isMutation = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

const modelFor = (name) => {
  if (!name) return null;
  try {
    return mongoose.model(name);
  } catch {
    return null; // model not registered — log without a diff rather than throw
  }
};

const loadDoc = async (modelName, id) => {
  if (!id) return null;
  const Model = modelFor(modelName);
  if (!Model) return null;
  try {
    const doc = await Model.findById(id).lean();
    return doc || null;
  } catch {
    return null;
  }
};

const auditMiddleware = async (req, res, next) => {
  const route = describeRoute(req.path);
  const mutation = isMutation(req.method);

  // Nothing here concerns a plain read of an unmatched route.
  if (!route && !mutation) return next();

  // Read the record as it stands now, before the handler touches it. Only for
  // updates and deletes — a create has nothing to compare against — and only for
  // a caller presenting credentials, so an unauthenticated prod at the API costs
  // a rejection rather than a database read.
  let before = null;
  if (route?.model && route.entityId && req.headers.authorization &&
      ['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    before = await loadDoc(route.model, route.entityId);
  }

  // Capture the response body so a create can be logged with the record it made.
  let body;
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    body = payload;
    return originalJson(payload);
  };

  res.on('finish', () => {
    // Fire and forget: the response has already been sent, so nothing the logger
    // does from here can affect what the user saw.
    writeEntry({ req, res, route, before, body }).catch(err => {
      console.error('[audit] failed to write log entry:', err.message);
    });
  });

  next();
};

const writeEntry = async ({ req, res, route, before, body }) => {
  const status = res.statusCode;
  const denied = status === 401 || status === 403;
  const mutation = isMutation(req.method);

  // Successful reads are not events. Denials always are.
  if (!mutation && !denied) return;
  if (!route && !denied) return;

  const actor = req.user;

  // --- sign-in attempts --------------------------------------------------
  // Handled apart from everything else: the request body holds a password, so
  // it contributes nothing but the email, and on failure there is no req.user.
  if (route?.auth) {
    const ok = status >= 200 && status < 300;
    await AuditLog.create({
      user: ok ? body?._id || null : null,
      userName: ok ? body?.name || 'Unknown' : (req.body?.email || 'Unknown'),
      userEmail: (ok ? body?.email : req.body?.email) || '',
      userRole: ok ? body?.role || '' : '',
      action: ok ? 'login' : 'login-failed',
      module: 'auth',
      entity: 'Session',
      description: buildDescription({ action: ok ? 'login' : 'login-failed' }),
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: status,
      success: ok,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });
    return;
  }

  // An unauthenticated caller poking at the API is noise, not an audit trail —
  // there is nobody to attribute it to.
  if (!actor) return;

  const action = denied
    ? 'denied'
    : route?.action || ACTION_BY_METHOD[req.method] || 'other';

  // Read the record back to see what the handler actually did to it.
  let after = null;
  if (route?.model && !denied) {
    const id = route.entityId || body?._id || body?.data?._id;
    if (id) after = await loadDoc(route.model, id);
  }

  const success = status >= 200 && status < 300;
  const entity = route?.entity || '';
  const entityLabel = labelFor(entity, after || before || body);

  let changes = [];
  let snapshot;

  if (success && !denied) {
    if (action === 'delete') {
      // What matters about a deletion is the record that is now gone, so keep it
      // whole. Most deletes here are soft, which means diffing before against
      // after would produce "isDeleted: false → true" — accurate, and no use at
      // all to someone asking what was in the record that disappeared.
      snapshot = safeSnapshot(before || after);
    } else if (before && after) {
      changes = diffDocs(before, after);
    } else if (after) {
      snapshot = safeSnapshot(after);       // created record
    } else if (before) {
      snapshot = safeSnapshot(before);
    }
  }

  await AuditLog.create({
    user: actor._id,
    userName: actor.name,
    userEmail: actor.email,
    userRole: actor.role,

    action: denied ? 'denied' : action,
    module: route?.module || 'other',
    entity,
    entityId: mongoose.Types.ObjectId.isValid(route?.entityId || '') ? route.entityId : (after?._id || null),
    entityLabel,
    description: buildDescription({
      route,
      action: denied ? (ACTION_BY_METHOD[req.method] || 'open') : action,
      entity,
      entityLabel,
      changes,
      denied,
      failed: !success && !denied,
      // Bulk endpoints report their own counts; that beats anything this file
      // could infer about how many records were touched.
      summary: typeof body?.message === 'string' ? body.message : null,
    }),
    changes,
    snapshot,

    campus: mongoose.Types.ObjectId.isValid(req.currentCampus || '') ? req.currentCampus : null,
    academicSession: mongoose.Types.ObjectId.isValid(req.currentSession || '') ? req.currentSession : null,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    statusCode: status,
    success: success && !denied,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
    userAgent: req.headers['user-agent'] || '',
  });
};

module.exports = { auditMiddleware };
