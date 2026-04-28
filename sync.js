// sync.js — Sincronização com Netlify Blobs (storage compartilhado da equipe)
// Intercepta localStorage de chaves "compartilhadas" e replica pra nuvem
// Tokens de API (privados) continuam APENAS no navegador local

(function(){
  'use strict';

  // ===== CHAVES COMPARTILHADAS (dados de negócio) =====
  // Estas vão pro cloud — todos da equipe veem
  const SHARED_KEYS = [
    'envolve.comercial.v1',           // Carteira & Pipeline
    'envolve.socialselling.v1',       // Atividades diárias SS
    'envolve.socialselling.leads.v1', // Cadastro de leads SS
    'envolve.socialselling.goals.v1', // Metas SS
    'envolve.leads-propostas.v1',     // Comercial Leads & Propostas
    'controle.financeiro.v1'          // Transações financeiras
  ];

  // ===== CHAVES PRIVADAS (NUNCA vão pro cloud) =====
  // Tokens de API ficam SÓ no navegador de quem configurou
  // const PRIVATE_KEYS = [
  //   'envolve.trafego.v2',     // Token Meta
  //   'envolve.clickup.v1',     // Token ClickUp
  //   'envolve.asaas.v1',       // API Key Asaas
  //   'envolve.kommo.v1',       // Token Kommo
  //   'envolve.insights.v1',    // API Key IA (Claude/OpenAI/Gemini)
  //   'envolve.noticias.v1'     // Cache de notícias (não vale sincronizar)
  // ];

  const API = '/.netlify/functions/store';
  const isFile = location.protocol === 'file:';

  // Se rodando local (file://), não faz sync — usa só localStorage
  if (isFile) {
    console.log('[Envolve sync] Rodando local — sync desabilitado');
    return;
  }

  // ===== Auth header helper =====
  function authHeaders(extra){
    const t = window.envolveAuthToken || localStorage.getItem('envolve.auth.token');
    const base = extra ? { ...extra } : {};
    if (t) base['Authorization'] = 'Bearer ' + t;
    return base;
  }

  function handleAuthError(res){
    if (res && res.status === 401) {
      // Token inválido — força login
      localStorage.removeItem('envolve.auth.token');
      location.replace('login.html');
      return true;
    }
    return false;
  }

  // ===== Loading overlay =====
  const overlay = document.createElement('div');
  overlay.id = 'envolve-sync-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#0a0e1a;z-index:99999;display:flex;align-items:center;justify-content:center;color:#e8ecf3;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  overlay.innerHTML = `
    <div style="text-align:center;max-width:300px">
      <div style="font-size:13px;color:#7c5cff;margin-bottom:14px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">Sincronizando equipe</div>
      <div style="width:32px;height:32px;border:3px solid #252f44;border-top-color:#7c5cff;border-radius:50%;animation:envolve-sync-spin 1s linear infinite;margin:0 auto"></div>
      <div id="envolve-sync-msg" style="font-size:11px;color:#8b95a8;margin-top:14px;min-height:14px"></div>
    </div>
    <style>@keyframes envolve-sync-spin{to{transform:rotate(360deg)}}</style>
  `;
  function showOverlay(){
    if (document.body) document.body.appendChild(overlay);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
  }
  function hideOverlay(){
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .25s';
    setTimeout(() => overlay.remove(), 250);
  }
  function setOverlayMsg(m){
    const el = document.getElementById('envolve-sync-msg');
    if (el) el.textContent = m;
  }
  showOverlay();

  // ===== INTERCEPTOR de localStorage =====
  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;
  const pendingPushes = new Map(); // key → value
  let pushTimer = null;

  function schedulePush(){
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPushes, 600);
  }

  async function flushPushes(){
    if (!pendingPushes.size) return;
    const items = Array.from(pendingPushes.entries());
    pendingPushes.clear();
    for (const [key, value] of items) {
      try {
        const res = await fetch(`${API}?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: value || 'null'
        });
        if (handleAuthError(res)) return;
        // Marca último push pra mostrar na UI
        window.envolveLastPush = { key, at: Date.now() };
      } catch (e) {
        console.warn('[Envolve sync] push falhou:', key, e);
      }
    }
  }

  Storage.prototype.setItem = function(key, value){
    origSet.call(this, key, value);
    if (this === window.localStorage && SHARED_KEYS.includes(key)) {
      pendingPushes.set(key, value);
      schedulePush();
    }
  };

  Storage.prototype.removeItem = function(key){
    origRemove.call(this, key);
    if (this === window.localStorage && SHARED_KEYS.includes(key)) {
      // Push null pra limpar do cloud
      pendingPushes.set(key, 'null');
      schedulePush();
    }
  };

  // ===== PULL inicial =====
  async function pullAll(){
    setOverlayMsg('Buscando dados da equipe...');
    try {
      const url = `${API}?batch=1&keys=${SHARED_KEYS.map(encodeURIComponent).join(',')}`;
      const r = await fetch(url, { headers: authHeaders() });
      if (handleAuthError(r)) return 0;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      let count = 0;
      for (const key of SHARED_KEYS) {
        if (data[key] !== undefined && data[key] !== null) {
          // Usa origSet pra NÃO disparar o interceptor (evita loop de push)
          origSet.call(localStorage, key, JSON.stringify(data[key]));
          count++;
        }
      }
      window.envolveLastPull = Date.now();

      // ===== SEED automático =====
      // Se cloud estiver completamente vazio (primeiro deploy), tenta carregar seed-data.json
      // e popular o cloud automaticamente. Roda só 1 vez.
      if (count === 0 && !localStorage.getItem('envolve.seed.applied')) {
        setOverlayMsg('Inicializando dados...');
        try {
          const seedRes = await fetch('seed-data.json');
          if (seedRes.ok) {
            const seed = await seedRes.json();
            for (const key of SHARED_KEYS) {
              if (seed[key]) {
                origSet.call(localStorage, key, JSON.stringify(seed[key]));
                // Push pro cloud
                const pushRes = await fetch(`${API}?key=${encodeURIComponent(key)}`, {
                  method: 'POST',
                  headers: authHeaders({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify(seed[key])
                });
                if (handleAuthError(pushRes)) return count;
                count++;
              }
            }
            origSet.call(localStorage, 'envolve.seed.applied', new Date().toISOString());
            setOverlayMsg(`Dados iniciais carregados (${count} módulos)`);
          }
        } catch (seedErr) {
          console.warn('[Envolve sync] seed falhou:', seedErr);
        }
      } else {
        setOverlayMsg(`${count} módulo${count===1?'':'s'} sincronizado${count===1?'':'s'}`);
      }
      return count;
    } catch (e) {
      console.warn('[Envolve sync] pull falhou:', e);
      setOverlayMsg('Erro de sincronização (modo offline)');
      return 0;
    }
  }

  // ===== API Pública =====
  window.envolveSync = {
    pullAll,
    flushPushes,
    SHARED_KEYS,
    isOnline: () => navigator.onLine,
    forceRefresh: async () => {
      await flushPushes();
      const count = await pullAll();
      location.reload();
      return count;
    }
  };

  // Roda o pull e libera o app
  pullAll().finally(() => {
    setTimeout(hideOverlay, 350);
  });

  // Auto-flush ao sair (envia tudo que ficou pendente)
  // Usa fetch com keepalive — sendBeacon não suporta headers customizados
  window.addEventListener('beforeunload', () => {
    if (!pendingPushes.size) return;
    for (const [key, value] of pendingPushes.entries()) {
      try {
        fetch(`${API}?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: value || 'null',
          keepalive: true
        });
      } catch (e) { /* página tá saindo, ignora */ }
    }
  });

  // Pull periódico a cada 60s pra pegar mudanças de outros usuários
  setInterval(() => {
    pullAll();
  }, 60000);
})();
