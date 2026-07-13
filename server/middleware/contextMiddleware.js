const contextMiddleware = (req, res, next) => {
  const campusId = req.headers['x-campus-id'];
  const sessionId = req.headers['x-session-id'];

  // NOTE: This middleware runs globally, before `protect` sets req.user, so it
  // can only parse the context headers. The authoritative per-user campus
  // enforcement (for Administrator/Staff) lives in `protect`, which overrides
  // req.currentCampus after the user is authenticated.
  if (campusId && campusId !== 'undefined' && campusId !== 'null') {
    req.currentCampus = campusId;
  }
  
  if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
    req.currentSession = sessionId;
  }

  next();
};

module.exports = { contextMiddleware };
