const { findUserById } = require('../db/repositories');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  if (!req.currentUser) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
    return;
  }
  return next();
}

function attachUser(req, _res, next) {
  if (!req.session.userId) {
    req.currentUser = null;
    return next();
  }

  const user = findUserById(req.session.userId);
  if (!user) {
    req.currentUser = null;
    return next();
  }

  if (req.session.sessionVersion && Number(req.session.sessionVersion) !== Number(user.session_version)) {
    req.currentUser = null;
    req.session.userId = null;
    return next();
  }

  req.currentUser = user;
  req.session.user = user;
  next();
}

module.exports = { requireAuth, attachUser };
