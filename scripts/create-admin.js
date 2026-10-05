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

const usersFile = process.env.MARKSTACK_USERS_FILE || path.join(__dirname, '..', '.markstack', 'users.json');

function parseUser(argv) {
  const i = argv.indexOf('--user');
  if (i === -1 || !argv[i + 1]) return null;
  return argv[i + 1].toLowerCase();
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stderr.write(prompt);
    let buf = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = ch => {
      for (const c of ch) {
        if (c === '\u0003') { stdin.setRawMode(false); process.stderr.write('\n'); return reject(new Error('Cancelled')); }
        if (c === '\r' || c === '\n' || c === '\u0004') {
          stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData);
          process.stderr.write('\n');
          return resolve(buf);
        }
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

function readPiped() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')));
    process.stdin.on('error', reject);
  });
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
  let password;
  if (process.stdin.isTTY) {
    password = await readHidden('Password (at least 12 characters): ');
    const again = await readHidden('Repeat password: ');
    if (password !== again) { console.error('Passwords do not match.'); process.exit(1); }
  } else {
    password = await readPiped();
  }
  const problem = checkPasswordPolicy(password);
  if (problem) { console.error(problem); process.exit(1); }
  await store.create({ name, role: 'admin', password });
  console.log(`Administrator "${name}" created in ${usersFile}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
