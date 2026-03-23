const { loadEnv } = require('../config/loadEnv');
loadEnv();

const bcrypt = require('bcryptjs');
const { db } = require('./connection');
const { runMigrations } = require('./migrate');

runMigrations();

const personalities = [
  {
    email: 'albert@apeiron.app',
    username: 'einstein',
    displayName: 'Albert Einstein',
    aboutMe: 'Relativity enthusiast. Curious about unified chats.',
    dob: '1879-03-14'
  },
  {
    email: 'leonhard@apeiron.app',
    username: 'euler',
    displayName: 'Leonhard Euler',
    aboutMe: 'I solve everything with notation and tea.',
    dob: '1707-04-15'
  },
  {
    email: 'platon@apeiron.app',
    username: 'platon',
    displayName: 'Platon',
    aboutMe: 'Forms, ideas, and now messaging platforms.',
    dob: '0428-01-01'
  },
  {
    email: 'ada@apeiron.app',
    username: 'lovelace',
    displayName: 'Ada Lovelace',
    aboutMe: 'Analytical engine and elegant code.',
    dob: '1815-12-10'
  },
  {
    email: 'marie@apeiron.app',
    username: 'curie',
    displayName: 'Marie Curie',
    aboutMe: 'Research first, always.',
    dob: '1867-11-07'
  },
  {
    email: 'niels@apeiron.app',
    username: 'bohr',
    displayName: 'Niels Bohr',
    aboutMe: 'Complementarity applies to teams, too.',
    dob: '1885-10-07'
  }
];

const seed = db.transaction(() => {
  db.exec('DELETE FROM password_reset_tokens; DELETE FROM messages; DELETE FROM dm_participants; DELETE FROM dm_threads; DELETE FROM channels; DELETE FROM server_members; DELETE FROM servers; DELETE FROM friendships; DELETE FROM user_settings; DELETE FROM users;');

  const insertUser = db.prepare(`
    INSERT INTO users (email, username, display_name, password_hash, date_of_birth, about_me)
    VALUES (@email, @username, @displayName, @passwordHash, @dob, @aboutMe)
  `);

  const passwordHash = bcrypt.hashSync('apeiron123!', 12);
  const usersByUsername = {};

  for (const person of personalities) {
    const result = insertUser.run({ ...person, passwordHash });
    usersByUsername[person.username] = result.lastInsertRowid;
  }

  const insertSettings = db.prepare(`
    INSERT INTO user_settings (user_id, dm_permission, friend_request_permission, message_requests_enabled, block_history_mode)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertSettings.run(usersByUsername.einstein, 'all', 'everyone', 0, 'visible');
  insertSettings.run(usersByUsername.euler, 'friends', 'friends_of_friends', 1, 'visible');
  insertSettings.run(usersByUsername.platon, 'server_members', 'server_members', 0, 'visible');
  insertSettings.run(usersByUsername.lovelace, 'all', 'everyone', 0, 'hidden');
  insertSettings.run(usersByUsername.curie, 'all', 'everyone', 0, 'visible');
  insertSettings.run(usersByUsername.bohr, 'all', 'everyone', 0, 'visible');

  const acceptedFriendship = db.prepare(`
    INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')
  `);

  acceptedFriendship.run(usersByUsername.einstein, usersByUsername.euler);
  acceptedFriendship.run(usersByUsername.einstein, usersByUsername.platon);
  acceptedFriendship.run(usersByUsername.einstein, usersByUsername.lovelace);
  acceptedFriendship.run(usersByUsername.euler, usersByUsername.curie);
  acceptedFriendship.run(usersByUsername.bohr, usersByUsername.curie);

  const createServer = db.prepare(`
    INSERT INTO servers (name, slug, description, owner_id)
    VALUES (?, ?, ?, ?)
  `);

  const academyId = createServer.run(
    'Academy of Ideas',
    'academy-of-ideas',
    'Interdisciplinary debates about math, philosophy and physics.',
    usersByUsername.platon
  ).lastInsertRowid;

  const labId = createServer.run(
    'Relativity Lab',
    'relativity-lab',
    'A place for thought experiments and practical engineering.',
    usersByUsername.einstein
  ).lastInsertRowid;

  const insertMember = db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)');
  const insertChannel = db.prepare('INSERT INTO channels (server_id, name, type, topic, position) VALUES (?, ?, ?, ?, ?)');

  [
    [academyId, usersByUsername.platon, 'owner'],
    [academyId, usersByUsername.euler, 'admin'],
    [academyId, usersByUsername.lovelace, 'member'],
    [academyId, usersByUsername.curie, 'member'],
    [labId, usersByUsername.einstein, 'owner'],
    [labId, usersByUsername.bohr, 'admin'],
    [labId, usersByUsername.curie, 'member'],
    [labId, usersByUsername.euler, 'member']
  ].forEach(([serverId, userId, role]) => insertMember.run(serverId, userId, role));

  const academyGeneralId = insertChannel.run(academyId, 'agora', 'text', 'Daily philosophical questions', 1).lastInsertRowid;
  const academyVoiceId = insertChannel.run(academyId, 'dialectic-voice', 'voice', 'Open voice salon', 2).lastInsertRowid;
  const labGeneralId = insertChannel.run(labId, 'spacetime', 'text', 'Relativity notes and updates', 1).lastInsertRowid;
  const labVoiceId = insertChannel.run(labId, 'quantum-corner', 'voice', 'Voice calls and discussions', 2).lastInsertRowid;

  const insertThread = db.prepare('INSERT INTO dm_threads (title, is_group, created_by, thread_type, agent_slug) VALUES (?, ?, ?, ?, ?)');
  const insertParticipant = db.prepare('INSERT INTO dm_participants (thread_id, user_id) VALUES (?, ?)');
  const insertMessage = db.prepare(`
    INSERT INTO messages (author_id, channel_id, thread_id, content, kind)
    VALUES (?, ?, ?, ?, ?)
  `);

  const einsteinEulerThread = insertThread.run('', 0, usersByUsername.einstein, 'dm', '').lastInsertRowid;
  insertParticipant.run(einsteinEulerThread, usersByUsername.einstein);
  insertParticipant.run(einsteinEulerThread, usersByUsername.euler);

  const foundersThread = db.prepare(
    'INSERT INTO dm_threads (title, icon_emoji, is_group, created_by, thread_type, agent_slug) VALUES (?, ?, 1, ?, ?, ?)'
  ).run('Founders Group', '🧠', usersByUsername.lovelace, 'group_dm', '').lastInsertRowid;
  [usersByUsername.einstein, usersByUsername.euler, usersByUsername.platon, usersByUsername.lovelace].forEach((uid) =>
    insertParticipant.run(foundersThread, uid)
  );

  insertMessage.run(usersByUsername.platon, academyGeneralId, null, 'Welcome to the Academy of Ideas. State your thesis.', 'system');
  insertMessage.run(usersByUsername.euler, academyGeneralId, null, 'Can beauty in equations be considered a form?', 'text');
  insertMessage.run(usersByUsername.curie, academyGeneralId, null, 'Only if it survives experiment.', 'text');
  insertMessage.run(usersByUsername.einstein, labGeneralId, null, 'Reminder: meeting about gravitational waves at 19:00.', 'text');
  insertMessage.run(usersByUsername.bohr, labGeneralId, null, 'I will bring uncertainty and coffee.', 'text');
  insertMessage.run(usersByUsername.euler, null, einsteinEulerThread, 'I improved your tensor formatting.', 'text');
  insertMessage.run(usersByUsername.einstein, null, einsteinEulerThread, 'Excellent. Time itself thanks you.', 'text');
  insertMessage.run(usersByUsername.lovelace, null, foundersThread, '@einstein please review the launch checklist.', 'text');
  insertMessage.run(usersByUsername.platon, null, foundersThread, 'The ideal UI includes many cats.', 'text');

  insertMessage.run(usersByUsername.bohr, labVoiceId, null, 'Voice room is open for live Q&A.', 'system');
  insertMessage.run(usersByUsername.platon, academyVoiceId, null, 'Dialectic voice session starts now.', 'system');
});

seed();
console.log('Seed completed. Demo users use password: apeiron123!');
