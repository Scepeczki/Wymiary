// The player's settings — controls and SpaceMouse, the picture, the 4D view layout, tutorial progress, the last host:
// everything the game keeps in localStorage under 'wymiary.*' is mirrored into a file of the Windows user,
// %LOCALAPPDATA%\Wymiary\settings.json (through the game's own server, see server/server.js /api/settings). So the
// settings survive updates, reinstalling, a reset browser profile and a change of the game's address.
// At start the file wins (read synchronously, before any other script reads its settings); every change is written
// back shortly after. Without the game's server (opened from disk) only the browser keeps them.
(function () {
  const S = { file: false };
  window.WStore = S;
  if (location.port !== '47816' || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  const mine = k => typeof k === 'string' && k.startsWith('wymiary.');
  let data = null;
  try {
    const x = new XMLHttpRequest();                  // synchronous on purpose: a tiny local file, needed before anything else
    x.open('GET', '/api/settings', false);
    x.setRequestHeader('X-Wymiary', '1');
    x.send();
    if (x.status === 200) data = JSON.parse(x.responseText);
  } catch (e) { /* no server: the browser's copy only */ }
  if (!data) return;
  S.file = true;
  try { for (const k in data) if (mine(k) && typeof data[k] === 'string') localStorage.setItem(k, data[k]); } catch (e) { /* no storage */ }

  let timer = null;
  function push() {
    timer = null;
    const all = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (mine(k)) all[k] = localStorage.getItem(k); } } catch (e) { return; }
    fetch('/api/settings', { method: 'POST', headers: { 'X-Wymiary': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(all), keepalive: true })
      .catch(() => {});
  }
  const later = () => { if (!timer) timer = setTimeout(push, 400); };
  const set = Storage.prototype.setItem, del = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (this === localStorage && mine(k)) later(); };
  Storage.prototype.removeItem = function (k) { del.call(this, k); if (this === localStorage && mine(k)) later(); };
  window.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); push(); } });
  later();                                          // settings only this browser had (older versions): into the file too
})();
