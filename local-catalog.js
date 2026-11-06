/* Browser-only music catalog. Audio files are stored only in this browser's IndexedDB. */
(function () {
  'use strict';
  const DB_NAME = 'iksa-player-catalog';
  const STORE_NAME = 'tracks';
  const defaultPlaylist = [{
    id: 0,
    title: 'Midnight Purr',
    artist: 'Lo-Fi Feline',
    genre: 'Lo-Fi',
    duration: 204,
    liked: true,
    cover: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  }];

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open local music storage.'));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Local storage operation failed.'));
    });
  }

  async function run(mode, action) {
    const db = await openDatabase();3
    try {
      const transaction = db.transaction(STORE_NAME, mode);
      const result = await action(transaction.objectStore(STORE_NAME));
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Local storage operation failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Local storage operation was cancelled.'));
      });
      return result;
    } finally {
      db.close();
    }
  }

  function makeId() {
    return window.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function list() {
    const tracks = await run('readonly', store => requestResult(store.getAll()));
    return tracks.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async function get(id) {
    return run('readonly', store => requestResult(store.get(id)));
  }

  async function save(track) {
    const record = { ...track, id: track.id || makeId(), local: true };
    await run('readwrite', store => requestResult(store.put(record)));
    return record;
  }

  async function remove(ids) {
    const uniqueIds = [...new Set(ids.map(String))];
    await run('readwrite', async store => {
      for (const id of uniqueIds) await requestResult(store.delete(id));
    });
  }

  async function readDuration(blob) {
    return new Promise(resolve => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(blob);
      const finish = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
      };
      audio.preload = 'metadata';
      audio.onloadedmetadata = finish;
      audio.onerror = finish;
      audio.src = url;
    });
  }

  function toPlayerTrack(track) {
    const audioUrl = track.audioBlob ? URL.createObjectURL(track.audioBlob) : '';
    const coverUrl = track.coverBlob ? URL.createObjectURL(track.coverBlob) : '';
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      duration: Number(track.duration) || 0,
      liked: Boolean(track.liked),
      cover: coverUrl || './iksa-logo.png',
      audio_url: audioUrl,
      isLocal: true,
      is_public: Boolean(track.isPublic),
      _objectUrls: [audioUrl, coverUrl].filter(Boolean)
    };
  }

  function revokeObjectUrls(track) {
    (track?._objectUrls || []).forEach(url => URL.revokeObjectURL(url));
  }

  window.IksaCatalog = { get, list, save, remove, makeId, readDuration, toPlayerTrack, revokeObjectUrls, defaultPlaylist };
})();
