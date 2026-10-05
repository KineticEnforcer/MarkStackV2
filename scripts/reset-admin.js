#!/usr/bin/env node
'use strict';
/**
 * Recover an administrator account from the server.
 *
 *   npm run editor:reset-admin -- --user NAME
 *
 * Sets a new password (hidden prompt, or standard input when piped), enables the
 * account if it was disabled and clears any pending password change. Needs shell
 * access to the server, which is the trust boundary: anyone who can run it can
 * already read the user file. The password is never a command line argument and
 * is never printed or logged. Restart the editor afterwards so sessions that were
 * open for that account end (sessions live in the editor's memory).
 */
const path = require('path');
const { UserStore } = require('../lib/user-store');
const { readPassword } = require('../lib/cli-prompt');

const usersFile = process.env.MARKSTACK_USERS_FILE || path.join(__dirname, '..', '.markstack', 'users.json');

function parseUser(argv) {
  const i = argv.indexOf('--user');
  return i !== -1 && argv[i + 1] ? argv[i + 1].toLowerCase() : null;
}

async function main() {
  const name = parseUser(process.argv.slice(2));
  if (!name) {
    console.error('Usage: npm run editor:reset-admin -- --user NAME');
    console.error('The password is asked for at a hidden prompt, or read from standard input when piped.');
    process.exit(2);
  }
  const store = new UserStore(usersFile);
  const user = store.get(name);
  if (!user || user.role !== 'admin') { console.error(`No administrator named "${name}" in ${usersFile}.`); process.exit(1); }
  const password = await readPassword();
  await store.setPassword(name, password, { mustChangePassword: false });
  if (user.disabled) store.setDisabled(name, false);
  console.log(`Password for administrator "${name}" was reset. Restart the editor to end any open sessions for this account.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
