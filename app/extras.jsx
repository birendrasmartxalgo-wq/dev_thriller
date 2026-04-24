/* global React */
(function(){
const { useState, useEffect } = React;
const { I } = window.DT;

// ============================ SEARCH PALETTE (⌘K) ============================
const SEARCH_DATA = [
  { kind:'chat', icon:I.hash, name:'#q3-campaign', sub:'Marketing · 3 unread · 1,243 msgs', action:['chat','q3-campaign'] },
  { kind:'chat', icon:I.hash, name:'#reel-cut', sub:'Marketing · 892 msgs', action:['chat','reel-cut'] },
  { kind:'chat', icon:I.lock, name:'#founders', sub:'Marketing · 1 unread · Restricted', action:['chat','founders'] },
  { kind:'dm', icon:I.user, name:'Mia Kern', sub:'Direct messages · Online', action:['chat','mia'] },
  { kind:'dm', icon:I.user, name:'Rahul Shah', sub:'Direct messages · Online', action:['chat','rahul'] },
  { kind:'file', icon:I.film, name:'reel-final-v4.mp4', sub:'842 MB · Uploading 62% · Rahul', action:['player'] },
  { kind:'file', icon:I.file, name:'moodboard.fig', sub:'22.3 MB · sha256 verified', action:['files'] },
  { kind:'file', icon:I.file, name:'q3-narrative.pdf', sub:'1.8 MB · Jane · yesterday', action:['files'] },
  { kind:'msg', icon:I.hash, name:'"cut 6s from the cold-open"', sub:'#q3-campaign · Rahul · 2 h ago', action:['chat','q3-campaign'] },
  { kind:'msg', icon:I.hash, name:'"sha256 verified"', sub:'#q3-campaign · Mia · 2 h ago', action:['chat','q3-campaign'] },
  { kind:'person', icon:I.user, name:'Jae Lim', sub:'Editor · Away · Last seen 12 min ago', action:['people'] },
  { kind:'action', icon:I.upload, name:'Upload a file', sub:'Open the chunked upload dialog', action:['files'] },
  { kind:'action', icon:I.settings, name:'Workspace settings', sub:'Manage members, billing, retention', action:['settings'] },
  { kind:'action', icon:I.kbd, name:'Keyboard shortcuts', sub:'Show the cheat sheet', action:['shortcuts'] },
];

function SearchPalette({ onClose, onNav }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const filtered = q ? SEARCH_DATA.filter(i => (i.name + i.sub).toLowerCase().includes(q.toLowerCase())) : SEARCH_DATA.slice(0, 8);
  const grouped = filtered.reduce((acc, i) => { (acc[i.kind] = acc[i.kind] || []).push(i); return acc; }, {});
  const flat = filtered;
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s+1, flat.length-1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
      if (e.key === 'Enter' && flat[sel]) { onNav(...flat[sel].action); onClose(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [flat, sel]);
  const labels = { chat:'Channels', dm:'Direct messages', file:'Files', msg:'Messages', person:'People', action:'Actions' };
  let idx = -1;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:620, marginTop:'-10vh'}}>
        <div style={{padding:'14px 16px', borderBottom:'1px solid var(--border-soft)', display:'flex', alignItems:'center', gap:10}}>
          {I.search}
          <input autoFocus placeholder="Search files, chats, people, actions..." value={q} onChange={e => setQ(e.target.value)} style={{flex:1, border:0, outline:0, background:'transparent', color:'var(--fg1)', font:'400 15px/1 var(--font-sans)'}}/>
          <span className="caseno">CASE · 0142</span>
          <kbd>esc</kbd>
        </div>
        <div style={{maxHeight:440, overflow:'auto', padding:6}}>
          {Object.entries(grouped).map(([k, items]) => (
            <div key={k}>
              <div style={{padding:'10px 12px 4px'}} className="caseno">{labels[k]}</div>
              {items.map(it => {
                idx++;
                const active = idx === sel;
                return (
                  <div key={it.name} onClick={() => { onNav(...it.action); onClose(); }} onMouseEnter={() => setSel(idx)} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:6, cursor:'pointer', background: active ? 'var(--ember-50)' : 'transparent', color: active ? 'var(--ember-700)' : 'var(--fg1)'}}>
                    <div style={{width:26, height:26, borderRadius:5, background: active ? 'var(--ember-500)' : 'var(--paper-100)', color: active ? '#fff' : 'var(--fg2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{it.icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{font:'500 13px/1.2 var(--font-sans)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{it.name}</div>
                      <div style={{font:'400 11px/1 var(--font-mono)', color: active ? 'var(--ember-700)' : 'var(--fg3)', marginTop:3}}>{it.sub}</div>
                    </div>
                    {active && <span style={{font:'500 10px/1 var(--font-mono)', color:'var(--fg3)'}}>↵ open</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <div className="empty" style={{padding:'40px 20px', minHeight:0}}><div className="title">No trail yet.</div><div className="sub">Try "reel", "rahul", "upload"...</div></div>}
        </div>
        <div style={{padding:'10px 14px', borderTop:'1px solid var(--border-soft)', display:'flex', alignItems:'center', gap:14, font:'500 11px/1 var(--font-mono)', color:'var(--fg3)'}}>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <div style={{flex:1}}/>
          <span>{flat.length} results · in 18 ms</span>
        </div>
      </div>
    </div>
  );
}

// ============================ SETTINGS ============================
function Settings() {
  const [tab, setTab] = useState('profile');
  const [notif, setNotif] = useState({ mentions:true, all:false, dm:true, digest:true, push:false });
  const tabs = [
    { k:'profile', l:'Profile', ic:I.user },
    { k:'notifications', l:'Notifications', ic:I.bell },
    { k:'security', l:'Security', ic:I.shield },
    { k:'workspace', l:'Workspace', ic:I.globe },
    { k:'billing', l:'Billing', ic:I.tag },
    { k:'integrations', l:'Integrations', ic:I.link },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · SETTINGS</div>
          <h1>Settings</h1>
          <div className="sub">Workspace admins see all tabs. You're an Owner.</div>
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:0, padding:'16px 0 0'}}>
        <aside style={{padding:'0 12px 16px 24px', display:'grid', gap:2, alignContent:'start'}}>
          {tabs.map(t => (
            <div key={t.k} className={`sb-item${tab===t.k?' active':''}`} onClick={() => setTab(t.k)}>{t.ic}<span>{t.l}</span></div>
          ))}
        </aside>
        <div style={{padding:'0 24px 32px', maxWidth:720}}>
          {tab === 'profile' && (
            <div style={{display:'grid', gap:22}}>
              <div className="card">
                <div className="card-hd"><h3>Photo & name</h3></div>
                <div style={{display:'flex', alignItems:'center', gap:16}}>
                  <div className="av av-xl" style={{background:'var(--ember-500)'}}>JD</div>
                  <div style={{flex:1, display:'grid', gap:10}}>
                    <div style={{display:'flex', gap:6}}><button className="btn btn-secondary">Upload</button><button className="btn btn-ghost">Remove</button></div>
                    <div className="hint">SVG, PNG, JPG · 1 MB max</div>
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:14}}>
                  <div className="field"><label>Name</label><input className="input" defaultValue="Jane Director"/></div>
                  <div className="field"><label>Pronouns</label><input className="input" defaultValue="she/her"/></div>
                  <div className="field"><label>Role</label><input className="input" defaultValue="Director of Content"/></div>
                  <div className="field"><label>Timezone</label><select className="input" defaultValue="PT"><option>PT</option><option>ET</option><option>GMT</option><option>CET</option></select></div>
                </div>
              </div>
              <div className="card">
                <div className="card-hd"><h3>Status</h3></div>
                <div className="field"><label>Current status</label>
                  <div style={{display:'flex', gap:10, marginTop:4}}>
                    <input className="input" defaultValue="Cutting the Q3 reel" style={{flex:1}}/>
                    <button className="btn btn-secondary">🎬 Emoji</button>
                  </div>
                </div>
                <div style={{display:'flex', gap:8, marginTop:10}}>
                  {['30 min','1 h','4 h','Today'].map(x => <button key={x} className="btn btn-ghost" style={{padding:'4px 10px', border:'1px solid var(--border-soft)'}}>{x}</button>)}
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div style={{display:'grid', gap:22}}>
              <div className="card">
                <div className="card-hd"><h3>What wakes the dogs</h3><span className="caseno">PER-CHAT OVERRIDES AVAILABLE</span></div>
                <div style={{display:'grid', gap:10}}>
                  {[
                    ['mentions','Direct mentions & replies','@you, replies to your messages'],
                    ['all','All new messages','Every chat you\'re in. Loud.'],
                    ['dm','Direct messages','Always notify, even on Do Not Disturb'],
                    ['digest','Daily digest email','08:30 local, summary only'],
                    ['push','Mobile push','Via APNS / FCM'],
                  ].map(([k,t,s]) => (
                    <label key={k} className={`toggle${notif[k]?' on':''}`} onClick={() => setNotif(n => ({...n, [k]: !n[k]}))} style={{justifyContent:'space-between', padding:'10px 0', borderTop:'1px solid var(--border-soft)'}}>
                      <div><div style={{font:'500 13px/1.2 var(--font-sans)'}}>{t}</div><div className="hint">{s}</div></div>
                      <div className="toggle-sw"/>
                    </label>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-hd"><h3>Do Not Disturb</h3></div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div className="field"><label>From</label><input className="input" type="time" defaultValue="22:00"/></div>
                  <div className="field"><label>Until</label><input className="input" type="time" defaultValue="08:00"/></div>
                </div>
                <div className="hint" style={{marginTop:10}}>Mentions from <strong>#founders</strong> bypass DND.</div>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div style={{display:'grid', gap:22}}>
              <div className="card">
                <div className="card-hd"><h3>Password</h3><span className="chip success"><span className="dot"/>STRONG</span></div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12}}>
                  <div className="field"><label>Current</label><input className="input" type="password" defaultValue="••••••••"/></div>
                  <div className="field"><label>New</label><input className="input" type="password"/></div>
                  <div className="field"><label>Confirm</label><input className="input" type="password"/></div>
                </div>
                <div style={{marginTop:14, display:'flex', gap:8}}><button className="btn btn-primary">Update password</button></div>
              </div>
              <div className="card">
                <div className="card-hd"><h3>Two-factor auth</h3><span className="chip success"><span className="dot"/>ENABLED · TOTP</span></div>
                <div className="hint">Backup codes generated 32 days ago.</div>
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button className="btn btn-secondary">View backup codes</button>
                  <button className="btn btn-secondary">Re-enroll device</button>
                  <button className="btn btn-ghost" style={{color:'var(--blood-700)'}}>Disable</button>
                </div>
              </div>
              <div className="card">
                <div className="card-hd"><h3>Active sessions</h3><span className="caseno">3 DEVICES</span></div>
                <div style={{display:'grid', gap:6}}>
                  {[
                    ['MacBook Pro · Chrome','San Francisco · right now','this device','var(--mint-500)'],
                    ['iPhone 15 · DevThriller app','San Francisco · 12 min ago',null,'var(--lav-500)'],
                    ['Windows · Firefox','Brooklyn · 3 days ago',null,'var(--blood-500)'],
                  ].map(([n,loc,tag,c], i) => (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderTop: i===0?0:'1px solid var(--border-soft)'}}>
                      <div style={{width:32, height:32, borderRadius:6, background:c, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>{I.shield}</div>
                      <div style={{flex:1}}><div style={{font:'500 13px/1.2 var(--font-sans)'}}>{n}</div><div className="caseno" style={{marginTop:3, textTransform:'none', letterSpacing:0}}>{loc}</div></div>
                      {tag ? <span className="chip success"><span className="dot"/>{tag.toUpperCase()}</span> : <button className="btn btn-ghost" style={{color:'var(--blood-700)'}}>Revoke</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'workspace' && (
            <div style={{display:'grid', gap:22}}>
              <div className="card">
                <div className="card-hd"><h3>Workspace</h3></div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div className="field"><label>Name</label><input className="input" defaultValue="Acme Marketing"/></div>
                  <div className="field"><label>URL</label><input className="input" defaultValue="acme.devthriller.com"/></div>
                </div>
              </div>
              <div className="card">
                <div className="card-hd"><h3>Members</h3><span className="caseno">12 ACTIVE · 2 INVITED</span></div>
                <div style={{display:'flex', gap:6, marginBottom:10}}>
                  <input className="input" placeholder="Invite by email" style={{flex:1}}/>
                  <select className="input" style={{width:120}}><option>Member</option><option>Admin</option><option>Guest</option></select>
                  <button className="btn btn-primary">{I.plus} Invite</button>
                </div>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <tbody>
                    {[
                      ['Jane Director','JD','var(--ember-500)','Owner','you'],
                      ['Mia Kern','MK','var(--lav-500)','Admin','2 min ago'],
                      ['Rahul Shah','RS','var(--ember-500)','Member','online'],
                      ['Jae Lim','JL','var(--mint-500)','Member','12 min ago'],
                      ['Sam Orellana','SO','var(--blood-500)','Guest','3 d ago'],
                    ].map((m,i) => (
                      <tr key={i}>
                        <td style={{padding:'8px 0', borderTop:'1px solid var(--border-soft)', width:'40%'}}>
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            <div className="av" style={{background:m[2]}}>{m[1]}</div>
                            <strong>{m[0]}</strong>
                          </div>
                        </td>
                        <td style={{padding:'8px 0', borderTop:'1px solid var(--border-soft)'}}>
                          <select className="input" style={{padding:'3px 8px', width:100}} defaultValue={m[3]}><option>Owner</option><option>Admin</option><option>Member</option><option>Guest</option></select>
                        </td>
                        <td style={{padding:'8px 0', borderTop:'1px solid var(--border-soft)', color:'var(--fg3)'}}>{m[4]}</td>
                        <td style={{padding:'8px 0', borderTop:'1px solid var(--border-soft)', textAlign:'right'}}><button className="tb-btn">{I.moreH}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div className="card-hd"><h3>Retention</h3></div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div className="field"><label>Chat messages</label><select className="input" defaultValue="365"><option value="0">Forever</option><option value="365">365 days</option><option value="90">90 days</option></select></div>
                  <div className="field"><label>Files</label><select className="input" defaultValue="0"><option value="0">Forever</option><option value="730">2 years</option></select></div>
                </div>
                <div className="hint" style={{marginTop:10}}>Dry-run available in Admin → Retention. Destructive operations require 2-admin approval.</div>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div className="card">
              <div className="card-hd"><h3>Plan</h3><span className="chip"><span className="dot"/>PRO · TRIAL · 19 D LEFT</span></div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:8}}>
                {[
                  ['Free','$0','5 members · 5 GB · 14-day retention'],
                  ['Pro','$12','Unlimited · 1 TB · 1-year retention','current'],
                  ['Team','$32','SSO · Audit log · DSAR export'],
                ].map(([n,p,d,cur],i) => (
                  <div key={i} style={{padding:14, border:`1.5px solid ${cur?'var(--ember-500)':'var(--border-soft)'}`, borderRadius:10, background: cur ? 'var(--ember-50)':'var(--paper-0)'}}>
                    <div style={{font:'700 15px/1 var(--font-sans)'}}>{n}</div>
                    <div style={{font:'600 26px/1 var(--font-display)', marginTop:8}}>{p}<span style={{fontSize:13, color:'var(--fg3)', fontWeight:400}}>/mo</span></div>
                    <div className="hint" style={{marginTop:8}}>{d}</div>
                    {cur && <div className="caseno" style={{marginTop:10, color:'var(--ember-700)'}}>CURRENT</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'integrations' && (
            <div style={{display:'grid', gap:10}}>
              {[
                ['Slack','Mirror chats & notifications','#4A154B','connected'],
                ['GitHub','Attach commits and PRs','#24292F','connected'],
                ['Linear','Sync issues with threads','#5E6AD2',null],
                ['Figma','Embed frames, auto-update','#F24E1E','connected'],
                ['Google Drive','Mirror folders as case files','#4285F4',null],
              ].map(([n,d,c,s],i) => (
                <div key={i} className="card" style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px'}}>
                  <div style={{width:36, height:36, borderRadius:8, background:c, color:'#fff', font:'700 14px/1 var(--font-sans)', display:'flex', alignItems:'center', justifyContent:'center'}}>{n[0]}</div>
                  <div style={{flex:1}}><div style={{font:'600 14px/1.2 var(--font-sans)'}}>{n}</div><div className="hint">{d}</div></div>
                  {s ? <span className="chip success"><span className="dot"/>{s.toUpperCase()}</span> : null}
                  <button className="btn btn-secondary">{s ? 'Configure' : 'Connect'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================ NOTIFICATIONS INBOX ============================
function Inbox() {
  const [filter, setFilter] = useState('all');
  const [read, setRead] = useState({});
  const items = [
    { id:1, who:'Rahul Shah', ini:'RS', c:'var(--ember-500)', kind:'mention', verb:'mentioned you in', target:'#q3-campaign', body:'@jane can you review the director\'s cut?', time:'2 min ago', unread:true },
    { id:2, who:'Mia Kern', ini:'MK', c:'var(--lav-500)', kind:'reply', verb:'replied to your thread in', target:'#reel-cut', body:'Locked version pushed. sha256 verified.', time:'14 min ago', unread:true },
    { id:3, who:'System', ini:'✓', c:'var(--mint-500)', kind:'file', verb:'verified', target:'reel-final-v3.mp4', body:'sha256 ae44…c102 · integrity chain intact', time:'1 h ago', unread:true },
    { id:4, who:'Jae Lim', ini:'JL', c:'var(--mint-500)', kind:'dm', verb:'sent you a DM:', target:'', body:'Quick Q about the color grade - free for 5?', time:'2 h ago', unread:true },
    { id:5, who:'Sam Orellana', ini:'SO', c:'var(--blood-500)', kind:'file', verb:'shared', target:'voiceover-v2.zip', body:'With: #q3-campaign · Link expires in 7 days', time:'yesterday', unread:false },
    { id:6, who:'System', ini:'🔒', c:'var(--ink-700)', kind:'admin', verb:'revoked a share link for', target:'legal-draft.pdf', body:'Action by Jane (you) · Propagated in 2.1 s', time:'yesterday', unread:false },
    { id:7, who:'Mia Kern', ini:'MK', c:'var(--lav-500)', kind:'reaction', verb:'reacted 🔥 to your message in', target:'#general', body:'"Ship the director\'s cut by EOD?"', time:'2 days ago', unread:false },
  ];
  const filters = [['all','All',7],['mention','Mentions',1],['reply','Replies',1],['dm','DMs',1],['file','Files',2],['admin','Admin',1]];
  const filtered = filter === 'all' ? items : items.filter(i => i.kind === filter);
  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · INBOX</div>
          <h1>Inbox <span style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:400, color:'var(--fg3)', fontSize:20, marginLeft:8}}>4 unread</span></h1>
        </div>
        <button className="btn btn-secondary">Mark all read</button>
        <button className="btn btn-ghost">{I.settings}</button>
      </div>
      <div className="page-body" style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:20}}>
        <aside style={{display:'grid', gap:2, alignContent:'start'}}>
          {filters.map(([k,l,c]) => (
            <div key={k} className={`sb-item${filter===k?' active':''}`} onClick={() => setFilter(k)}>
              <span style={{flex:1}}>{l}</span>
              <span className="count" style={{fontFamily:'var(--font-mono)'}}>{c}</span>
            </div>
          ))}
        </aside>
        <div style={{display:'grid', gap:8}}>
          {filtered.map(n => {
            const seen = read[n.id] ?? !n.unread;
            return (
              <div key={n.id} onClick={() => setRead(r => ({...r, [n.id]: true}))} style={{display:'grid', gridTemplateColumns:'36px 1fr auto', gap:12, padding:'14px', border:'1px solid var(--border-soft)', borderRadius:10, background: seen ? 'var(--paper-0)' : 'var(--ember-50)', cursor:'pointer', borderLeft: seen ? '1px solid var(--border-soft)' : '3px solid var(--ember-500)'}}>
                <div className="av av-lg" style={{background:n.c, width:36, height:36}}>{n.ini}</div>
                <div>
                  <div style={{font:'400 13px/1.4 var(--font-sans)'}}>
                    <strong>{n.who}</strong> <span style={{color:'var(--fg2)'}}>{n.verb}</span> {n.target && <span style={{color:'var(--ember-700)', fontFamily:'var(--font-mono)', fontSize:12}}>{n.target}</span>}
                  </div>
                  <div style={{font:'400 13px/1.5 var(--font-sans)', color:'var(--fg1)', marginTop:4, background: seen ? 'transparent' : 'rgba(255,253,248,.6)', padding: seen ? 0 : '4px 8px', borderRadius:4}}>{n.body}</div>
                </div>
                <div style={{textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6}}>
                  <span className="caseno">{n.time.toUpperCase()}</span>
                  {!seen && <span style={{width:8, height:8, borderRadius:999, background:'var(--ember-500)'}}/>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================ SHORTCUTS CHEAT SHEET ============================
function Shortcuts({ onClose }) {
  const groups = [
    { title:'Navigation', items:[
      [['⌘','K'],'Global search'],
      [['G','H'],'Go to dashboard'],
      [['G','F'],'Go to files'],
      [['G','I'],'Go to inbox'],
      [['⌘','['],'Back'],
      [['⌘',']'],'Forward'],
    ]},
    { title:'Chat', items:[
      [['↑'],'Edit last message'],
      [['⌘','↵'],'Send message'],
      [['⇧','↵'],'New line'],
      [['⌘','/'],'Slash menu'],
      [['T'],'Open thread panel'],
      [['⌘','.'],'Toggle sidebar'],
    ]},
    { title:'Files', items:[
      [['U'],'Upload file'],
      [['⌘','D'],'Download selected'],
      [['⌘','⇧','C'],'Copy share link'],
      [['⌫'],'Soft delete'],
      [['⌘','⇧','⌫'],'Hard delete'],
    ]},
    { title:'Workspace', items:[
      [['⌘',','],'Settings'],
      [['⌘','⇧','M'],'Toggle DND'],
      [['?'],'This cheat sheet'],
      [['⌘','⇧','L'],'Lock workspace'],
    ]},
  ];
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:720}}>
        <div style={{padding:'18px 22px', borderBottom:'1px solid var(--border-soft)', display:'flex', alignItems:'center', gap:10}}>
          <div className="caseno">CASE · 0142 · COMMAND REFERENCE</div>
          <div style={{flex:1}}/>
          <kbd>esc</kbd>
          <button className="tb-btn" onClick={onClose}>{I.x}</button>
        </div>
        <div style={{padding:'10px 22px 22px'}}>
          <h2 style={{font:'400 28px/1.1 var(--font-display)', margin:'10px 0 18px'}}>Keyboard <span style={{fontStyle:'italic'}}>shortcuts</span>.</h2>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:28}}>
            {groups.map(g => (
              <div key={g.title}>
                <div className="caseno" style={{marginBottom:8, color:'var(--ember-700)'}}>{g.title.toUpperCase()}</div>
                <div style={{display:'grid', gap:6}}>
                  {g.items.map((it,i) => (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px dashed var(--border-soft)'}}>
                      <span style={{font:'400 13px/1.4 var(--font-sans)', flex:1}}>{it[1]}</span>
                      <div style={{display:'flex', gap:4}}>{it[0].map((k,j) => <kbd key={j}>{k}</kbd>)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ PEOPLE ============================
function People() {
  const team = [
    {n:'Jane Director',ini:'JD',c:'var(--ember-500)',r:'Owner',s:'Online',e:'jane@acme.dev',dept:'Leadership'},
    {n:'Mia Kern',ini:'MK',c:'var(--lav-500)',r:'Admin',s:'Online',e:'mia@acme.dev',dept:'Creative'},
    {n:'Rahul Shah',ini:'RS',c:'var(--ember-500)',r:'Member',s:'Online',e:'rahul@acme.dev',dept:'Creative'},
    {n:'Jae Lim',ini:'JL',c:'var(--mint-500)',r:'Member',s:'Away',e:'jae@acme.dev',dept:'Engineering'},
    {n:'Sam Orellana',ini:'SO',c:'var(--blood-500)',r:'Guest',s:'Offline',e:'sam@contractor.dev',dept:'Audio'},
    {n:'Priya Vasquez',ini:'PV',c:'#D49900',r:'Member',s:'Online',e:'priya@acme.dev',dept:'Engineering'},
    {n:'Oskar Bloom',ini:'OB',c:'#17885A',r:'Member',s:'Away',e:'oskar@acme.dev',dept:'Product'},
    {n:'Hari Dey',ini:'HD',c:'#5E3DC7',r:'Member',s:'Online',e:'hari@acme.dev',dept:'Creative'},
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · PEOPLE</div>
          <h1>People <span style={{color:'var(--fg3)', fontFamily:'var(--font-mono)', fontSize:14, fontWeight:400, marginLeft:6}}>{team.length}</span></h1>
        </div>
        <input className="input" placeholder="Search people..." style={{width:220}}/>
        <button className="btn btn-primary">{I.plus} Invite</button>
      </div>
      <div className="page-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12}}>
        {team.map(m => (
          <div key={m.n} className="card" style={{padding:'16px', display:'grid', gap:10}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div className="av av-lg" style={{background:m.c}}>{m.ini}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <strong style={{fontSize:14}}>{m.n}</strong>
                  <span style={{width:6, height:6, borderRadius:999, background: m.s==='Online'?'var(--mint-500)':m.s==='Away'?'var(--ember-500)':'var(--fg3)'}}/>
                </div>
                <div className="caseno" style={{marginTop:3, textTransform:'none', letterSpacing:0, color:'var(--fg3)'}}>{m.r} · {m.dept}</div>
              </div>
            </div>
            <div style={{fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg3)', wordBreak:'break-all'}}>{m.e}</div>
            <div style={{display:'flex', gap:6}}>
              <button className="btn btn-secondary" style={{flex:1, justifyContent:'center'}}>Message</button>
              <button className="btn btn-ghost">{I.moreH}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.DT.ExtraMod = { SearchPalette, Settings, Inbox, Shortcuts, People };
})();
