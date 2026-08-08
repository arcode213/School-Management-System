const mongoose = require('mongoose');

/**
 * Running a unit of work in a transaction where the deployment supports one.
 *
 * MongoDB only offers multi-document transactions on a replica set or a sharded
 * cluster. Production points at Atlas (a replica set), so the accounts module can
 * rely on them — but `.env` also carries a standalone `mongodb://127.0.0.1` URI
 * for local work, and starting a session against a standalone throws
 * "Transaction numbers are only allowed on a replica set member or mongos".
 *
 * Rather than make every caller handle that, this helper asks the server once
 * what it is and then either runs the work in a real transaction or runs it
 * as-is. The caller writes one code path; the guarantee is simply weaker on a
 * standalone dev box, which is the correct trade — the alternative is a module
 * that cannot be developed locally.
 *
 * Usage:
 *   await withTransaction(async (session) => {
 *     await doc.save(sessionOpts(session));
 *     await Other.create([payload], sessionOpts(session));
 *   });
 */

// Memoised per process. A serverless instance keeps this for its lifetime, which
// is what we want — it is a property of the deployment, not of the request.
let supported = null;

const supportsTransactions = async () => {
  if (supported !== null) return supported;

  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    // `setName` is present on a replica set member; `isdbgrid` identifies mongos.
    supported = Boolean(info.setName) || info.msg === 'isdbgrid';
  } catch (err) {
    // If we cannot tell, assume not — a sequential write that succeeds beats a
    // transaction that throws on every call.
    supported = false;
  }

  if (!supported) {
    console.warn(
      '[transaction] This MongoDB deployment is a standalone, so multi-document ' +
      'transactions are unavailable. Financial writes will run sequentially.'
    );
  }

  return supported;
};

/** Spread into a Mongoose write call: `doc.save(sessionOpts(session))`. */
const sessionOpts = (session) => (session ? { session } : {});

const withTransaction = async (fn) => {
  if (!(await supportsTransactions())) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    // withTransaction retries on transient errors and commits for us.
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction, sessionOpts, supportsTransactions };
