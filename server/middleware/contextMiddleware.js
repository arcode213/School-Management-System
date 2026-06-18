const contextMiddleware = (req, res, next) => {
  const campusId = req.headers['x-campus-id'];
  const sessionId = req.headers['x-session-id'];

  if (campusId && campusId !== 'undefined' && campusId !== 'null') {
    req.currentCampus = campusId;
  }
  
  if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
    req.currentSession = sessionId;
  }

  next();
};

module.exports = { contextMiddleware };
