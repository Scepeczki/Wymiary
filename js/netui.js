// The network game window (menu → 🌐 Gra sieciowa): host a game on this computer, join another player's game,
// disconnect. Hosting needs the game's own server (the Wymiary shortcut starts it); joining works from anywhere.
(function () {
  const U = { open: false };
  const $ = id => document.getElementById(id);
  let busy = false, mismatch = null, addrKey = '';

  function msg(t, bad) { $('netMsg').textContent = t || ''; $('netMsg').classList.toggle('bad', !!bad); }
  function render() {
    const MP = WMP, online = MP.online();
    const fromServer = !MP.app && /^https?:/.test(location.protocol);       // opened from someone's server in a browser
    $('netState').textContent = MP.hosting ? `Hostujesz grę${online ? ` — połączonych graczy: ${WNet.peers.size + 1}` : ' — łączenie…'}`
      : MP.joined ? (online ? `Grasz u ${MP.joined} — połączonych graczy: ${WNet.peers.size + 1}` : `Łączenie z ${MP.joined}…`)
      : fromServer ? (online ? `Grasz na serwerze ${location.host}` : `Łączenie z ${location.host}…`)
      : 'Grasz sam. Jeden gracz hostuje, drugi dołącza, wpisując adres hosta.';
    $('netHostBox').style.display = fromServer ? 'none' : '';
    $('netJoinBox').style.display = fromServer || MP.hosting ? 'none' : '';
    $('netHost').style.display = MP.hosting ? 'none' : '';
    $('netHost').disabled = !MP.app || busy;
    $('netHostNote').textContent = MP.app ? '' : 'Hostowanie działa w grze uruchomionej skrótem Wymiary (gra otwarta z pliku nie ma własnego serwera).';
    $('netStop').style.display = MP.hosting ? '' : 'none';
    $('netLeave').style.display = MP.joined ? '' : 'none';
    const box = $('netAddrs'), key = JSON.stringify(MP.hosting);
    if (key === addrKey) { $('netForce').style.display = mismatch ? '' : 'none'; return; }
    addrKey = key;
    if (MP.hosting) {
      box.innerHTML = '<p>Drugi gracz: menu → 🌐 Gra sieciowa → <b>Dołącz</b> i jeden z adresów:</p>';
      for (const a of MP.hosting.addrs) {
        const row = document.createElement('div');
        row.className = 'addr';
        row.innerHTML = '<code></code><span></span><button>kopiuj</button>';
        row.querySelector('code').textContent = a.addr;
        row.querySelector('span').textContent = a.tailscale ? 'przez Tailscale — z dowolnego miejsca' : 'ta sama sieć Wi-Fi / LAN';
        row.querySelector('button').addEventListener('click', () => { navigator.clipboard.writeText(a.addr).then(() => WE.toast('Skopiowano ' + a.addr, 1200)); });
        box.appendChild(row);
      }
      if (!MP.hosting.addrs.length) box.innerHTML = '<p>Ten komputer nie ma adresu w sieci — podłącz się do Wi-Fi / LAN albo do Tailscale.</p>';
      const n = document.createElement('p');
      n.className = 'hint';
      n.textContent = 'Jeśli Windows zapyta o zaporę dla Node.js — zezwól na dostęp w sieciach prywatnych. Gdy zamkniesz grę, hostowanie się kończy.';
      box.appendChild(n);
    } else box.innerHTML = '';
    $('netForce').style.display = mismatch ? '' : 'none';
  }

  async function host() {
    busy = true; msg('Uruchamiam hostowanie…'); render();
    try {
      const r = await WMP.host();
      msg(r.ok ? '' : r.error, !r.ok);
    } catch (e) { msg('Serwer gry nie odpowiada: ' + e.message, true); }
    busy = false; render();
  }
  async function join(force) {
    const addr = $('netAddr').value.trim();
    if (!addr) return msg('Wpisz adres hosta, np. 192.168.1.55:8080', true);
    busy = true; mismatch = null; msg('Łączę z ' + addr + '…'); render();
    try {
      const r = await WMP.join(addr, force);
      if (!r.ok) msg(r.error, true);
      else if (!r.same && !force) {
        mismatch = r;
        msg(`Host ma inną wersję gry (${r.release || r.version}) niż ty (${r.mineRelease || r.mine}). Zaktualizujcie obie gry do najnowszej wersji — ` +
          'inaczej gra może działać źle. Możesz też połączyć się mimo to.', true);
      } else { msg(''); U.close(); WE.toast('Dołączono do gry u ' + r.addr, 2500); }
    } catch (e) { msg('Błąd: ' + e.message, true); }
    busy = false; render();
  }

  U.show = function () {
    U.open = true; mismatch = null; msg('');
    if (!$('netAddr').value) $('netAddr').value = WMP.lastHost();
    $('netw').style.display = 'flex';
    render();
  };
  U.close = function () { U.open = false; $('netw').style.display = 'none'; };

  U.init = function () {
    $('netBtn').addEventListener('click', U.show);
    $('netClose').addEventListener('click', U.close);
    $('netw').addEventListener('mousedown', e => { if (e.target === $('netw')) U.close(); });
    $('netHost').addEventListener('click', host);
    $('netStop').addEventListener('click', async () => { await WMP.stopHost(); render(); });
    $('netLeave').addEventListener('click', async () => { await WMP.leave(); render(); });
    $('netJoin').addEventListener('click', () => join(false));
    $('netForce').addEventListener('click', () => join(true));
    $('netAddr').addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); join(false); } });
    window.addEventListener('keydown', e => { if (U.open && e.code === 'Escape') { e.stopImmediatePropagation(); U.close(); } }, true);
    setInterval(() => { if (U.open) render(); }, 1000);
  };
  window.WNetUi = U;
})();
