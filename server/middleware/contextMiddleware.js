const contextMiddleware = (req, res, next) => {
  let campusId = req.headers['x-campus-id'];
  const sessionId = req.headers['x-session-id'];

  // Enforce Campus for Administrator and Staff
  if (req.user && (req.user.role === 'Administrator' || req.user.role === 'Staff')) {
    if (req.user.campus) {
      campusId = req.user.campus.toString();
    }
  }

  if (campusId && campusId !== 'undefined' && campusId !== 'null') {
    req.currentCampus = campusId;
  }
  
  if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
    req.currentSession = sessionId;
  }

  next();
};

module.exports = { contextMiddleware };
