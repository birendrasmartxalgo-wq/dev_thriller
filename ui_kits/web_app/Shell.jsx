/* global React */
(function(){
const { useState } = React;

// --- Icons (Lucide-style inline SVGs) ---
const Icon = ({ d, size = 20, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className="icon" {...rest}
       dangerouslySetInnerHTML={{ __html: d }} />
);
const I = {
  hash: <Icon d='<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>' />,
  lock: <Icon d='<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' />,
  folder: <Icon d='<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>' />,
  file: <Icon d='<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>' />,
  search: <Icon d='<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>' />,
  bell: <Icon d='<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>' />,
  plus: <Icon d='<path d="M12 5v14M5 12h14"/>' />,
  chevron: <Icon d='<path d="m6 9 6 6 6-6"/>' size={16}/>,
  image: <Icon d='<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>' />,
  film: <Icon d='<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 7h4M3 11h4M3 15h4M3 19h4M17 7h4M17 11h4M17 15h4M17 19h4"/>' />,
  paperclip: <Icon d='<path d="m21 12-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8"/>' />,
  atSign: <Icon d='<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>' />,
  smile: <Icon d='<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>' />,
  send: <Icon d='<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>' size={16}/>,
  mic: <Icon d='<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>' size={16}/>,
  users: <Icon d='<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' />,
  check: <Icon d='<path d="m5 12 5 5L20 7"/>' size={14} />,
  x: <Icon d='<path d="M18 6 6 18M6 6l12 12"/>' size={14} />,
  moreH: <Icon d='<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>' />,
  pin: <Icon d='<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' size={14} />,
  link: <Icon d='<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' />,
};

// --- Sidebar nav ---
function Sidebar({ activeChat, setActiveChat, view, setView }) {
  const chats = [
    { id: 'general', name: 'general', type: 'hash', unread: 0 },
    { id: 'q3-campaign', name: 'q3-campaign', type: 'hash', unread: 3 },
    { id: 'reel-cut', name: 'reel-cut', type: 'hash', unread: 0 },
    { id: 'founders', name: 'founders', type: 'lock', unread: 1 },
  ];
  const projects = [
    { id: 'marketing', name: 'Marketing', case: 'CASE · 0142' },
    { id: 'launch', name: 'Launch · Q3', case: 'CASE · 0187' },
    { id: 'brand', name: 'Brand refresh', case: 'CASE · 0201' },
  ];
  return (
    <aside className="sidebar">
      <div className="side-section">Workspace <span className="plus">{I.plus}</span></div>
      <div className={'side-item ' + (view==='inbox'?'active':'')} onClick={()=>setView('inbox')}>{I.bell}<span>Inbox</span><span className="count">12</span></div>
      <div className={'side-item ' + (view==='files'?'active':'')} onClick={()=>setView('files')}>{I.folder}<span>Files</span></div>
      <div className={'side-item ' + (view==='people'?'active':'')} onClick={()=>setView('people')}>{I.users}<span>People</span></div>

      <div className="side-section">Projects <span className="plus">{I.plus}</span></div>
      {projects.map(p => (
        <div key={p.id} className="side-item">
          <div style={{width:18, height:18, borderRadius:5, background:'var(--lav-500)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, fontWeight:700}}>{p.name[0]}</div>
          <span>{p.name}</span>
        </div>
      ))}

      <div className="side-section">Channels <span className="plus">{I.plus}</span></div>
      {chats.map(c => (
        <div key={c.id}
             className={'side-item ' + (activeChat===c.id && view==='chat' ? 'active ' : '') + (c.unread ? 'unread ' : '')}
             onClick={()=>{ setActiveChat(c.id); setView('chat'); }}>
          {c.type==='hash' ? I.hash : I.lock}
          <span>{c.name}</span>
          {c.unread > 0 && <span className="count">{c.unread}</span>}
        </div>
      ))}

      <div className="side-section">Direct messages <span className="plus">{I.plus}</span></div>
      {[
        {n:'Rahul Shah', c:'var(--ember-500)', i:'RS', st:true},
        {n:'Mia Kern',   c:'var(--lav-500)',   i:'MK'},
        {n:'Jae Lim',    c:'var(--mint-500)',  i:'JL', st:true},
      ].map(u => (
        <div key={u.i} className="side-item">
          <div className="av av-sm" style={{background:u.c, position:'relative'}}>{u.i}
            {u.st && <span style={{position:'absolute',right:-1,bottom:-1,width:7,height:7,borderRadius:999,background:'var(--mint-500)',border:'1.5px solid var(--paper-100)'}}/>}
          </div>
          <span>{u.n}</span>
        </div>
      ))}
    </aside>
  );
}

// --- Topbar ---
function Topbar() {
  return (
    <header className="topbar">
      <div className="logo">
        <img src="../../assets/logo-monogram.svg" alt="DT"/>
        <span>Dev Thriller</span>
      </div>
      <div className="workspace-sw">
        <div className="av av-sm" style={{background:'var(--ember-500)', borderRadius:6, width:20, height:20, fontSize:10}}>A</div>
        <span style={{font:'600 13px/1 var(--font-sans)'}}>Acme Marketing</span>
        {I.chevron}
      </div>
      <div className="topbar-search">
        {I.search}
        <input placeholder="Search files, chats, people…"/>
        <span className="kbd">⌘K</span>
      </div>
      <button className="btn btn-ghost" title="Notifications">{I.bell}</button>
      <div className="av" style={{background:'var(--ink-500)'}}>YO</div>
    </header>
  );
}

window.UIKit = { I, Icon, Sidebar, Topbar };
})();
