// auth-guard.js — protege todas as páginas exigindo token
// Carrega ANTES de sync.js. Se não houver token salvo, redireciona pra login.

(function(){
  'use strict';

  // Não roda em file:// nem na própria página de login
  if (location.protocol === 'file:') return;
  const path = location.pathname.toLowerCase();
  if (path.endsWith('/login.html') || path === '/login.html') return;

  const token = localStorage.getItem('envolve.auth.token');
  if (!token) {
    location.replace('login.html');
    return;
  }

  // Disponibiliza pro sync.js e qualquer outro código
  window.envolveAuthToken = token;

  // Logout helper global
  window.envolveLogout = function(){
    localStorage.removeItem('envolve.auth.token');
    location.replace('login.html');
  };
})();
