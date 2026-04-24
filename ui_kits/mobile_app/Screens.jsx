/* global React, UIKit */
(function(){
const I = UIKit.I;

const mobileStyles = {
  screen: { width: '100%', height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-sans)', color: 'var(--fg1)', paddingTop: 54 },
  navBar: { display: 'flex', alignItems: 'center', padding: '8px 16px 12px', borderBottom: '1px solid var(--border-soft)', background: 'var(--paper-0)', gap: 10 },
  chatList: { flex: 1, overflowY: 'auto' },
  row: { display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center' },
  caseno: { font: '500 10px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg3)' },
};

// --- Chat list screen ---
function MobileChatList({ onOpenChat }) {
  const chats = [
    { n: 'q3-campaign', last: 'Locked. Uploading the final now.', t: '11:49', unread: 3, who: 'Rahul', col: 'var(--ember-500)', ini: '#' },
    { n: 'Mia Kern', last: 'sha256 verified.', t: '11:42', unread: 0, who: '', col: 'var(--lav-500)', ini: 'MK' },
    { n: 'reel-cut', last: 'Here\'s the latest cut — 842 MB', t: '09:21', unread: 0, who: 'Jae', col: 'var(--mint-500)', ini: '#' },
    { n: 'founders', last: 'Budget approved for Q3.', t: 'Yesterday', unread: 1, who: 'Owner', col: 'var(--ink-900)', ini: '🔒' },
    { n: 'general', last: 'Welcome to Dev Thriller 👋', t: 'Apr 20', unread: 0, who: 'System', col: 'var(--paper-300)', ini: '#' },
  ];
  return (
    <div style={mobileStyles.screen}>
      <div style={{...mobileStyles.navBar, flexDirection:'column', alignItems:'stretch', gap:8, padding:'12px 16px'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <img src="../../assets/logo-monogram.svg" width="28" height="28"/>
          <div style={{flex:1}}>
            <div style={{font:'700 17px/1 var(--font-sans)'}}>Chats</div>
            <div style={mobileStyles.caseno}>ACME MARKETING · 4 UNREAD</div>
          </div>
          <div style={{width:32, height:32, borderRadius:999, background:'var(--paper-100)', border:'1px solid var(--border-soft)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg2)'}}>{I.plus}</div>
        </div>
        <div style={{position:'relative'}}>
          <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--fg3)'}}>{I.search}</div>
          <input placeholder="Search" style={{width:'100%', height:36, padding:'0 12px 0 36px', border:'1px solid var(--border-soft)', borderRadius:10, background:'var(--paper-50)', font:'400 14px/1 var(--font-sans)', outline:'none'}}/>
        </div>
      </div>
      <div style={mobileStyles.chatList}>
        {chats.map((c, i) => (
          <div key={i} style={{...mobileStyles.row, cursor:'pointer'}} onClick={() => onOpenChat?.(c)}>
            <div style={{width:44, height:44, borderRadius:12, background:c.col, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', font:'600 14px/1 var(--font-sans)', flexShrink:0}}>{c.ini}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:2}}>
                <span style={{font:'600 15px/1 var(--font-sans)'}}>{c.n}</span>
                <span style={{font:'400 11px/1 var(--font-mono)', color: c.unread ? 'var(--ember-500)' : 'var(--fg3)'}}>{c.t}</span>
              </div>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <span style={{flex:1, font:'400 13px/1.3 var(--font-sans)', color:'var(--fg2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                  {c.who && <span style={{color:'var(--fg3)'}}>{c.who}: </span>}{c.last}
                </span>
                {c.unread > 0 && <span style={{minWidth:20, height:20, padding:'0 6px', borderRadius:999, background:'var(--ember-500)', color:'#fff', font:'600 11px/20px var(--font-sans)', textAlign:'center'}}>{c.unread}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <MobileTabBar active="chats"/>
    </div>
  );
}

// --- Chat thread screen ---
function MobileChatThread({ chat, onBack }) {
  return (
    <div style={mobileStyles.screen}>
      <div style={{...mobileStyles.navBar}}>
        <div onClick={onBack} style={{color:'var(--ember-500)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, font:'500 15px/1 var(--font-sans)'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" className="icon"><path d="m15 18-6-6 6-6"/></svg>
          Chats
        </div>
        <div style={{flex:1, textAlign:'center'}}>
          <div style={{font:'700 15px/1 var(--font-sans)'}}># {chat?.n || 'q3-campaign'}</div>
          <div style={mobileStyles.caseno}>CASE · 0142</div>
        </div>
        <div style={{width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg2)'}}>{I.moreH}</div>
      </div>

      <div style={{flex:1, overflowY:'auto', padding:'12px 12px 0'}}>
        <div style={{textAlign:'center', font:'500 10px/1 var(--font-mono)', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg3)', margin:'8px 0 14px'}}>— TODAY · APRIL 24 —</div>

        <MobileMsg me={false} initials="RS" color="var(--ember-500)" author="Rahul" time="09:12">
          Pushed the first cut. Open for review.
        </MobileMsg>
        <MobileMsg me={false} initials="MK" color="var(--lav-500)" author="Mia" time="09:14">
          On it. Pulling the @rahul alt-takes.
        </MobileMsg>
        <MobileMsg me={false} initials="JL" color="var(--mint-500)" author="Jae" time="09:21">
          Latest cut:
          <div style={{marginTop:6, borderRadius:10, overflow:'hidden', background:'linear-gradient(135deg, #1E2247, #5E3DC7)', aspectRatio:'16/9', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
            <div style={{width:44, height:44, borderRadius:999, background:'rgba(255,253,248,.95)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div style={{position:'absolute', right:8, bottom:8, background:'rgba(14,17,48,.75)', color:'#fff', font:'500 10px/1 var(--font-mono)', padding:'3px 5px', borderRadius:4}}>2:14 · 842 MB</div>
          </div>
        </MobileMsg>
        <MobileMsg me={true} initials="YO" color="var(--ink-500)" author="You" time="11:47">
          Reviewed. Ship the director's cut by EOD?
        </MobileMsg>
        <MobileMsg me={false} initials="RS" color="var(--ember-500)" author="Rahul" time="11:49">
          Locked. Uploading now.
        </MobileMsg>
      </div>

      <div style={{padding:'10px 12px', borderTop:'1px solid var(--border-soft)', background:'var(--paper-0)', display:'flex', gap:8, alignItems:'center'}}>
        <div style={{width:34, height:34, borderRadius:999, background:'var(--paper-100)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg2)'}}>{I.plus}</div>
        <input placeholder="Message" style={{flex:1, height:36, padding:'0 12px', borderRadius:18, border:'1px solid var(--border-soft)', background:'var(--paper-50)', font:'400 14px/1 var(--font-sans)', outline:'none'}}/>
        <div style={{width:34, height:34, borderRadius:999, background:'var(--ember-500)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>{I.send}</div>
      </div>
    </div>
  );
}

function MobileMsg({ me, initials, color, author, time, children }) {
  if (me) {
    return (
      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
        <div style={{maxWidth:'78%', background:'var(--ember-500)', color:'#FFFDF8', padding:'8px 12px', borderRadius:'14px 14px 4px 14px', font:'400 14px/1.4 var(--font-sans)', boxShadow:'var(--sh-1)'}}>
          {children}
          <div style={{font:'400 10px/1 var(--font-mono)', opacity:.75, marginTop:4, textAlign:'right'}}>{time}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{display:'flex', gap:8, marginBottom:8}}>
      <div style={{width:28, height:28, borderRadius:999, background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', font:'600 11px/1 var(--font-sans)', flexShrink:0}}>{initials}</div>
      <div style={{maxWidth:'78%'}}>
        <div style={{font:'600 12px/1 var(--font-sans)', color:'var(--fg2)', marginBottom:3}}>{author} <span style={{font:'400 10px/1 var(--font-mono)', color:'var(--fg3)', marginLeft:4}}>{time}</span></div>
        <div style={{background:'var(--paper-0)', border:'1px solid var(--border-soft)', padding:'8px 12px', borderRadius:'14px 14px 14px 4px', font:'400 14px/1.4 var(--font-sans)', color:'var(--fg1)'}}>
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Media screen ---
function MobileMedia() {
  const tiles = [
    { bg: 'linear-gradient(135deg, #FF512E, #FFCB3D)', v: false },
    { bg: 'linear-gradient(135deg, #1E2247, #5E3DC7)', v: true },
    { bg: 'linear-gradient(135deg, #2EBD82, #17885A)', v: false },
    { bg: 'linear-gradient(135deg, #C8361A, #6B1708)', v: true },
    { bg: 'linear-gradient(135deg, #FFCB3D, #D49900)', v: false },
    { bg: 'linear-gradient(135deg, #8B6BF0, #2B1766)', v: false },
    { bg: 'linear-gradient(135deg, #3A4272, #0E1130)', v: true },
    { bg: 'linear-gradient(135deg, #FF512E, #C8361A)', v: false },
    { bg: 'linear-gradient(135deg, #9CE5C4, #2EBD82)', v: false },
  ];
  return (
    <div style={mobileStyles.screen}>
      <div style={{...mobileStyles.navBar, flexDirection:'column', alignItems:'stretch', gap:8}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{flex:1}}>
            <div style={{font:'700 17px/1 var(--font-sans)'}}>Media</div>
            <div style={mobileStyles.caseno}>ACROSS ALL CHATS · 214 ITEMS</div>
          </div>
        </div>
        <div style={{display:'flex', gap:6, overflowX:'auto', paddingBottom:2}}>
          {['All', 'Images', 'Videos', 'Docs', 'Audio', 'Links'].map((t, i) => (
            <div key={t} style={{padding:'5px 11px', borderRadius:999, border:'1px solid var(--border-soft)', background: i===0 ? 'var(--ink-900)' : 'var(--paper-0)', color: i===0 ? '#FFFDF8' : 'var(--fg2)', font:'600 12px/1 var(--font-sans)', whiteSpace:'nowrap', flexShrink:0}}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:2, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:2}}>
        {tiles.map((t, i) => (
          <div key={i} style={{aspectRatio:1, background: t.bg, display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
            {t.v && (
              <div style={{width:36, height:36, borderRadius:999, background:'rgba(255,253,248,.92)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <MobileTabBar active="media"/>
    </div>
  );
}

// --- Upload screen ---
function MobileUpload() {
  return (
    <div style={mobileStyles.screen}>
      <div style={{...mobileStyles.navBar}}>
        <div style={{color:'var(--ember-500)', cursor:'pointer', font:'500 15px/1 var(--font-sans)'}}>Cancel</div>
        <div style={{flex:1, textAlign:'center', font:'700 15px/1 var(--font-sans)'}}>Upload</div>
        <div style={{font:'500 15px/1 var(--font-sans)', color:'var(--fg3)'}}>Done</div>
      </div>
      <div style={{flex:1, padding:'16px', display:'flex', flexDirection:'column', gap:14}}>
        <div style={mobileStyles.caseno}>IN PROGRESS · 1</div>

        <div style={{background:'var(--paper-0)', border:'1px solid var(--border-soft)', borderRadius:12, padding:'12px 14px', boxShadow:'var(--sh-1)'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
            <div style={{width:36, height:36, borderRadius:8, background:'var(--blood-500)', color:'#fff', font:'700 10px/1 var(--font-mono)', display:'flex', alignItems:'center', justifyContent:'center'}}>MP4</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:'600 14px/1.2 var(--font-sans)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>reel-final-v4.mp4</div>
              <div style={{font:'400 11px/1.3 var(--font-mono)', color:'var(--fg3)', marginTop:2}}>522 / 842 MB · 62%</div>
            </div>
            <div style={{color:'var(--fg3)'}}>{I.x}</div>
          </div>
          <div style={{height:6, background:'var(--paper-200)', borderRadius:999, overflow:'hidden'}}>
            <div style={{height:'100%', width:'62%', background:'var(--ember-500)'}}/>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginTop:8, font:'400 10px/1 var(--font-mono)', letterSpacing:'.08em', textTransform:'uppercase', color:'var(--fg3)'}}>
            <span>CHUNK 64 / 105</span>
            <span>RESUMABLE</span>
          </div>
        </div>

        <div style={mobileStyles.caseno}>COMPLETED · 3</div>
        {[
          { n:'q3-narrative.pdf', k:'PDF', c:'var(--blood-700)', s:'1.8 MB' },
          { n:'moodboard.fig', k:'FIG', c:'var(--lav-500)', s:'22.3 MB' },
          { n:'voiceover.zip', k:'ZIP', c:'var(--ink-500)', s:'218 MB' },
        ].map((f, i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderTop:'1px solid var(--border-soft)'}}>
            <div style={{width:32, height:32, borderRadius:6, background:f.c, color:'#fff', font:'700 9px/1 var(--font-mono)', display:'flex', alignItems:'center', justifyContent:'center'}}>{f.k}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:'600 14px/1.2 var(--font-sans)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.n}</div>
              <div style={{font:'400 11px/1 var(--font-mono)', color:'var(--fg3)', marginTop:2}}>{f.s} · sha256 verified</div>
            </div>
            <div style={{color:'var(--mint-500)'}}>{I.check}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Login ---
function MobileLogin({ onSignIn }) {
  return (
    <div style={{...mobileStyles.screen, padding:'94px 24px 40px 24px', justifyContent:'space-between'}}>
      <div>
        <img src="../../assets/logo-monogram.svg" width="52" height="52"/>
        <div style={{marginTop:32}}>
          <div style={{font:'500 11px/1 var(--font-mono)', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg3)', marginBottom:8}}>CASE · 0001</div>
          <div style={{font:'400 40px/1.1 var(--font-display)', letterSpacing:'-.01em'}}>
            The suspense<br/>of a <span style={{fontStyle:'italic'}}>thriller</span>.<br/>
            The <span className="tape-highlight">precision</span><br/>of a dev tool.
          </div>
        </div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        <button onClick={onSignIn} style={{padding:'14px', borderRadius:12, border:'none', background:'var(--ember-500)', color:'#FFFDF8', font:'600 15px/1 var(--font-sans)', cursor:'pointer', boxShadow:'var(--sh-1), var(--sh-inset)'}}>Sign in with email</button>
        <button style={{padding:'14px', borderRadius:12, border:'1px solid var(--border)', background:'var(--paper-0)', color:'var(--fg1)', font:'600 15px/1 var(--font-sans)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38"/></svg>
          Continue with Google
        </button>
        <div style={{textAlign:'center', font:'400 12px/1.4 var(--font-sans)', color:'var(--fg3)', marginTop:4}}>
          By continuing you accept the <a className="t-link" href="#">Terms</a> and <a className="t-link" href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}

// --- Tab bar ---
function MobileTabBar({ active, onChange }) {
  const tabs = [
    { k: 'chats', l: 'Chats', i: I.hash },
    { k: 'media', l: 'Media', i: I.image },
    { k: 'files', l: 'Files', i: I.folder },
    { k: 'upload', l: 'Upload', i: I.plus },
  ];
  return (
    <div style={{display:'flex', borderTop:'1px solid var(--border-soft)', background:'var(--paper-0)', padding:'8px 0 10px'}}>
      {tabs.map(t => (
        <div key={t.k} onClick={() => onChange?.(t.k)} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, color: active===t.k ? 'var(--ember-500)' : 'var(--fg3)', cursor:'pointer'}}>
          <div style={{width:22, height:22}}>{t.i}</div>
          <span style={{font:'500 10px/1 var(--font-sans)'}}>{t.l}</span>
        </div>
      ))}
    </div>
  );
}

window.UIKit = Object.assign(window.UIKit || {}, { MobileChatList, MobileChatThread, MobileMedia, MobileUpload, MobileLogin, MobileTabBar });
})();
