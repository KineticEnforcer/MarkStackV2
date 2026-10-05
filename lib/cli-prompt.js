'use strict';
/** Password input for the account commands: hidden prompt on a terminal, standard input when piped. */
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

/** Ask twice on a terminal, or read piped input once. */
async function readPassword() {
  if (process.stdin.isTTY) {
    const password = await readHidden('Password (at least 12 characters): ');
    const again = await readHidden('Repeat password: ');
    if (password !== again) throw new Error('Passwords do not match.');
    return password;
  }
  return readPiped();
}

module.exports = { readPassword };
