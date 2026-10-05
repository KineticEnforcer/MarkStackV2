#!/usr/bin/env node
'use strict';
/**
 * Create the first administrator (or another one).
 *
 *   npm run editor:create-admin -- --user NAME
 *
 * The password is typed at a hidden prompt (twice), or read from standard
 * input when it is piped, for scripts. It is never a command line argument and
 * is never printed or logged.
 */
const path = require('path');
const { UserStore } = require('../lib/user-store');
const { checkPasswordPolicy } = require('../lib/passwords');
const { readPassword } = require('../lib/cli-prompt');

const usersFile = process.env.MARKSTACK_USERS_FILE || path.join(__dirname, '..', '.markstack', 'users.json');

function parseUser(argv) {
  const i = argv.indexOf('--user');
  if (i === -1 || !argv[i + 1]) return null;
  return argv[i + 1].toLowerCase();
}

async function main() {
  const name = parseUser(process.argv.slice(2));
  if (!name) {
    console.error('Usage: npm run editor:create-admin -- --user NAME');
    console.error('The password is asked for at a hidden prompt, or read from standard input when piped.');
    process.exit(2);
  }
  const store = new UserStore(usersFile);
  if (store.get(name)) { console.error(`User "${name}" already exists.`); process.exit(1); }
  const password = await readPassword();
  const problem = checkPasswordPolicy(password);
  if (problem) { console.error(problem); process.exit(1); }
  await store.create({ name, role: 'admin', password });
  console.log(`Administrator "${name}" created in ${usersFile}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
