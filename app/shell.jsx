/* global React */
(function(){
const { useState, useEffect, useRef } = React;
const { I } = window.DT;

// --- Data
const CASES = [
  { id: 'marketing', name: 'Marketing', caseno: '0142', color: 'var(--ember-500)', ini: 'M' },
  { id: 'launch', name: 'Launch · Q3', caseno: '0187', color: 'var(--lav-500)', ini: 'L' },
  { id: 'brand', name: 'Brand refresh', caseno: '0209', color: 'var(--mint-500)', ini: 'B' },
];
const CHATS = [
  { id: 'general', name: 'general', type: 'hash', unread: 0 },
  { id: 'q3-campaign', name: 'q3-campaign', type: 'hash', unread: 3 },
  { id: 'reel-cut', name: 'reel-cut', type: 'hash', unread: 0 },
  { id: 'founders', name: 'founders', type: 'lock', unread: 1 },
  { id: 'random', name: 'random', type: 'hash', unread: 0 },
];
const DMS = [
  { id: 'mia', name: 'Mia Kern', ini: 'MK', color: 'var(--lav-500)', status: 'online' },
  { id: 'rahul', name: 'Rahul Shah', ini: 'RS', color: 'var(--ember-500)', status: 'online' },
  { id: 'jae', name: 'Jae Lim', ini: 'JL', color: 'var(--mint-500)', status: 'away' },
  { id: 'sam', name: 'Sam Orellana', ini: 'SO', color: 'var(--blood-500)', status: 'offline' },
];

window.DT.DATA = { CASES, CHATS, DMS };

// --- Topbar (always visible above sidebar/main)
function Topbar({ currentCase, onOpenSearch, onToggleTheme, theme, unread, onNav }) {
  return (
    <div className="topbar">
      <div className="tb-logo">
        <img src="../assets/logo-monogram.svg" alt="DT"/>
        <span>Dev Thriller</span>
      </div>
      <div className="tb-case">
        <div className="dot" style={{background: currentCase.color}}>{currentCase.ini}</div>
        {currentCase.name}
        <span className="caseno">CASE · {currentCase.caseno}</span>
        <div style={{color:'var(--fg3)', display:'flex'}}>{I.chev}</div>
      </div>
      <div className="tb-search">
        <svg className="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <button className="trigger" onClick={onOpenSearch}>Search files, chats, people...</button>
        <span className="kbd">⌘K</span>
      </div>
      <div className="tb-right">
        <button className="tb-btn" title="Theme" onClick={onToggleTheme}>{theme === 'dark' ? I.sun : I.moon}</button>
        <button className="tb-btn" title="Inbox" onClick={() => onNav('inbox')}>
          {I.bell}{unread > 0 && <span className="dot"/>}
        </button>
        <button className="tb-btn" title="Settings" onClick={() => onNav('settings')}>{I.settings}</button>
        <div className="av av-sq" style={{marginLeft:4, background:'var(--ink-700)'}}>YO</div>
      </div>
    </div>
  );
}

// --- Sidebar (workspace nav + chats + DMs)
function Sidebar({ route, nav, chatId, openChat }) {
  const top = [
    { k: 'dashboard', label: 'Dashboard', ic: I.home },
    { k: 'inbox', label: 'Inbox', ic: I.inbox, count: 4, unread: true },
    { k: 'files', label: 'Files', ic: I.folder },
    { k: 'gallery', label: 'Gallery', ic: I.image },
    { k: 'player', label: 'Video review', ic: I.film },
    { k: 'people', label: 'People', ic: I.users },
  ];
  return (
    <aside className="sidebar">
      {top.map(t => (
        <div key={t.k} className={`sb-item${route === t.k ? ' active' : ''}${t.unread ? ' unread' : ''}`} onClick={() => nav(t.k)}>
          {t.ic}<span>{t.label}</span>
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </div>
      ))}

      <div className="sb-section">CHATS <span className="plus">{I.plus}</span></div>
      {CHATS.map(c => (
        <div key={c.id} className={`sb-item${route === 'chat' && chatId === c.id ? ' active' : ''}${c.unread ? ' unread' : ''}`} onClick={() => openChat(c.id)}>
          {c.type === 'lock' ? I.lock : I.hash}
          <span>{c.name}</span>
          {c.unread > 0 && <span className="count">{c.unread}</span>}
        </div>
      ))}

      <div className="sb-section">DIRECT MESSAGES <span className="plus">{I.plus}</span></div>
      {DMS.map(d => (
        <div key={d.id} className={`sb-item${route === 'chat' && chatId === d.id ? ' active' : ''}`} onClick={() => openChat(d.id)}>
          <div className="av" style={{background: d.color}}>{d.ini}</div>
          <span>{d.name}</span>
          {d.status === 'online' && <span style={{marginLeft:'auto', width:6, height:6, borderRadius:999, background:'var(--mint-500)'}}/>}
        </div>
      ))}
    </aside>
  );
}

// --- Top-nav variant
function TopNav({ route, nav }) {
  const items = [
    { k: 'dashboard', label: 'Dashboard', ic: I.home },
    { k: 'chat', label: 'Chats', ic: I.hash },
    { k: 'files', label: 'Files', ic: I.folder },
    { k: 'gallery', label: 'Gallery', ic: I.image },
    { k: 'player', label: 'Video review', ic: I.film },
    { k: 'inbox', label: 'Inbox', ic: I.inbox },
    { k: 'people', label: 'People', ic: I.users },
  ];
  return (
    <nav className="topnav">
      {items.map(t => (
        <div key={t.k} className={`nav-item${route === t.k ? ' active' : ''}`} onClick={() => nav(t.k)}>
          {t.ic}<span>{t.label}</span>
        </div>
      ))}
    </nav>
  );
}

window.DT.Shell = { Topbar, Sidebar, TopNav };
})();
