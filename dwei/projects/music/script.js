const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const storage = {
  get(key, fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}},
  set(key, value){localStorage.setItem(key, JSON.stringify(value))}
};

let favorites = storage.get("drei_v2_favorites", []);
let playlists = storage.get("drei_v2_playlists", []);
let recent = storage.get("drei_v2_recent", []);
let history = storage.get("drei_v2_history", []);
let playCounts = storage.get("drei_v2_play_counts", {});
let currentTrack = null;
let currentQueue = [];
let currentIndex = -1;
let pendingPlaylistTrack = null;

const audio = $("#audio");
const player = $("#player");
const searchResults = $("#searchResults");
const featuredGrid = $("#featuredGrid");

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[m]);
}

function compactTrack(track){
  return {
    id: track.id,
    title: track.title || track.title_short || "Unknown track",
    preview: track.preview || "",
    artist: track.artist?.name || track.artist || "Unknown artist",
    cover: track.album?.cover_big || track.album?.cover_medium || track.cover || "",
    album: track.album?.title || track.album || "Unknown album"
  };
}

function isFavorite(id){
  return favorites.some(t => String(t.id) === String(id));
}

function showToast(message){
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function formatTime(value){
  if(!Number.isFinite(value)) return "0:00";
  const min = Math.floor(value / 60);
  const sec = Math.floor(value % 60);
  return `${min}:${String(sec).padStart(2,"0")}`;
}

function cardTemplate(raw){
  const t = compactTrack(raw);
  const packed = encodeURIComponent(JSON.stringify(t));
  return `
  <article class="music-card">
    <div class="cover">
      <img src="${esc(t.cover)}" alt="${esc(t.title)} album cover" loading="lazy">
      <button class="cover-play" data-play="${packed}" aria-label="Play ${esc(t.title)}">▶</button>
    </div>
    <div class="card-copy">
      <h3 title="${esc(t.title)}">${esc(t.title)}</h3>
      <p title="${esc(t.artist)}">${esc(t.artist)}</p>
      <div class="card-actions">
        <button class="action-dark" data-play="${packed}">Preview</button>
        <button class="action-pink" data-favorite="${packed}">${isFavorite(t.id) ? "Saved" : "Favorite"}</button>
        <button class="action-soft" data-add="${packed}">+ Playlist</button>
      </div>
    </div>
  </article>`;
}

function bindCards(root, queue = []){
  root.querySelectorAll("[data-play]").forEach(btn => {
    btn.onclick = () => {
      const track = JSON.parse(decodeURIComponent(btn.dataset.play));
      const q = queue.map(compactTrack);
      const index = q.findIndex(t => String(t.id) === String(track.id));
      playTrack(track, q.length ? q : [track], index >= 0 ? index : 0);
    };
  });

  root.querySelectorAll("[data-favorite]").forEach(btn => {
    btn.onclick = () => {
      const track = JSON.parse(decodeURIComponent(btn.dataset.favorite));
      const index = favorites.findIndex(t => String(t.id) === String(track.id));
      if(index >= 0){
        favorites.splice(index, 1);
        showToast("Removed from favorites");
      }else{
        favorites.unshift(track);
        showToast("Added to favorites");
      }
      storage.set("drei_v2_favorites", favorites);
      renderFavorites();
      renderStats();
      refreshVisibleCards();
    };
  });

  root.querySelectorAll("[data-add]").forEach(btn => {
    btn.onclick = () => {
      pendingPlaylistTrack = JSON.parse(decodeURIComponent(btn.dataset.add));
      openAddModal();
    };
  });
}

function refreshVisibleCards(){
  $$("#searchResults [data-favorite], #featuredGrid [data-favorite]").forEach(btn => {
    const track = JSON.parse(decodeURIComponent(btn.dataset.favorite));
    btn.textContent = isFavorite(track.id) ? "Saved" : "Favorite";
  });
}

function jsonpSearch(query, limit = 24){
  return new Promise((resolve, reject) => {
    const callback = `dreiCallback_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => cleanup(new Error("Request timed out")), 12000);

    function cleanup(error){
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if(error) reject(error);
    }

    window[callback] = data => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = () => cleanup(new Error("Unable to connect to Deezer"));
    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&output=jsonp&callback=${callback}`;
    document.body.appendChild(script);
  });
}

async function searchMusic(query){
  query = query.trim();
  if(!query) return;

  switchView("search");
  $("#searchInput").value = query;
  $("#searchTitle").textContent = `Results for “${query}”`;
  $("#searchStatus").textContent = "Searching...";
  searchResults.innerHTML = Array.from({length:8}, () => '<div class="skeleton"></div>').join("");
  addHistory(query);

  try{
    const response = await jsonpSearch(query);
    const tracks = Array.isArray(response.data) ? response.data : [];
    $("#searchStatus").textContent = `${tracks.length} result${tracks.length === 1 ? "" : "s"}`;

    if(!tracks.length){
      searchResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">?</div>
          <h3>No results found</h3>
          <p>Try another title, artist or album.</p>
        </div>`;
      return;
    }

    searchResults.innerHTML = tracks.map(cardTemplate).join("");
    bindCards(searchResults, tracks);
  }catch(error){
    $("#searchStatus").textContent = "Connection error";
    searchResults.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Music service unavailable</h3>
        <p>Check your internet connection and open the site through GitHub Pages, Netlify, Cloudflare Pages or Live Server.</p>
      </div>`;
  }
}

async function loadFeatured(){
  featuredGrid.innerHTML = Array.from({length:8}, () => '<div class="skeleton"></div>').join("");
  try{
    const response = await jsonpSearch("top hits", 8);
    const tracks = Array.isArray(response.data) ? response.data : [];
    featuredGrid.innerHTML = tracks.map(cardTemplate).join("");
    bindCards(featuredGrid, tracks);
  }catch{
    featuredGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♫</div>
        <h3>Search to discover music</h3>
        <p>The featured feed could not load, but search may still work.</p>
      </div>`;
  }
}

function playTrack(track, queue = [track], index = 0){
  if(!track.preview){
    showToast("No preview is available for this track");
    return;
  }

  currentTrack = compactTrack(track);
  currentQueue = queue.map(compactTrack);
  currentIndex = Math.max(0, index);

  audio.src = currentTrack.preview;
  $("#playerCover").src = currentTrack.cover;
  $("#playerTitle").textContent = currentTrack.title;
  $("#playerArtist").textContent = currentTrack.artist;
  player.classList.add("show");

  addRecent(currentTrack);
  playCounts[currentTrack.artist] = (playCounts[currentTrack.artist] || 0) + 1;
  storage.set("drei_v2_play_counts", playCounts);
  renderStats();

  audio.play()
    .then(() => $("#playPauseBtn").textContent = "❚❚")
    .catch(() => showToast("Press play to start the preview"));
}

function playRelative(offset){
  if(!currentQueue.length) return;
  let next = currentIndex + offset;
  if(next < 0) next = currentQueue.length - 1;
  if(next >= currentQueue.length) next = 0;
  currentIndex = next;
  playTrack(currentQueue[currentIndex], currentQueue, currentIndex);
}

function addRecent(track){
  recent = [track, ...recent.filter(t => String(t.id) !== String(track.id))].slice(0, 30);
  storage.set("drei_v2_recent", recent);
  renderRecent();
}

function addHistory(query){
  history = [query, ...history.filter(item => item.toLowerCase() !== query.toLowerCase())].slice(0, 10);
  storage.set("drei_v2_history", history);
  renderHistory();
}

function renderFavorites(){
  const grid = $("#favoritesGrid");
  if(!favorites.length){
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♥</div>
        <h3>No favorites yet</h3>
        <p>Save tracks from the search results to build your library.</p>
      </div>`;
    return;
  }
  grid.innerHTML = favorites.map(cardTemplate).join("");
  bindCards(grid, favorites);
}

function renderRecent(){
  const home = $("#homeRecent");
  const table = $("#recentTable");

  if(!recent.length){
    home.innerHTML = '<div class="mini-track"><div><strong>No recent tracks</strong><span>Play a preview to get started.</span></div></div>';
    table.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <h3>No listening history yet</h3>
        <p>Your recent previews will appear here.</p>
      </div>`;
    return;
  }

  home.innerHTML = recent.slice(0, 8).map(t => `
    <button class="mini-track" data-mini-play="${encodeURIComponent(JSON.stringify(t))}">
      <img src="${esc(t.cover)}" alt="">
      <div><strong>${esc(t.title)}</strong><span>${esc(t.artist)}</span></div>
    </button>`).join("");

  home.querySelectorAll("[data-mini-play]").forEach(btn => {
    btn.onclick = () => {
      const t = JSON.parse(decodeURIComponent(btn.dataset.miniPlay));
      const index = recent.findIndex(x => String(x.id) === String(t.id));
      playTrack(t, recent, index);
    };
  });

  table.innerHTML = recent.map((t, index) => `
    <div class="track-row">
      <img src="${esc(t.cover)}" alt="">
      <div><strong>${esc(t.title)}</strong><br><span>${esc(t.artist)}</span></div>
      <span>${esc(t.album)}</span>
      <button data-recent-play="${index}">▶</button>
    </div>`).join("");

  table.querySelectorAll("[data-recent-play]").forEach(btn => {
    btn.onclick = () => {
      const index = Number(btn.dataset.recentPlay);
      playTrack(recent[index], recent, index);
    };
  });
}

function renderHistory(){
  const box = $("#historyChips");
  if(!history.length){
    box.innerHTML = "<span>No searches yet.</span>";
    return;
  }
  box.innerHTML = history.map(q => `<button data-history="${esc(q)}">${esc(q)}</button>`).join("");
  box.querySelectorAll("[data-history]").forEach(btn => btn.onclick = () => searchMusic(btn.dataset.history));
}

function renderStats(){
  $("#statPlays").textContent = Object.values(playCounts).reduce((a,b) => a+b, 0);
  $("#statFavorites").textContent = favorites.length;
  $("#statPlaylists").textContent = playlists.length;

  const top = Object.entries(playCounts).sort((a,b) => b[1]-a[1])[0];
  $("#statArtist").textContent = top ? top[0] : "—";
}

function renderPlaylists(){
  const grid = $("#playlistGrid");

  if(!playlists.length){
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">▤</div>
        <h3>No playlists yet</h3>
        <p>Create your first playlist and add tracks from search results.</p>
      </div>`;
    return;
  }

  grid.innerHTML = playlists.map((playlist, index) => `
    <article class="playlist-card">
      <h3>${esc(playlist.name)}</h3>
      <p>${playlist.tracks.length} track${playlist.tracks.length === 1 ? "" : "s"}</p>
      <div class="playlist-actions">
        <button class="action-pink" data-open-playlist="${index}">Open</button>
        <button class="action-soft" data-delete-playlist="${index}">Delete</button>
      </div>
    </article>`).join("");

  grid.querySelectorAll("[data-open-playlist]").forEach(btn => {
    btn.onclick = () => openPlaylist(Number(btn.dataset.openPlaylist));
  });

  grid.querySelectorAll("[data-delete-playlist]").forEach(btn => {
    btn.onclick = () => {
      const index = Number(btn.dataset.deletePlaylist);
      if(confirm(`Delete “${playlists[index].name}”?`)){
        playlists.splice(index, 1);
        storage.set("drei_v2_playlists", playlists);
        renderPlaylists();
        renderStats();
      }
    };
  });
}

function openPlaylist(index){
  const playlist = playlists[index];
  $("#playlistsView .playlist-grid").innerHTML = `
    <div style="grid-column:1/-1">
      <button class="text-button" id="backPlaylists">← Back to playlists</button>
      <div class="page-header">
        <span class="section-kicker">PLAYLIST</span>
        <h1>${esc(playlist.name)}</h1>
        <p>${playlist.tracks.length} track${playlist.tracks.length === 1 ? "" : "s"}</p>
      </div>
      <div class="track-table">
        ${playlist.tracks.length ? playlist.tracks.map((t, i) => `
          <div class="track-row">
            <img src="${esc(t.cover)}" alt="">
            <div><strong>${esc(t.title)}</strong><br><span>${esc(t.artist)}</span></div>
            <span>${esc(t.album)}</span>
            <button data-pl-play="${i}">▶</button>
          </div>`).join("") : `
          <div class="empty-state"><div class="empty-icon">♫</div><h3>This playlist is empty</h3><p>Add tracks from any music card.</p></div>`}
      </div>
    </div>`;

  $("#backPlaylists").onclick = renderPlaylists;
  $$("#playlistsView [data-pl-play]").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.plPlay);
      playTrack(playlist.tracks[i], playlist.tracks, i);
    };
  });
}

function openAddModal(){
  const modal = $("#addModal");
  const choices = $("#playlistChoices");

  if(!playlists.length){
    choices.innerHTML = `<p style="color:var(--muted)">Create a playlist first.</p><button class="primary-btn full" id="createFromAdd">Create Playlist</button>`;
    $("#createFromAdd").onclick = () => {
      closeModal("#addModal");
      openModal("#playlistModal");
    };
  }else{
    choices.innerHTML = playlists.map((p, i) => `<button class="playlist-choice" data-choice="${i}">${esc(p.name)} · ${p.tracks.length} tracks</button>`).join("");
    choices.querySelectorAll("[data-choice]").forEach(btn => {
      btn.onclick = () => {
        const playlist = playlists[Number(btn.dataset.choice)];
        if(!playlist.tracks.some(t => String(t.id) === String(pendingPlaylistTrack.id))){
          playlist.tracks.push(pendingPlaylistTrack);
          storage.set("drei_v2_playlists", playlists);
          showToast(`Added to ${playlist.name}`);
        }else{
          showToast("Track is already in that playlist");
        }
        closeModal("#addModal");
        renderPlaylists();
      };
    });
  }

  openModal("#addModal");
}

function openModal(selector){
  const modal = $(selector);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
}

function closeModal(selector){
  const modal = $(selector);
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
}

function switchView(name){
  $$(".view").forEach(v => v.classList.remove("active"));
  $$(".nav-link").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  $(`#${name}View`).classList.add("active");
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0, behavior:"smooth"});
}

$$(".nav-link").forEach(btn => btn.onclick = () => switchView(btn.dataset.view));
$$("[data-view-link]").forEach(btn => btn.onclick = () => switchView(btn.dataset.viewLink));
$$("[data-open-search]").forEach(btn => btn.onclick = () => switchView("search"));

$("#heroSearchForm").onsubmit = e => {
  e.preventDefault();
  searchMusic($("#heroSearchInput").value);
};

$("#searchForm").onsubmit = e => {
  e.preventDefault();
  searchMusic($("#searchInput").value);
};

$$("[data-query]").forEach(btn => btn.onclick = () => searchMusic(btn.dataset.query));

$("#mobileMenu").onclick = () => $("#sidebar").classList.toggle("open");

$("#themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
  storage.set("drei_v2_dark", document.body.classList.contains("dark"));
};

$("#newPlaylistBtn").onclick = () => {
  $("#playlistName").value = "";
  openModal("#playlistModal");
  setTimeout(() => $("#playlistName").focus(), 50);
};

$("#savePlaylistBtn").onclick = () => {
  const name = $("#playlistName").value.trim();
  if(!name){
    showToast("Enter a playlist name");
    return;
  }
  playlists.push({id:Date.now(), name, tracks:[]});
  storage.set("drei_v2_playlists", playlists);
  closeModal("#playlistModal");
  renderPlaylists();
  renderStats();
  showToast("Playlist created");
};

$("#closeModal").onclick = () => closeModal("#playlistModal");
$("#closeAddModal").onclick = () => closeModal("#addModal");

$$(".modal").forEach(modal => {
  modal.addEventListener("click", e => {
    if(e.target === modal) closeModal(`#${modal.id}`);
  });
});

$("#playPauseBtn").onclick = () => {
  if(!audio.src) return;
  if(audio.paused) audio.play();
  else audio.pause();
};

$("#previousBtn").onclick = () => playRelative(-1);
$("#nextBtn").onclick = () => playRelative(1);

$("#closePlayer").onclick = () => {
  audio.pause();
  player.classList.remove("show");
};

$("#progress").oninput = e => {
  audio.currentTime = Number(e.target.value);
};

$("#volume").oninput = e => {
  audio.volume = Number(e.target.value);
};

audio.ontimeupdate = () => {
  $("#progress").max = audio.duration || 30;
  $("#progress").value = audio.currentTime || 0;
  $("#currentTime").textContent = formatTime(audio.currentTime);
  $("#duration").textContent = formatTime(audio.duration || 30);
};

audio.onplay = () => $("#playPauseBtn").textContent = "❚❚";
audio.onpause = () => $("#playPauseBtn").textContent = "▶";
audio.onended = () => playRelative(1);

document.body.classList.toggle("dark", storage.get("drei_v2_dark", false));
audio.volume = 0.8;

renderFavorites();
renderRecent();
renderPlaylists();
renderHistory();
renderStats();
loadFeatured();
