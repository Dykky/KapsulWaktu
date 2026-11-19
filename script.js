(function () {
  'use strict';

  var KEY_USERS = 'kw_users';
  var KEY_SESSION = 'kw_session';
  var KEY_CAPSULES = 'kw_capsules';
  var page = document.body.getAttribute('data-page');

  /* ---------- Penyimpanan ---------- */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getSession() {
    var s = read(KEY_SESSION, null);
    return s && s.username ? s : null;
  }

  /* ---------- Util ---------- */
  function hashPassword(username, password) {
    var text = username + ':' + password;
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return Promise.resolve('x' + h);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function tomorrowISO() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatDate(iso) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function isOpen(capsule) {
    return capsule.tanggalBuka <= todayISO();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showError(id, message) {
    var box = document.getElementById(id);
    if (box) box.textContent = message || '';
  }

  /* ---------- Penjaga halaman ---------- */
  var session = getSession();

  if (page === 'login') {
    if (session) { window.location.replace('index.html'); return; }
  } else if (!session) {
    window.location.replace('login.html');
    return;
  }

  /* ---------- Header: nama dan tombol keluar ---------- */
  if (session && page !== 'login') {
    var header = document.querySelector('.site-header');
    var box = el('div', 'user-box');
    var label = el('span');
    label.appendChild(document.createTextNode('Halo, '));
    label.appendChild(el('strong', '', session.nama));
    var out = el('button', 'btn-ghost', 'Keluar');
    out.type = 'button';
    out.addEventListener('click', function () {
      try { localStorage.removeItem(KEY_SESSION); } catch (e) {}
      window.location.replace('login.html');
    });
    box.appendChild(label);
    box.appendChild(out);
    header.appendChild(box);
  }

  /* ---------- Halaman login ---------- */
  if (page === 'login') {
    var tabMasuk = document.getElementById('tab-masuk');
    var tabDaftar = document.getElementById('tab-daftar');
    var formMasuk = document.getElementById('form-masuk');
    var formDaftar = document.getElementById('form-daftar');

    function pilihTab(daftar) {
      tabMasuk.setAttribute('aria-selected', daftar ? 'false' : 'true');
      tabDaftar.setAttribute('aria-selected', daftar ? 'true' : 'false');
      formMasuk.hidden = daftar;
      formDaftar.hidden = !daftar;
      showError('err-masuk', '');
      showError('err-daftar', '');
    }

    tabMasuk.addEventListener('click', function () { pilihTab(false); });
    tabDaftar.addEventListener('click', function () { pilihTab(true); });

    function mulaiSesi(user) {
      write(KEY_SESSION, { username: user.username, nama: user.nama });
      window.location.replace('index.html');
    }

    formMasuk.addEventListener('submit', function (e) {
      e.preventDefault();
      var username = document.getElementById('m-user').value.trim().toLowerCase();
      var password = document.getElementById('m-pass').value;

      if (!username || !password) {
        showError('err-masuk', 'Isi nama pengguna dan kata sandi.');
        return;
      }

      var users = read(KEY_USERS, {});
      var user = users[username];
      if (!user) {
        showError('err-masuk', 'Nama pengguna atau kata sandi salah.');
        return;
      }

      hashPassword(username, password).then(function (hash) {
        if (hash !== user.hash) {
          showError('err-masuk', 'Nama pengguna atau kata sandi salah.');
          return;
        }
        mulaiSesi(user);
      });
    });

    formDaftar.addEventListener('submit', function (e) {
      e.preventDefault();
      var nama = document.getElementById('d-nama').value.trim();
      var username = document.getElementById('d-user').value.trim().toLowerCase();
      var pass = document.getElementById('d-pass').value;
      var pass2 = document.getElementById('d-pass2').value;

      if (!nama) { showError('err-daftar', 'Isi nama panggilan.'); return; }
      if (!/^[a-z0-9._]{3,24}$/.test(username)) {
        showError('err-daftar', 'Nama pengguna harus 3 sampai 24 karakter: huruf kecil, angka, titik, atau garis bawah.');
        return;
      }
      if (pass.length < 6) { showError('err-daftar', 'Kata sandi minimal 6 karakter.'); return; }
      if (pass !== pass2) { showError('err-daftar', 'Kata sandi dan pengulangannya tidak sama.'); return; }

      var users = read(KEY_USERS, {});
      if (users[username]) {
        showError('err-daftar', 'Nama pengguna sudah dipakai. Pilih yang lain.');
        return;
      }

      hashPassword(username, pass).then(function (hash) {
        var user = { username: username, nama: nama, hash: hash };
        users[username] = user;
        if (!write(KEY_USERS, users)) {
          showError('err-daftar', 'Akun tidak bisa disimpan. Periksa pengaturan penyimpanan browser.');
          return;
        }
        mulaiSesi(user);
      });
    });
  }

  /* ---------- Halaman 1: kunci kapsul ---------- */
  if (page === 'kunci') {
    var form = document.getElementById('form-kapsul');
    var inputNama = document.getElementById('nama');
    var inputTanggal = document.getElementById('tanggal');

    inputNama.value = session.nama;
    inputTanggal.min = tomorrowISO();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showError('err-kapsul', '');

      var nama = inputNama.value.trim();
      var pesan = document.getElementById('pesan').value.trim();
      var tanggal = inputTanggal.value;

      if (!nama || !pesan || !tanggal) {
        showError('err-kapsul', 'Lengkapi nama, pesan, dan tanggal buka.');
        return;
      }
      if (tanggal < tomorrowISO()) {
        showError('err-kapsul', 'Tanggal buka harus setelah hari ini.');
        return;
      }

      var capsules = read(KEY_CAPSULES, []);
      capsules.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        owner: session.username,
        nama: nama,
        pesan: pesan,
        tanggalKunci: todayISO(),
        tanggalBuka: tanggal,
        publik: document.getElementById('publik').checked
      });

      if (!write(KEY_CAPSULES, capsules)) {
        showError('err-kapsul', 'Kapsul tidak bisa disimpan. Periksa pengaturan penyimpanan browser.');
        return;
      }

      window.location.href = 'dinding.html?terkunci=' + encodeURIComponent(tanggal);
    });

    /* ---------- 1. Integrasi Public API: Stempel Cuaca Real-Time Berdasarkan GPS Lokasi (Open-Meteo API) ---------- */
    var weatherDesc = document.getElementById('weather-desc');
    var weatherIcon = document.getElementById('weather-icon');
    var gpsStatusBadge = document.getElementById('gps-status-badge');
    var btnRefreshGps = document.getElementById('btn-refresh-gps');
    var btnInsertWeather = document.getElementById('btn-insert-weather');
    var inputPesan = document.getElementById('pesan');
    var currentWeatherStamp = null;

    function getWeatherInfo(code) {
      if (code === 0) return { icon: '☀️', text: 'Cerah' };
      if (code <= 3) return { icon: '⛅', text: 'Cerah Berawan' };
      if (code <= 48) return { icon: '🌫️', text: 'Berkabut' };
      if (code <= 55) return { icon: '🌦️', text: 'Gerimis' };
      if (code <= 65) return { icon: '🌧️', text: 'Hujan' };
      if (code <= 82) return { icon: '🌧️', text: 'Hujan Lebat' };
      if (code >= 95) return { icon: '⛈️', text: 'Badai Petir' };
      return { icon: '🌤️', text: 'Sebagian Berawan' };
    }

    // Mengambil nama kota/daerah secara gratis via Reverse Geocode API (BigDataCloud)
    async function getLocalityName(lat, lon) {
      try {
        var geoUrl = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
                     lat + '&longitude=' + lon + '&localityLanguage=id';
        var geoRes = await fetch(geoUrl);
        if (geoRes.ok) {
          var geoData = await geoRes.json();
          var locParts = [];
          if (geoData.locality) locParts.push(geoData.locality);
          if (geoData.city && geoData.city !== geoData.locality) locParts.push(geoData.city);
          if (locParts.length === 0 && geoData.principalSubdivision) locParts.push(geoData.principalSubdivision);
          if (locParts.length > 0) return locParts.join(', ');
        }
      } catch (e) {
        console.warn('Reverse geocode error:', e);
      }
      return 'Koordinat GPS (' + lat + ', ' + lon + ')';
    }

    // Mengambil data cuaca Open-Meteo berdasarkan titik koordinat GPS
    async function fetchWeatherByGps(lat, lon, isFallback) {
      try {
        var locationName = isFallback ? 'Indonesia (Estimasi)' : await getLocalityName(lat, lon);

        var weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
                         '&longitude=' + lon +
                         '&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto';
        var res = await fetch(weatherUrl);
        if (!res.ok) throw new Error('Status respon Open-Meteo: ' + res.status);
        var data = await res.json();
        var cur = data.current;
        var info = getWeatherInfo(cur.weather_code);

        currentWeatherStamp = {
          city: locationName,
          lat: lat,
          lon: lon,
          temp: cur.temperature_2m,
          humidity: cur.relative_humidity_2m,
          desc: info.text,
          icon: info.icon,
          isGps: !isFallback,
          dateFormatted: formatDate(todayISO())
        };

        if (weatherDesc) {
          weatherDesc.textContent = locationName + ' • ' + cur.temperature_2m + '°C, ' + info.text + ' (Kelembapan ' + cur.relative_humidity_2m + '%)';
        }
        if (weatherIcon) weatherIcon.textContent = info.icon;

        if (gpsStatusBadge) {
          if (isFallback) {
            gpsStatusBadge.className = 'gps-status-badge is-warning';
            gpsStatusBadge.textContent = '⚠️ Estimasi (Klik Deteksi Cuaca)';
          } else {
            gpsStatusBadge.className = 'gps-status-badge is-live';
            gpsStatusBadge.textContent = '📍 GPS Aktif (' + lat + ', ' + lon + ')';
          }
        }

        if (btnInsertWeather) btnInsertWeather.disabled = false;
      } catch (err) {
        console.error('Fetch weather error:', err);
        if (weatherDesc) {
          weatherDesc.textContent = 'Gagal memuat cuaca: ' + (err.message || 'Periksa koneksi internet');
        }
        if (gpsStatusBadge) {
          gpsStatusBadge.className = 'gps-status-badge is-warning';
          gpsStatusBadge.textContent = '⚠️ Gagal Mengambil Cuaca';
        }
      }
    }

    // Meminta posisi GPS dari browser menggunakan Geolocation API
    function requestGpsLocation() {
      if (gpsStatusBadge) {
        gpsStatusBadge.className = 'gps-status-badge';
        gpsStatusBadge.textContent = '🛰️ Membaca GPS perangkat...';
      }
      if (weatherDesc) {
        weatherDesc.textContent = 'Menghubungkan ke sensor GPS & mencari titik koordinat lokasimu...';
      }

      if (!navigator.geolocation) {
        if (gpsStatusBadge) {
          gpsStatusBadge.className = 'gps-status-badge is-warning';
          gpsStatusBadge.textContent = '⚠️ Browser tidak mendukung GPS';
        }
        fetchWeatherByGps(-6.2088, 106.8456, true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = Number(position.coords.latitude).toFixed(4);
          var lon = Number(position.coords.longitude).toFixed(4);
          fetchWeatherByGps(lat, lon, false);
        },
        function (error) {
          console.warn('Geolocation warning:', error);
          var reason = 'Izin GPS belum diizinkan';
          if (error.code === error.PERMISSION_DENIED) reason = 'Izin akses GPS belum diizinkan';
          if (error.code === error.TIMEOUT) reason = 'Waktu baca GPS habis';

          if (gpsStatusBadge) {
            gpsStatusBadge.className = 'gps-status-badge is-warning';
            gpsStatusBadge.textContent = '⚠️ ' + reason;
          }
          if (weatherDesc) {
            weatherDesc.textContent = 'Klik tombol "Deteksi GPS" untuk mengaktifkan cuaca sesuai lokasimu.';
          }
          // Muat data perkiraan agar formulir tetap memiliki data
          fetchWeatherByGps(-6.2088, 106.8456, true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    // Jalankan deteksi GPS saat pertama kali halaman dimuat
    requestGpsLocation();

    // Event 'click': Tombol Deteksi / Perbarui GPS
    if (btnRefreshGps) {
      btnRefreshGps.addEventListener('click', function () {
        requestGpsLocation();
      });
    }

    // Event 'click': Sisipkan data cuaca & GPS ke textarea formulir
    if (btnInsertWeather) {
      btnInsertWeather.addEventListener('click', function () {
        if (!currentWeatherStamp || !inputPesan) return;
        var locLabel = currentWeatherStamp.isGps ? '📍 ' + currentWeatherStamp.city + ' (Lat: ' + currentWeatherStamp.lat + ', Lon: ' + currentWeatherStamp.lon + ')' : currentWeatherStamp.city;
        var stampText = '[Stempel Cuaca Saat Kapsul Dikunci: ' +
          currentWeatherStamp.dateFormatted + ' • ' +
          locLabel + ' • ' +
          currentWeatherStamp.icon + ' ' +
          currentWeatherStamp.temp + '°C, ' +
          currentWeatherStamp.desc + ' (Kelembapan ' + currentWeatherStamp.humidity + '%)]';

        if (inputPesan.value.trim()) {
          inputPesan.value = inputPesan.value.trim() + '\n\n' + stampText;
        } else {
          inputPesan.value = stampText;
        }

        inputPesan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputPesan.focus();
        inputPesan.classList.add('textarea-highlight');
        setTimeout(function () { inputPesan.classList.remove('textarea-highlight'); }, 1200);
      });
    }

    /* ---------- 2. Integrasi Public API: Inspirasi Pesan Masa Depan (Quotes API) ---------- */
    var searchInput = document.getElementById('search-input');
    var searchClear = document.getElementById('search-clear');
    var auraButtons = document.querySelectorAll('.aura-btn');
    var btnRefresh = document.getElementById('btn-refresh-quotes');
    var btnRetry = document.getElementById('btn-retry-api');
    var loadingMessage = document.getElementById('loading-message');
    var errorMessage = document.getElementById('error-message');
    var errorText = document.getElementById('error-text');
    var emptyMessage = document.getElementById('empty-message');
    var inspirationGrid = document.getElementById('inspiration-grid');
    var btnScrollInspirasi = document.getElementById('btn-scroll-inspirasi');

    var quotesData = [];
    var activeAura = 'all';

    // Klasifikasi Aura-Based Discovery (Studi Kasus Modul 2)
    function getAuraForQuote(item) {
      var text = ((item.quote || '') + ' ' + (item.author || '')).toLowerCase();
      if (/courage|action|work|effort|future|success|start|begin|power|win|conquer|fear|capital|solution|enterprise/.test(text)) {
        return { id: 'energy', label: 'High Energy' };
      }
      if (/wisdom|truth|mind|think|learn|knowledge|understand|reason|depth|grow|life/.test(text)) {
        return { id: 'wisdom', label: 'Wisdom' };
      }
      if (/dream|hope|tomorrow|light|believe|love|heart|ocean|sky|star|vision|world/.test(text)) {
        return { id: 'hope', label: 'Hope & Future' };
      }
      return { id: 'peace', label: 'Serenity' };
    }

    // Sanitasi teks HTML untuk keamanan XSS
    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    // Render Data menggunakan Array Method (filter, map, join) & ES6 Template Literals
    function renderQuotes() {
      if (!inspirationGrid) return;
      var keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';

      var filtered = quotesData.filter(function (item) {
        var matchesKeyword = item.quote.toLowerCase().includes(keyword) || 
                             item.author.toLowerCase().includes(keyword);
        var aura = getAuraForQuote(item);
        var matchesAura = (activeAura === 'all' || aura.id === activeAura);
        return matchesKeyword && matchesAura;
      });

      if (filtered.length === 0) {
        inspirationGrid.innerHTML = '';
        if (emptyMessage) emptyMessage.hidden = false;
        return;
      }
      if (emptyMessage) emptyMessage.hidden = true;

      var cardsHtml = filtered.map(function (item) {
        var { id, quote, author } = item;
        var aura = getAuraForQuote(item);

        return `
          <article class="quote-card" data-id="${id}">
            <div class="quote-card-header">
              <span class="quote-aura-badge">${escapeHtml(aura.label)}</span>
              <span class="quote-id">#${id}</span>
            </div>
            <blockquote class="quote-text">"${escapeHtml(quote)}"</blockquote>
            <div class="quote-footer">
              <span class="quote-author" title="${escapeHtml(author)}">&mdash; ${escapeHtml(author)}</span>
              <button type="button" class="btn-use-quote" data-id="${id}" title="Sisipkan kutipan ini ke pesan kapsul">
                Gunakan di Kapsul &rarr;
              </button>
            </div>
          </article>
        `;
      }).join('');

      inspirationGrid.innerHTML = cardsHtml;
    }

    // Pengambilan data menggunakan Fetch API & async/await (Modul 2)
    async function fetchQuotes() {
      if (!inspirationGrid) return;

      if (loadingMessage) loadingMessage.hidden = false;
      if (errorMessage) errorMessage.hidden = true;
      if (emptyMessage) emptyMessage.hidden = true;
      inspirationGrid.innerHTML = '';

      try {
        var endpoint = 'https://dummyjson.com/quotes?limit=30';
        var response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error('Server mengembalikan respon status ' + response.status);
        }

        var data = await response.json();
        quotesData = Array.isArray(data.quotes) ? data.quotes : [];
        renderQuotes();
      } catch (err) {
        console.error('Fetch error:', err);
        if (errorMessage) {
          errorMessage.hidden = false;
          if (errorText) {
            errorText.textContent = 'Gagal memuat data dari Public API (' + (err.message || 'Koneksi bermasalah') + ').';
          }
        }
      } finally {
        if (loadingMessage) loadingMessage.hidden = true;
      }
    }

    /* ---------- Event Handling ---------- */
    // Event 'input': Unified search real-time
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        if (searchClear) searchClear.hidden = !searchInput.value;
        renderQuotes();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        searchInput.value = '';
        searchClear.hidden = true;
        searchInput.focus();
        renderQuotes();
      });
    }

    // Event 'click': Aura filter buttons
    if (auraButtons) {
      auraButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          auraButtons.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          activeAura = btn.getAttribute('data-aura') || 'all';
          renderQuotes();
        });
      });
    }

    // Event 'click': Refresh data dari API
    if (btnRefresh) {
      btnRefresh.addEventListener('click', function () {
        fetchQuotes();
      });
    }

    if (btnRetry) {
      btnRetry.addEventListener('click', function () {
        fetchQuotes();
      });
    }

    // Event delegation 'click': Menggunakan kutipan dan menyalin ke form
    if (inspirationGrid) {
      inspirationGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-use-quote');
        if (!btn || !inputPesan) return;
        var qId = Number(btn.getAttribute('data-id'));

        var selected = quotesData.find(function (q) { return q.id === qId; });
        if (selected) {
          var quoteFormatted = '"' + selected.quote + '" \n— ' + selected.author;
          
          if (inputPesan.value.trim()) {
            inputPesan.value = inputPesan.value.trim() + '\n\n' + quoteFormatted;
          } else {
            inputPesan.value = quoteFormatted;
          }

          inputPesan.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputPesan.focus();
          inputPesan.classList.add('textarea-highlight');
          setTimeout(function () {
            inputPesan.classList.remove('textarea-highlight');
          }, 1200);
        }
      });
    }

    // Event 'click': Tombol scroll ke section inspirasi
    if (btnScrollInspirasi) {
      btnScrollInspirasi.addEventListener('click', function () {
        var targetSection = document.getElementById('section-inspirasi');
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
          if (searchInput) searchInput.focus();
        }
      });
    }

    // Inisialisasi pengambilan data API kutipan
    fetchQuotes();
  }

  /* ---------- Halaman 2: dinding ---------- */
  if (page === 'dinding') {
    var wall = document.getElementById('wall');
    var nextCard = document.getElementById('next-card');
    var notice = document.getElementById('notice');

    var params = new URLSearchParams(window.location.search);
    var terkunci = params.get('terkunci');
    if (terkunci && /^\d{4}-\d{2}-\d{2}$/.test(terkunci)) {
      notice.textContent = 'Kapsulmu sudah terkunci. Kapsul akan bisa dibuka pada ' + formatDate(terkunci) + '.';
      notice.hidden = false;
    }

    function buildCard(c, mine) {
      var open = isOpen(c);
      var card = el('article', 'capsule-card ' + (open ? 'is-open' : 'is-locked'));

      var head = el('header');
      head.appendChild(el('h3', '', mine ? c.nama + ' (kamu)' : c.nama));
      head.appendChild(el('span', 'badge', open ? 'Terbuka' : 'Terkunci'));
      card.appendChild(head);

      card.appendChild(el('p', 'when', 'Dikunci ' + formatDate(c.tanggalKunci)));
      card.appendChild(el('p', 'when', 'Dibuka ' + formatDate(c.tanggalBuka)));

      if (open) {
        var details = el('details');
        details.appendChild(el('summary', '', 'Baca pesan'));
        var letter = el('div', 'letter');
        letter.appendChild(el('p', '', c.pesan));
        details.appendChild(letter);
        card.appendChild(details);
      } else {
        card.appendChild(el('div', 'sealed', 'Pesan masih tersegel. Belum bisa dibaca.'));
      }
      return card;
    }

    var capsules = read(KEY_CAPSULES, []);
    var visible = capsules.filter(function (c) {
      if (c.owner === session.username) return true;
      return c.publik && isOpen(c);
    });

    visible.sort(function (a, b) {
      return a.tanggalKunci > b.tanggalKunci ? 1 : a.tanggalKunci < b.tanggalKunci ? -1 : 0;
    });

    visible.forEach(function (c) {
      wall.insertBefore(buildCard(c, c.owner === session.username), wall.firstChild);
    });
  }
})();
