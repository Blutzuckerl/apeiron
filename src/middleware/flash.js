function flashMiddleware(req, res, next) {
  if (!req.session.flash) {
    req.session.flash = {};
  }

  req.flash = (type, message) => {
    req.session.flash[type] = req.session.flash[type] || [];
    req.session.flash[type].push(message);
  };

  res.locals.flash = req.session.flash;
  req.session.flash = {};
  next();
}

module.exports = { flashMiddleware };
