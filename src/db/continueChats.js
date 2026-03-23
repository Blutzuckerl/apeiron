const { loadEnv } = require('../config/loadEnv');
loadEnv();

const { db } = require('./connection');
const { runMigrations } = require('./migrate');

runMigrations();

const TOPIC_PATTERNS = [
  {
    topic: 'product',
    anchor: 'the next release',
    patterns: ['ui', 'ux', 'launch', 'feature', 'roadmap', 'composer', 'emoji', 'gif', 'checklist', 'history', 'draft', 'onboarding']
  },
  {
    topic: 'physics',
    anchor: 'the current model',
    patterns: ['relativity', 'spacetime', 'tensor', 'gravity', 'gravitational', 'wave', 'observer', 'signal', 'measurement', 'detector', 'noise']
  },
  {
    topic: 'philosophy',
    anchor: 'the definition at hand',
    patterns: ['thesis', 'truth', 'beauty', 'form', 'idea', 'definition', 'argument', 'essence', 'virtue']
  }
];

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function detectTopic(messages, fallbackTopic, fallbackAnchor) {
  const combined = messages
    .map((message) => normalizeText(message.content))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const entry of TOPIC_PATTERNS) {
    const hit = entry.patterns.find((pattern) => combined.includes(pattern));
    if (hit) {
      return { topic: entry.topic, anchor: hit };
    }
  }

  return { topic: fallbackTopic, anchor: fallbackAnchor };
}

function getUserIds() {
  const rows = db.prepare('SELECT id, username FROM users').all();
  const byUsername = new Map();
  rows.forEach((row) => byUsername.set(row.username, row.id));
  return byUsername;
}

function getRecentThreadMessages(threadId, limit = 12) {
  return db.prepare(
    `SELECT m.id, m.content, m.kind, u.username
     FROM (
       SELECT id, content, kind, author_id
       FROM messages
       WHERE thread_id = ?
       ORDER BY id DESC
       LIMIT ?
     ) m
     JOIN users u ON u.id = m.author_id
     ORDER BY m.id ASC`
  ).all(threadId, limit);
}

function getRecentChannelMessages(channelId, limit = 12) {
  return db.prepare(
    `SELECT m.id, m.content, m.kind, u.username
     FROM (
       SELECT id, content, kind, author_id
       FROM messages
       WHERE channel_id = ?
       ORDER BY id DESC
       LIMIT ?
     ) m
     JOIN users u ON u.id = m.author_id
     ORDER BY m.id ASC`
  ).all(channelId, limit);
}

function insertThreadMessage(threadId, authorId, content) {
  return db.prepare(
    'INSERT INTO messages (author_id, thread_id, content, kind) VALUES (?, ?, ?, ?)'
  ).run(authorId, threadId, content, 'text').lastInsertRowid;
}

function insertChannelMessage(channelId, authorId, content) {
  return db.prepare(
    'INSERT INTO messages (author_id, channel_id, content, kind) VALUES (?, ?, ?, ?)'
  ).run(authorId, channelId, content, 'text').lastInsertRowid;
}

function appendUniqueMessages(existingMessages, entries, insertFn) {
  const recentTexts = new Set(existingMessages.map((message) => normalizeText(message.content)));
  let inserted = 0;

  entries.forEach((entry) => {
    const text = normalizeText(entry.content);
    if (!text || recentTexts.has(text)) {
      return;
    }
    insertFn(entry.authorId, text);
    recentTexts.add(text);
    inserted += 1;
  });

  return inserted;
}

function continueFoundersGroup(userIds) {
  const thread = db.prepare(
    `SELECT id
     FROM dm_threads
     WHERE is_group = 1 AND LOWER(title) = 'founders group'
     LIMIT 1`
  ).get();

  if (!thread) {
    return 0;
  }

  const messages = getRecentThreadMessages(thread.id);
  const { topic, anchor } = detectTopic(messages, 'product', 'the next release');
  const entries = [
    {
      authorId: userIds.get('lovelace'),
      content: `I want one more pass on ${anchor}. The goal is to reduce hesitation in the first minute, not add visual noise.`
    },
    {
      authorId: userIds.get('euler'),
      content: `Then let us define success precisely: fewer misclicks, fewer abandoned drafts, and a shorter path through ${anchor}.`
    },
    {
      authorId: userIds.get('einstein'),
      content: `That seems right. A user should feel the direction of ${anchor} immediately, the way a clean thought experiment reveals its own constraints.`
    },
    {
      authorId: userIds.get('platon'),
      content: topic === 'product'
        ? `And we should ask what form ${anchor} ought to take before we decorate it. Utility should lead, style should follow.`
        : `Before we decide, I would still define ${anchor} more carefully. We move faster once the terms stop shifting beneath us.`
    },
    {
      authorId: userIds.get('lovelace'),
      content: 'Good. I will narrow the checklist to the critical flow and leave the ornamental ideas for a later pass.'
    }
  ];

  return appendUniqueMessages(messages, entries.filter((entry) => entry.authorId), (authorId, content) =>
    insertThreadMessage(thread.id, authorId, content)
  );
}

function continuePlatonDms(userIds) {
  const threads = db.prepare(
    `SELECT t.id
     FROM dm_threads t
     JOIN dm_participants p1 ON p1.thread_id = t.id
     JOIN users u1 ON u1.id = p1.user_id
     WHERE t.is_group = 0
       AND COALESCE(t.thread_type, 'dm') != 'ai_dm'
       AND u1.username = 'platon'`
  ).all();

  let inserted = 0;

  threads.forEach((thread) => {
    const messages = getRecentThreadMessages(thread.id);
    const { topic, anchor } = detectTopic(messages, 'philosophy', 'the present claim');
    const platonId = userIds.get('platon');
    if (!platonId) {
      return;
    }

    const entries = [
      {
        authorId: platonId,
        content: `Before we settle ${anchor}, I would distinguish the word from the thing itself. Otherwise we may only be naming our assumptions.`
      },
      {
        authorId: platonId,
        content: topic === 'philosophy'
          ? `What would count as a stronger reason for ${anchor}: habit, evidence, or a clearer definition?`
          : `Even in practical matters, ${anchor} becomes easier once we know which part is essential and which part is only convenient.`
      },
      {
        authorId: platonId,
        content: 'If you like, we can reduce the discussion to one precise term first and rebuild the rest from there.'
      }
    ];

    inserted += appendUniqueMessages(messages, entries, (authorId, content) =>
      insertThreadMessage(thread.id, authorId, content)
    );
  });

  return inserted;
}

function continueEinsteinEulerDm(userIds) {
  const thread = db.prepare(
    `SELECT t.id
     FROM dm_threads t
     JOIN dm_participants p1 ON p1.thread_id = t.id
     JOIN users u1 ON u1.id = p1.user_id
     JOIN dm_participants p2 ON p2.thread_id = t.id
     JOIN users u2 ON u2.id = p2.user_id
     WHERE t.is_group = 0
       AND u1.username = 'einstein'
       AND u2.username = 'euler'
     LIMIT 1`
  ).get();

  if (!thread) {
    return 0;
  }

  const messages = getRecentThreadMessages(thread.id);
  const { anchor } = detectTopic(messages, 'physics', 'the current derivation');
  const entries = [
    {
      authorId: userIds.get('euler'),
      content: `I also separated the notation around ${anchor}. The symbols now reveal the invariant before the commentary interrupts.`
    },
    {
      authorId: userIds.get('einstein'),
      content: `Excellent. That should save us from arguing with the typography instead of the physics.`
    },
    {
      authorId: userIds.get('euler'),
      content: 'Once you review the revised line, I can reduce the remaining derivation to two shorter steps.'
    },
    {
      authorId: userIds.get('einstein'),
      content: 'Do that. A concise proof is kinder to the reader and to the author.'
    }
  ];

  return appendUniqueMessages(messages, entries.filter((entry) => entry.authorId), (authorId, content) =>
    insertThreadMessage(thread.id, authorId, content)
  );
}

function continueAgora(userIds) {
  const channel = db.prepare(
    `SELECT c.id
     FROM channels c
     JOIN servers s ON s.id = c.server_id
     WHERE LOWER(s.name) = 'academy of ideas'
       AND LOWER(c.name) = 'agora'
     LIMIT 1`
  ).get();

  if (!channel) {
    return 0;
  }

  const messages = getRecentChannelMessages(channel.id);
  const { anchor } = detectTopic(messages, 'philosophy', 'the current thesis');
  const entries = [
    {
      authorId: userIds.get('platon'),
      content: `Let us refine the question: what exactly makes ${anchor} persuasive rather than merely familiar?`
    },
    {
      authorId: userIds.get('euler'),
      content: `I would separate the argument into premise and conclusion first. ${anchor} still carries too many assumptions at once.`
    },
    {
      authorId: userIds.get('curie'),
      content: `Then test it with one example. If ${anchor} survives contact with a concrete case, the discussion improves immediately.`
    },
    {
      authorId: userIds.get('platon'),
      content: 'A useful standard. A claim that cannot endure one careful example is not yet ready to be universal.'
    },
    {
      authorId: userIds.get('lovelace'),
      content: 'And if we can restate it cleanly after that example, we probably have something sturdy enough to keep.'
    }
  ];

  return appendUniqueMessages(messages, entries.filter((entry) => entry.authorId), (authorId, content) =>
    insertChannelMessage(channel.id, authorId, content)
  );
}

function continueSpacetime(userIds) {
  const channel = db.prepare(
    `SELECT c.id
     FROM channels c
     JOIN servers s ON s.id = c.server_id
     WHERE LOWER(s.name) = 'relativity lab'
       AND LOWER(c.name) = 'spacetime'
     LIMIT 1`
  ).get();

  if (!channel) {
    return 0;
  }

  const messages = getRecentChannelMessages(channel.id);
  const { anchor } = detectTopic(messages, 'physics', 'the current model');
  const entries = [
    {
      authorId: userIds.get('einstein'),
      content: `Before the meeting, I want one sharper question: which observer would first detect a difference in ${anchor}?`
    },
    {
      authorId: userIds.get('curie'),
      content: `Good. If we name that observer, we can also name the first measurement worth trusting.`
    },
    {
      authorId: userIds.get('bohr'),
      content: `And we should be ready for two descriptions of ${anchor}: the intuitive one and the one the apparatus actually permits.`
    },
    {
      authorId: userIds.get('euler'),
      content: `I can prepare a shorter comparison table so the disagreement appears in the equations before it appears in the conversation.`
    },
    {
      authorId: userIds.get('einstein'),
      content: 'Perfect. If the notation stays honest, the debate may even finish before the coffee does.'
    }
  ];

  return appendUniqueMessages(messages, entries.filter((entry) => entry.authorId), (authorId, content) =>
    insertChannelMessage(channel.id, authorId, content)
  );
}

function run() {
  const userIds = getUserIds();
  if (!userIds.size) {
    console.log('No users found. Nothing to continue.');
    return;
  }

  const tx = db.transaction(() => {
    const summary = {
      foundersGroup: continueFoundersGroup(userIds),
      platonDms: continuePlatonDms(userIds),
      einsteinEulerDm: continueEinsteinEulerDm(userIds),
      agora: continueAgora(userIds),
      spacetime: continueSpacetime(userIds)
    };
    return summary;
  });

  const summary = tx();
  const total = Object.values(summary).reduce((sum, value) => sum + Number(value || 0), 0);
  console.log(`Appended ${total} messages across existing chats.`);
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
}

if (require.main === module) {
  run();
}

module.exports = { run };
