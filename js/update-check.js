// Checks GitHub Releases for a newer version of the game and offers it in the menu. Only in an installed copy opened
// from disk: a game joined through another player's server runs that server's version, and 'dev' (the repository)
// is never "updated". "Aktualizuj teraz" opens wymiary://update — the installer registers it to run
// launcher\update.ps1 -Restart, which closes this window, installs the new version and starts the game again.
(function () {
  const W = window.WYMIARY || { version: 'dev' };
  const $ = id => document.getElementById(id);
  $('ver').textContent = W.version === 'dev' ? 'wersja deweloperska' : 'wersja ' + W.version;
  if (location.protocol !== 'file:' || W.version === 'dev' || !W.repo) return;

  // 1.0.10 > 1.0.9; anything that is not such a number (an old build) counts as older
  const parse = v => /^\d+(\.\d+)*$/.test(v) ? v.split('.').map(Number) : null;
  function newer(a, b) {
    const x = parse(a), y = parse(b);
    if (!x) return false;
    if (!y) return true;
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
  }
  let shown = false;
  function check() {
    fetch(`https://api.github.com/repos/${W.repo}/releases/latest`).then(r => r.ok ? r.json() : null).then(rel => {
      if (!rel || !rel.tag_name || shown) return;
      const latest = rel.tag_name.replace(/^v/, '');
      if (!newer(latest, W.version)) return;
      shown = true;
      const notes = (rel.body || '').split('\n').filter(l => /^\s*- /.test(l)).slice(0, 5).map(l => '• ' + l.replace(/^\s*- /, '')).join('\n');
      $('upd').querySelector('b').textContent = `Nowa wersja ${latest} (masz ${W.version})`;
      $('upd').querySelector('small').textContent = notes;
      $('upd').hidden = false;
      WE.toast(`Dostępna nowa wersja gry: ${latest} — szczegóły w menu (Esc)`, 5000);
    }).catch(() => {});
  }
  $('updBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('upd').querySelector('small').textContent = 'Pobieram aktualizację… gra uruchomi się ponownie sama.\n' +
      '(Jeśli przeglądarka zapyta o otwarcie aplikacji, zgódź się. Gdy nic się nie dzieje: zamknij grę i włącz ją skrótem Wymiary.)';
    location.href = 'wymiary://update';
  });
  check();
  setInterval(check, 30 * 60 * 1000);
})();
