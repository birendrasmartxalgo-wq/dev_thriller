/* global React */
(function(){
const { useState, useEffect, useRef, useMemo } = React;
const { I } = window.DT;
const { CHATS, DMS } = window.DT.DATA;

// ============================ DASHBOARD ============================
function Dashboard({ nav }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · MARKETING · Q3</div>
          <h1>Good afternoon, Jane. <span style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:400}}>3 leads need you.</span></h1>
          <div className="sub">Last activity 4 min ago · 12 members · sha256 verified</div>
        </div>
        <button className="btn btn-primary">{I.plus} New chat</button>
        <button className="btn btn-secondary">{I.upload} Upload</button>
      </div>
      <div className="page-body" style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:16}}>
        <div style={{display:'grid', gap:16}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12}}>
            {[
              {n:'Active chats', v:'4', s:'+2 today', c:'var(--ember-500)'},
              {n:'Open threads', v:'11', s:'7 waiting', c:'var(--lav-500)'},
              {n:'Files locked', v:'38', s:'of 52', c:'var(--mint-500)'},
              {n:'Upload queue', v:'1', s:'62% · 842 MB', c:'var(--blood-500)'},
            ].map((s,i) => (
              <div key={i} className="card">
                <div className="caseno">{s.n.toUpperCase()}</div>
                <div style={{font:'700 28px/1.1 var(--font-sans)', marginTop:8, color:s.c}}>{s.v}</div>
                <div style={{color:'var(--fg3)', fontSize:12, marginTop:4}}>{s.s}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-hd"><h3>Recent activity</h3><span className="caseno">LIVE</span></div>
            <div style={{display:'grid', gap:10}}>
              {[
                ['RS','Rahul','locked','reel-final-v4.mp4','2 min ago','var(--ember-500)'],
                ['MK','Mia','verified sha256 on','moodboard.fig','14 min ago','var(--lav-500)'],
                ['JL','Jae','replied in','#q3-campaign / thread','31 min ago','var(--mint-500)'],
                ['SO','Sam','uploaded','voiceover-v2.zip','1 h ago','var(--blood-500)'],
              ].map((r,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: i===0?0:'1px solid var(--border-soft)'}}>
                  <div className="av" style={{background:r[5]}}>{r[0]}</div>
                  <div style={{flex:1, fontSize:13}}><strong>{r[1]}</strong> {r[2]} <span style={{color:'var(--ember-700)', fontFamily:'var(--font-mono)', fontSize:12}}>{r[3]}</span></div>
                  <div className="caseno">{r[4]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:'grid', gap:16}}>
          <div className="card">
            <div className="card-hd"><h3>Pinned chats</h3></div>
            <div style={{display:'grid', gap:6}}>
              {CHATS.slice(0,3).map(c => (
                <div key={c.id} onClick={() => nav('chat', c.id)} className="sb-item" style={{padding:'7px 8px'}}>
                  {c.type==='lock'?I.lock:I.hash}<span>{c.name}</span>
                  {c.unread>0 && <span className="count" style={{background:'var(--ember-500)', color:'#fff'}}>{c.unread}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-hd"><h3>Your queue</h3><span className="chip warn"><span className="dot"/>UPLOADING</span></div>
            <div style={{font:'600 14px/1.2 var(--font-sans)'}}>reel-final-v4.mp4</div>
            <div className="caseno" style={{marginTop:4, textTransform:'none', letterSpacing:0}}>CHUNK 64 / 105 · 522 / 842 MB</div>
            <div style={{height:4, background:'var(--paper-200)', borderRadius:999, marginTop:10, overflow:'hidden'}}>
              <div style={{width:'62%', height:'100%', background:'var(--ember-500)'}}/>
            </div>
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button className="btn btn-secondary" style={{flex:1, justifyContent:'center'}}>{I.pause} Pause</button>
              <button className="btn btn-ghost">{I.x}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ CHAT ============================
const MESSAGES = {
  'q3-campaign': [
    { id:1, a:'Rahul', ini:'RS', c:'var(--ember-500)', t:'09:12', body:'Pushed the first cut. Open for review. The director wants the cold-open shorter by ~6 seconds.'},
    { id:2, a:'Mia', ini:'MK', c:'var(--lav-500)', t:'09:14', body:'On it. Pulling the @rahul alt-takes from yesterday. Checksum verified, size checks out at 842 MB.', attach:true},
    { id:3, a:'Jae', ini:'JL', c:'var(--mint-500)', t:'09:21', body:'Here\'s the latest cut — give it a pass when you\'re free.', video:true, thread:3},
    { id:4, a:'Rahul', ini:'RS', c:'var(--ember-500)', t:'09:30', body:'Frame 00:04 feels long. Can you cut 6s from the cold-open?'},
    { id:5, a:'Jae', ini:'JL', c:'var(--mint-500)', t:'09:35', body:'Yep. Re-uploading now.'},
    { id:6, a:'Mia', ini:'MK', c:'var(--lav-500)', t:'09:42', body:'Locked version pushed. sha256 verified.', pin:true},
    { id:7, a:'You', ini:'YO', c:'var(--ink-700)', t:'11:47', body:'Reviewed. Ship the director\'s cut by EOD?'},
    { id:8, a:'Rahul', ini:'RS', c:'var(--ember-500)', t:'11:49', body:'Locked. Uploading the final now.', upload:true},
  ],
};

function Chat({ chatId, onOpenPlayer }) {
  const [msg, setMsg] = useState('');
  const [openThread, setOpenThread] = useState(null);
  const chat = CHATS.find(c => c.id === chatId) || DMS.find(d => d.id === chatId);
  if (!chat) return <div className="empty"><div className="title">No chat selected.</div></div>;
  const msgs = MESSAGES['q3-campaign'];
  const isDM = DMS.some(d => d.id === chatId);
  return (
    <div style={{flex:1, display:'grid', gridTemplateColumns: openThread ? '1fr 340px' : '1fr', minWidth:0}}>
      <div style={{display:'flex', flexDirection:'column', minWidth:0, background:'var(--bg)'}}>
        <div style={{padding:'10px 20px', borderBottom:'1px solid var(--border-soft)', display:'flex', alignItems:'center', gap:12, background:'var(--paper-0)'}}>
          <div style={{font:'700 15px/1 var(--font-sans)', display:'flex', alignItems:'center', gap:6}}>
            {isDM ? <div className="av" style={{background:chat.color, width:20, height:20, fontSize:9}}>{chat.ini}</div> : (chat.type==='lock' ? I.lock : I.hash)}
            {chat.name}
          </div>
          <span className="caseno">CASE · 0142 · MARKETING · Q3</span>
          <div style={{flex:1}}/>
          <div style={{display:'flex', alignItems:'center', gap:2}}>
            {['RS','MK','JL','SO','+8'].map((a,i) => (
              <div key={i} className="av" style={{marginLeft: i===0?0:-6, border:'2px solid var(--paper-0)', background: i===4 ? 'var(--paper-200)' : ['var(--ember-500)','var(--lav-500)','var(--mint-500)','var(--blood-500)'][i], color: i===4 ? 'var(--fg2)' : '#fff'}}>{a}</div>
            ))}
          </div>
          <button className="btn btn-ghost">{I.pin} Pinned</button>
          <button className="btn btn-ghost">{I.moreH}</button>
        </div>

        <div style={{flex:1, overflowY:'auto', padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, margin:'8px 0 12px', color:'var(--fg3)'}}>
            <div style={{flex:1, height:1, background:'var(--border-soft)'}}/>
            <span className="caseno">TODAY · APRIL 24</span>
            <div style={{flex:1, height:1, background:'var(--border-soft)'}}/>
          </div>
          {msgs.map(m => (
            <div key={m.id} style={{display:'grid', gridTemplateColumns:'32px 1fr', gap:10, padding:'6px 0'}}>
              <div className="av" style={{background:m.c, marginTop:2}}>{m.ini}</div>
              <div>
                <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:2}}>
                  <span style={{font:'600 13px/1 var(--font-sans)'}}>{m.a}</span>
                  <span style={{font:'400 11px/1 var(--font-mono)', color:'var(--fg3)'}}>{m.t}</span>
                  {m.pin && <span className="chip success" style={{marginLeft:4}}><span className="dot"/>LOCKED</span>}
                </div>
                <div style={{font:'400 13px/1.5 var(--font-sans)', color:'var(--fg1)'}}>
                  {m.body.split(/(@\w+)/).map((p,i) => p.startsWith('@') ? <span key={i} style={{color:'var(--ember-700)', background:'var(--ember-50)', padding:'1px 4px', borderRadius:3}}>{p}</span> : p)}
                </div>
                {m.video && (
                  <div style={{marginTop:6, maxWidth:460, border:'1px solid var(--border-soft)', borderRadius:10, overflow:'hidden', background:'var(--paper-0)', boxShadow:'var(--sh-1)', cursor:'pointer'}} onClick={onOpenPlayer}>
                    <div style={{aspectRatio:'16/9', background:'linear-gradient(135deg, #1E2247, #5E3DC7)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
                      <div style={{width:48, height:48, borderRadius:999, background:'rgba(255,253,248,.95)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>{I.play}</div>
                      <div style={{position:'absolute', right:10, bottom:10, background:'rgba(14,17,48,.75)', color:'#fff', font:'500 10px/1 var(--font-mono)', padding:'4px 6px', borderRadius:4}}>2:14</div>
                    </div>
                    <div style={{padding:'8px 12px', display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:24, height:24, borderRadius:4, background:'var(--blood-500)', color:'#fff', font:'700 9px/24px var(--font-mono)', textAlign:'center'}}>MP4</div>
                      <div style={{flex:1}}><div style={{font:'600 12px/1 var(--font-sans)'}}>reel-final-v3.mp4</div><div className="caseno" style={{marginTop:3, textTransform:'none', letterSpacing:0}}>842 MB · sha256 ae44...c102</div></div>
                      <span className="chip success"><span className="dot"/>VERIFIED</span>
                    </div>
                  </div>
                )}
                {m.attach && (
                  <div style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:8, padding:'6px 10px', border:'1px solid var(--border-soft)', borderRadius:8, background:'var(--paper-0)'}}>
                    {I.paperclip}
                    <span style={{font:'500 12px/1 var(--font-sans)'}}>alt-takes-0423.zip</span>
                    <span className="caseno" style={{textTransform:'none', letterSpacing:0}}>312 MB</span>
                  </div>
                )}
                {m.thread && (
                  <div onClick={() => setOpenThread(m)} style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:8, padding:'4px 10px', borderRadius:999, cursor:'pointer', color:'var(--ember-700)', font:'500 12px/1 var(--font-sans)'}}>
                    <div style={{display:'flex'}}>
                      <div className="av" style={{width:16, height:16, fontSize:8, background:'var(--ember-500)'}}>RS</div>
                      <div className="av" style={{width:16, height:16, fontSize:8, background:'var(--lav-500)', marginLeft:-4}}>MK</div>
                    </div>
                    {m.thread} replies · View thread →
                  </div>
                )}
              </div>
            </div>
          ))}
          {MESSAGES['q3-campaign'][7].upload && (
            <div style={{marginLeft:42, marginTop:8, padding:'10px 12px', border:'1px solid var(--border-soft)', borderRadius:8, background:'var(--paper-50)', maxWidth:380}}>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
                {I.upload}<strong>Uploading 1 file</strong>
                <span className="caseno" style={{marginLeft:'auto'}}>62%</span>
              </div>
              <div style={{fontSize:12, marginTop:6, color:'var(--fg2)'}}>reel-final-v4.mp4 · 522 / 842 MB</div>
              <div style={{height:3, background:'var(--paper-200)', borderRadius:999, marginTop:6, overflow:'hidden'}}>
                <div style={{width:'62%', height:'100%', background:'var(--ember-500)'}}/>
              </div>
            </div>
          )}
        </div>

        <div style={{padding:'10px 20px', borderTop:'1px solid var(--border-soft)', background:'var(--paper-0)'}}>
          <div style={{border:'1px solid var(--border)', borderRadius:10, background:'var(--paper-0)'}}>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder={`Message #${chat.name}`} rows={1} style={{width:'100%', padding:'10px 12px', border:0, outline:'none', background:'transparent', resize:'none', font:'400 13px/1.5 var(--font-sans)', color:'var(--fg1)'}}/>
            <div style={{display:'flex', alignItems:'center', gap:2, padding:'4px 6px', borderTop:'1px solid var(--border-soft)'}}>
              {[I.paperclip, I.image, I.at, I.smile, I.mic].map((ic,i) => (
                <button key={i} className="tb-btn">{ic}</button>
              ))}
              <div style={{flex:1}}/>
              <button className="btn btn-primary" style={{padding:'5px 10px'}} onClick={() => setMsg('')}>{I.send} Send</button>
            </div>
          </div>
        </div>
      </div>

      {openThread && (
        <div style={{borderLeft:'1px solid var(--border-soft)', background:'var(--paper-0)', display:'flex', flexDirection:'column', minWidth:0}}>
          <div style={{padding:'10px 14px', borderBottom:'1px solid var(--border-soft)', display:'flex', alignItems:'center', gap:8}}>
            <strong style={{fontSize:13}}>Thread</strong>
            <span className="caseno">{openThread.thread} REPLIES</span>
            <div style={{flex:1}}/>
            <button className="tb-btn" onClick={() => setOpenThread(null)}>{I.x}</button>
          </div>
          <div style={{flex:1, overflowY:'auto', padding:'14px'}}>
            {[
              {a:'Jae',ini:'JL',c:'var(--mint-500)',t:'09:21',b:'Here\'s the latest cut — give it a pass when you\'re free.'},
              {a:'Rahul',ini:'RS',c:'var(--ember-500)',t:'09:30',b:'Frame 00:04 feels long. Can you cut 6s from the cold-open?'},
              {a:'Jae',ini:'JL',c:'var(--mint-500)',t:'09:35',b:'Yep. Re-uploading now.'},
              {a:'Mia',ini:'MK',c:'var(--lav-500)',t:'09:42',b:'Locked version pushed. sha256 verified.'},
            ].map((r,i) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'28px 1fr', gap:8, padding:'6px 0'}}>
                <div className="av" style={{background:r.c, width:24, height:24, fontSize:10}}>{r.ini}</div>
                <div>
                  <div style={{display:'flex', gap:6, alignItems:'baseline'}}>
                    <span style={{font:'600 12px/1 var(--font-sans)'}}>{r.a}</span>
                    <span style={{font:'400 10px/1 var(--font-mono)', color:'var(--fg3)'}}>{r.t}</span>
                  </div>
                  <div style={{font:'400 13px/1.5 var(--font-sans)', marginTop:2}}>{r.b}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:10, borderTop:'1px solid var(--border-soft)'}}>
            <input className="input" placeholder="Reply to thread"/>
          </div>
        </div>
      )}
    </div>
  );
}

window.DT.ChatMod = { Chat, Dashboard };
})();
