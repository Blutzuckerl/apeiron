const express = require('express');
const {
  createUser,
  findUserByLogin,
  findUserById,
  validatePassword,
  usernameExists,
  emailExists,
  createResetToken,
  findValidResetToken,
  useResetTokenAndUpdatePassword
} = require('../db/repositories');
const { createRateLimiter } = require('../middleware/rateLimit');
const { markDisconnected } = require('../services/presence');

const router = express.Router();

const loginRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyFn: (req) => `login:${req.ip}`
});

function computeAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) {
    return -1;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/app/home');
  }
  return res.render('pages/login', {
    title: 'Login',
    currentUser: null,
    formValues: {},
    loginError: ''
  });
});

router.post('/login', loginRateLimit, (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  const remember = req.body.remember === 'on';

  if (!identifier || !password) {
    return res.status(400).render('pages/login', {
      title: 'Login',
      currentUser: null,
      flash: {
        error: ['Bitte Email/Username und Passwort eingeben.']
      },
      formValues: {
        identifier,
        password,
        remember
      },
      loginError: 'Bitte Email/Username und Passwort eingeben.'
    });
  }

  const user = findUserByLogin(identifier);

  if (!user || !validatePassword(password, user.password_hash)) {
    return res.status(401).render('pages/login', {
      title: 'Login',
      currentUser: null,
      flash: {
        error: ['Falsches Passwort oder unbekannter Account.']
      },
      formValues: {
        identifier,
        password,
        remember
      },
      loginError: 'Falsches Passwort oder unbekannter Account.'
    });
  }

  if (user.is_locked) {
    return res.status(423).render('pages/login', {
      title: 'Login',
      currentUser: null,
      flash: {
        error: ['Account ist gesperrt. Bitte Support kontaktieren.']
      },
      formValues: {
        identifier,
        password,
        remember
      },
      loginError: 'Account ist gesperrt. Bitte Support kontaktieren.'
    });
  }

  req.session.userId = user.id;
  req.session.user = findUserById(user.id);
  req.session.sessionVersion = user.session_version;

  if (!remember) {
    req.session.cookie.maxAge = 1000 * 60 * 60 * 8;
  } else {
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 14;
  }

  return res.redirect('/app/home');
});

router.get('/register', (_req, res) => {
  return res.render('pages/register', {
    title: 'Registrierung',
    currentUser: null,
    formValues: {},
    registerPasswordError: ''
  });
});

router.post('/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const username = String(req.body.username || '').trim().replace(/^@/, '').toLowerCase();
  const displayName = String(req.body.displayName || '').trim();
  const password = String(req.body.password || '');
  const dateOfBirth = String(req.body.dateOfBirth || '');
  const acceptedPolicy = req.body.acceptPolicy === 'on';

  const errors = [];
  if (!email || !username || !displayName || !password || !dateOfBirth) {
    errors.push('Alle Felder sind Pflicht.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Bitte eine gültige Email eingeben.');
  }
  if (password.length < 8 || !/[A-Z]/i.test(password) || !/\d/.test(password)) {
    errors.push('Unzulässiges Passwort: mind. 8 Zeichen und mindestens 1 Zahl.');
  }
  if (computeAge(dateOfBirth) < 16) {
    errors.push('Zu jung: Registrierung erst ab 16 Jahren.');
  }
  if (usernameExists(username)) {
    errors.push('Username bereits vergeben.');
  }
  if (emailExists(email)) {
    errors.push('Email bereits registriert.');
  }
  if (!acceptedPolicy) {
    errors.push('Bitte Policy und Alterscheck bestätigen.');
  }

  if (errors.length > 0) {
    const passwordError = errors.find((message) => message.toLowerCase().includes('passwort')) || '';
    return res.status(400).render('pages/register', {
      title: 'Registrierung',
      currentUser: null,
      flash: {
        error: errors
      },
      formValues: {
        email,
        username,
        displayName,
        dateOfBirth,
        acceptPolicy: acceptedPolicy,
        password
      },
      registerPasswordError: passwordError
    });
  }

  const userId = createUser({ email, username, displayName, password, dateOfBirth });
  req.session.userId = userId;
  const createdUser = findUserById(userId);
  req.session.user = createdUser;
  req.session.sessionVersion = createdUser.session_version;

  return res.redirect('/app/home');
});

router.get('/forgot-password', (_req, res) => {
  return res.render('pages/forgot-password', { title: 'Passwort vergessen', currentUser: null });
});

router.post('/forgot-password', (req, res) => {
  const identifier = String(req.body.identifier || '').trim().toLowerCase();
  const user = findUserByLogin(identifier);

  if (!user) {
    req.flash('success', 'Wenn der Account existiert, wurde ein Reset-Link erstellt.');
    return res.redirect('/forgot-password');
  }

  const token = createResetToken(user.id);
  req.flash('success', 'Reset-Link generiert.');
  req.flash('info', `Dev-Link: /reset-password/${token}`);
  return res.redirect('/forgot-password');
});

router.get('/reset-password/:token', (req, res) => {
  const token = req.params.token;
  const resetRecord = findValidResetToken(token);
  if (!resetRecord) {
    return res.status(400).render('pages/error', {
      title: 'Reset ungültig',
      code: 400,
      message: 'Der Reset-Link ist ungültig oder abgelaufen.',
      currentUser: null
    });
  }

  return res.render('pages/reset-password', {
    title: 'Passwort zurücksetzen',
    currentUser: null,
    token
  });
});

router.post('/reset-password/:token', (req, res) => {
  const token = req.params.token;
  const password = String(req.body.password || '');

  if (password.length < 8 || !/\d/.test(password)) {
    req.flash('error', 'Neues Passwort ist zu schwach (mind. 8 Zeichen + 1 Zahl).');
    return res.redirect(`/reset-password/${token}`);
  }

  const ok = useResetTokenAndUpdatePassword({ token, newPassword: password });
  if (!ok) {
    return res.status(400).render('pages/error', {
      title: 'Reset fehlgeschlagen',
      code: 400,
      message: 'Token ist ungültig oder bereits benutzt.',
      currentUser: null
    });
  }

  req.flash('success', 'Passwort erfolgreich geändert. Jetzt einloggen.');
  return res.redirect('/login');
});

router.post('/logout', (req, res) => {
  if (req.session.userId) {
    const currentUser = findUserById(req.session.userId);
    markDisconnected(req.session.userId, {
      manualStatus: currentUser?.presence_status || 'online'
    });
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = { authRouter: router };
