/* global React */
(function(){
const { useState, useRef, useEffect, useMemo } = React;
const { I } = window.DT;

// ============================ FILES ============================
const FILES = [
  {n:'reel-final-v4.mp4',k:'MP4',c:'var(--blood-500)',s:'842 MB',m:'2 min ago · Rahul',status:'uploading',pct:62,hash:'ae44…c102'},
  {n:'reel-final-v3.mp4',k:'MP4',c:'var(--blood-500)',s:'838 MB',m:'1 h ago · Jae',status:'locked',hash:'8e21…fd90'},
  {n:'moodboard.fig',k:'FIG',c:'var(--lav-500)',s:'22.3 MB',m:'3 h ago · Mia',status:'verified',hash:'b102…9a44'},
  {n:'voiceover-v2.zip',k:'ZIP',c:'var(--ink-500)',s:'218 MB',m:'Yesterday · Sam',status:'verified',hash:'11fe…0a32'},
  {n:'q3-narrative.pdf',k:'PDF',c:'var(--blood-700)',s:'1.8 MB',m:'Yesterday · Jane',status:'verified',hash:'a901…bc10'},
  {n:'alt-takes-0423.zip',k:'ZIP',c:'var(--ink-500)',s:'312 MB',m:'2 days ago · Mia',status:'verified',hash:'77cc…1020'},
  {n:'storyboard.sketch',k:'SKT',c:'var(--ember-500)',s:'44.8 MB',m:'3 days ago · Jae',status:'verified',hash:'2db1…ef44'},
  {n:'score-draft.wav',k:'WAV',c:'var(--mint-500)',s:'156 MB',m:'4 days ago · Sam',status:'locked',hash:'c801…5b32'},
];

function Files({ onPreview }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const filtered = FILES.filter(f => {
    if (filter === 'uploading' && f.status !== 'uploading') return false;
    if (filter === 'locked' && f.status !== 'locked') return false;
    if (q && !f.n.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="page" style={{display:'flex', flexDirection:'column'}}>
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · FILES</div>
          <h1>Files <span style={{color:'var(--fg3)', fontWeight:400, fontSize:14, marginLeft:6, fontFamily:'var(--font-mono)'}}>{FILES.length} items · 2.4 GB</span></h1>
        </div>
        <input className="input" placeholder="Search files..." value={q} onChange={e=>setQ(e.target.value)} style={{width:220}}/>
        <div className="seg">
          {[['all','All'],['uploading','Uploading'],['locked','Locked']].map(([k,l]) => (
            <button key={k} className={filter===k?'on':''} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary">{I.upload} Upload</button>
      </div>
      <div style={{flex:1, display:'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', minHeight:0}}>
        <div style={{overflow:'auto', padding:'12px 24px 24px'}}>
          <table style={{width:'100%', borderCollapse:'collapse', font:'400 13px/1.3 var(--font-sans)'}}>
            <thead>
              <tr>
                {['Name','Size','Status','Checksum','Modified',''].map(h => (
                  <th key={h} style={{textAlign:'left', font:'500 10px/1 var(--font-mono)', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg3)', padding:'0 10px 8px', borderBottom:'1px solid var(--border-soft)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f,i) => (
                <tr key={i} onClick={() => setSelected(f)} style={{cursor:'pointer', background: selected?.n === f.n ? 'var(--ember-50)' : 'transparent'}}>
                  <td style={{padding:10, borderBottom:'1px solid var(--border-soft)'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:30, height:30, borderRadius:5, background:f.c, color:'#fff', font:'700 9px/30px var(--font-mono)', textAlign:'center', flexShrink:0}}>{f.k}</div>
                      <span style={{fontWeight:500}}>{f.n}</span>
                    </div>
                  </td>
                  <td style={{padding:10, borderBottom:'1px solid var(--border-soft)', color:'var(--fg2)', fontFamily:'var(--font-mono)', fontSize:12}}>{f.s}</td>
                  <td style={{padding:10, borderBottom:'1px solid var(--border-soft)'}}>
                    {f.status === 'uploading' ? <span className="chip warn"><span className="dot"/>{f.pct}%</span> : f.status === 'locked' ? <span className="chip"><span className="dot"/>LOCKED</span> : <span className="chip success"><span className="dot"/>VERIFIED</span>}
                  </td>
                  <td style={{padding:10, borderBottom:'1px solid var(--border-soft)', color:'var(--fg3)', fontFamily:'var(--font-mono)', fontSize:11}}>{f.hash}</td>
                  <td style={{padding:10, borderBottom:'1px solid var(--border-soft)', color:'var(--fg3)'}}>{f.m}</td>
                  <td style={{padding:10, borderBottom:'1px solid var(--border-soft)', textAlign:'right'}}><button className="tb-btn">{I.moreH}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div style={{borderLeft:'1px solid var(--border-soft)', background:'var(--paper-0)', padding:16, overflow:'auto'}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <strong>File details</strong>
              <div style={{flex:1}}/>
              <button className="tb-btn" onClick={() => setSelected(null)}>{I.x}</button>
            </div>
            <div style={{marginTop:14, aspectRatio:'4/3', borderRadius:10, background:'linear-gradient(135deg, #1E2247, #5E3DC7)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff'}}>
              <div style={{width:44, height:44, borderRadius:999, background:'rgba(255,253,248,.9)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>{I.play}</div>
            </div>
            <div style={{font:'600 16px/1.2 var(--font-sans)', marginTop:14}}>{selected.n}</div>
            <div className="caseno" style={{marginTop:6}}>{selected.s.toUpperCase()} · {selected.m.toUpperCase()}</div>
            <div style={{marginTop:14, display:'grid', gap:10}}>
              {[
                ['Status', selected.status === 'uploading' ? `Uploading · ${selected.pct}%` : selected.status],
                ['sha256', selected.hash],
                ['Uploaded by', selected.m.split('·')[1].trim()],
                ['Chunks', '64 / 105'],
                ['Visibility', 'Case members (12)'],
              ].map(([k,v],i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:12, gap:10}}>
                  <span style={{color:'var(--fg3)'}}>{k}</span>
                  <span style={{fontFamily: k==='sha256' ? 'var(--font-mono)' : 'inherit', textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:6, marginTop:14}}>
              <button className="btn btn-primary" style={{flex:1, justifyContent:'center'}} onClick={() => onPreview?.(selected)}>{I.play} Open</button>
              <button className="btn btn-secondary">{I.download}</button>
              <button className="btn btn-secondary">{I.link}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================ GALLERY ============================
const GALLERY = Array.from({length: 18}, (_, i) => {
  const grads = [
    ['#FF512E','#FFCB3D'], ['#1E2247','#5E3DC7'], ['#2EBD82','#17885A'],
    ['#C8361A','#6B1708'], ['#FFCB3D','#D49900'], ['#8B6BF0','#2B1766'],
    ['#3A4272','#0E1130'], ['#FF512E','#C8361A'], ['#9CE5C4','#2EBD82'],
  ];
  const g = grads[i % grads.length];
  return { id:i, bg:`linear-gradient(135deg, ${g[0]}, ${g[1]})`, video: i % 3 === 1, name: `frame-${String(i+1).padStart(3,'0')}.${i%3===1?'mp4':'jpg'}`, size: `${Math.floor(Math.random()*8+1)}.${Math.floor(Math.random()*9)} MB`, who: ['Mia','Rahul','Jae','Sam'][i%4] };
});

function Gallery() {
  const [mode, setMode] = useState('lightbox');
  const [open, setOpen] = useState(null);
  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · GALLERY</div>
          <h1>Gallery <span style={{color:'var(--fg3)', fontWeight:400, fontSize:14, marginLeft:6, fontFamily:'var(--font-mono)'}}>{GALLERY.length} items</span></h1>
        </div>
        <div className="seg">
          {[['lightbox','Lightbox'],['panel','Side panel']].map(([k,l]) => (
            <button key={k} className={mode===k?'on':''} onClick={()=>setMode(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-secondary">{I.filter} Filter</button>
      </div>
      <div className="page-body" style={{display: mode==='panel' ? 'grid' : 'block', gridTemplateColumns: open ? '1fr 340px' : '1fr', gap: 14}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:8}}>
          {GALLERY.map(it => (
            <div key={it.id} onClick={() => setOpen(it)} style={{aspectRatio:1, background:it.bg, borderRadius:8, cursor:'pointer', position:'relative', overflow:'hidden', border: open?.id===it.id ? '2px solid var(--ember-500)' : '1px solid var(--border-soft)'}}>
              {it.video && (
                <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:36, height:36, borderRadius:999, background:'rgba(255,253,248,.9)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>{I.play}</div>
              )}
              <div style={{position:'absolute', bottom:0, left:0, right:0, padding:'14px 8px 6px', background:'linear-gradient(transparent, rgba(14,17,48,.7))', color:'#fff', font:'500 10px/1 var(--font-mono)', display:'flex', justifyContent:'space-between'}}>
                <span>{it.name}</span>
                <span>{it.size}</span>
              </div>
            </div>
          ))}
        </div>
        {mode === 'panel' && open && (
          <div style={{background:'var(--paper-0)', border:'1px solid var(--border-soft)', borderRadius:10, padding:14, height:'fit-content', position:'sticky', top:0}}>
            <div style={{display:'flex', alignItems:'center'}}>
              <strong style={{fontSize:13}}>{open.name}</strong>
              <div style={{flex:1}}/>
              <button className="tb-btn" onClick={() => setOpen(null)}>{I.x}</button>
            </div>
            <div style={{aspectRatio:1, background:open.bg, borderRadius:8, marginTop:10}}/>
            <div style={{marginTop:12, display:'grid', gap:8, fontSize:12}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--fg3)'}}>Size</span><span style={{fontFamily:'var(--font-mono)'}}>{open.size}</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--fg3)'}}>Uploaded by</span><span>{open.who}</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--fg3)'}}>Resolution</span><span style={{fontFamily:'var(--font-mono)'}}>3840 × 2160</span></div>
            </div>
          </div>
        )}
      </div>

      {mode === 'lightbox' && open && (
        <div className="modal-backdrop" onClick={() => setOpen(null)}>
          <div style={{position:'relative', maxWidth:'80vw', maxHeight:'80vh'}} onClick={e => e.stopPropagation()}>
            <div style={{width: 720, maxWidth:'80vw', aspectRatio:1, background:open.bg, borderRadius:12, position:'relative'}}>
              {open.video && <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:64, height:64, borderRadius:999, background:'rgba(255,253,248,.95)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>{I.play}</div>}
            </div>
            <div style={{position:'absolute', top:14, right:14, display:'flex', gap:6}}>
              <button className="btn btn-secondary">{I.download}</button>
              <button className="btn btn-secondary" onClick={() => setOpen(null)}>{I.x}</button>
            </div>
            <div style={{position:'absolute', bottom:14, left:14, right:14, display:'flex', alignItems:'center', justifyContent:'space-between', color:'#fff'}}>
              <div>
                <div style={{font:'600 14px/1 var(--font-sans)'}}>{open.name}</div>
                <div style={{font:'400 11px/1 var(--font-mono)', opacity:.8, marginTop:4}}>{open.size} · Uploaded by {open.who}</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="tb-btn" style={{background:'rgba(14,17,48,.6)', color:'#fff'}} onClick={e => { e.stopPropagation(); setOpen(GALLERY[(open.id-1+GALLERY.length)%GALLERY.length]); }}>{I.chevL}</button>
                <button className="tb-btn" style={{background:'rgba(14,17,48,.6)', color:'#fff'}} onClick={e => { e.stopPropagation(); setOpen(GALLERY[(open.id+1)%GALLERY.length]); }}>{I.chevR}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ VIDEO PLAYER ============================
function VideoPlayer() {
  const [tab, setTab] = useState('review');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(34);
  const duration = 134;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setTime(x => x >= duration ? 0 : x + 0.5), 500);
    return () => clearInterval(t);
  }, [playing, duration]);
  const comments = [
    { t: 4, who:'RS', c:'var(--ember-500)', a:'Rahul', body:'Cold-open runs long here. Cut ~6s.' },
    { t: 22, who:'MK', c:'var(--lav-500)', a:'Mia', body:'Color looks warm on this LUT — check monitor.' },
    { t: 67, who:'JL', c:'var(--mint-500)', a:'Jae', body:'Transition feels abrupt. Crossfade?' },
    { t: 98, who:'SO', c:'var(--blood-500)', a:'Sam', body:'VO levels dip around here.' },
  ];
  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · 0142 · VIDEO REVIEW</div>
          <h1>reel-final-v4.mp4 <span className="chip warn" style={{marginLeft:8, verticalAlign:'middle'}}><span className="dot"/>UPLOADING 62%</span></h1>
          <div className="sub" style={{fontFamily:'var(--font-mono)', fontSize:11}}>sha256 ae44…c102 · 842 MB · 3840 × 2160 · 2:14</div>
        </div>
        <div className="seg">
          {[['review','Review'],['upload','Upload'],['compare','Compare']].map(([k,l]) => (
            <button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-secondary">{I.download}</button>
      </div>
      <div className="page-body" style={{display:'grid', gridTemplateColumns: tab==='review' ? '1fr 320px' : '1fr', gap:14}}>
        <div>
          {tab === 'compare' ? (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {['v3','v4'].map(v => (
                <div key={v}>
                  <div className="caseno" style={{marginBottom:6}}>CUT · {v.toUpperCase()}</div>
                  <div style={{aspectRatio:'16/9', borderRadius:10, background:`linear-gradient(135deg, ${v==='v3'?'#1E2247, #5E3DC7':'#C8361A, #6B1708'})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', position:'relative'}}>
                    <div style={{width:52, height:52, borderRadius:999, background:'rgba(255,253,248,.95)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-900)'}}>{I.play}</div>
                    <div style={{position:'absolute', right:10, bottom:10, font:'500 10px/1 var(--font-mono)', color:'#fff', background:'rgba(14,17,48,.75)', padding:'4px 6px', borderRadius:4}}>{fmt(time)} / {fmt(duration)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{aspectRatio:'16/9', borderRadius:10, background:'linear-gradient(135deg, #1E2247, #5E3DC7)', position:'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <button className="tb-btn" style={{width:64, height:64, borderRadius:999, background:'rgba(255,253,248,.95)', color:'var(--ink-900)'}} onClick={() => setPlaying(!playing)}>
                  {playing ? <span style={{transform:'scale(1.6)'}}>{I.pause}</span> : <span style={{transform:'scale(1.6)', marginLeft:3}}>{I.play}</span>}
                </button>
              </div>
              <div style={{position:'absolute', bottom:0, left:0, right:0, padding:'14px', background:'linear-gradient(transparent, rgba(14,17,48,.85))'}}>
                <div style={{position:'relative', height:28, marginBottom:8}}>
                  <div style={{position:'absolute', inset:'12px 0', background:'rgba(255,253,248,.25)', borderRadius:2}}/>
                  <div style={{position:'absolute', inset:'12px 0', width:`${(time/duration)*100}%`, background:'var(--ember-500)', borderRadius:2}}/>
                  {comments.map(c => (
                    <div key={c.t} title={c.body} style={{position:'absolute', top:6, left:`${(c.t/duration)*100}%`, width:16, height:16, borderRadius:999, background:c.c, color:'#fff', font:'700 8px/16px var(--font-sans)', textAlign:'center', cursor:'pointer', transform:'translateX(-50%)', border:'2px solid #fff'}}>{c.who[0]}</div>
                  ))}
                  <input type="range" min={0} max={duration} step={0.1} value={time} onChange={e => setTime(Number(e.target.value))} style={{position:'absolute', inset:0, width:'100%', opacity:0, cursor:'pointer'}}/>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:8, color:'#fff'}}>
                  <button className="tb-btn" style={{color:'#fff'}} onClick={() => setPlaying(!playing)}>{playing ? I.pause : I.play}</button>
                  <span style={{font:'500 11px/1 var(--font-mono)'}}>{fmt(time)} / {fmt(duration)}</span>
                  <div style={{flex:1}}/>
                  <button className="tb-btn" style={{color:'#fff'}}>{I.volume}</button>
                  <button className="tb-btn" style={{color:'#fff'}}>{I.maximize}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div className="card" style={{marginTop:14}}>
              <div className="card-hd"><h3>Chunked upload</h3><span className="chip warn"><span className="dot"/>IN PROGRESS</span></div>
              <div style={{fontFamily:'var(--font-mono)', fontSize:12, color:'var(--fg2)'}}>522 / 842 MB · chunk 64 of 105 · 12.3 MB/s</div>
              <div style={{height:6, background:'var(--paper-200)', borderRadius:999, marginTop:10, overflow:'hidden'}}>
                <div style={{width:'62%', height:'100%', background:'var(--ember-500)'}}/>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(35, 1fr)', gap:2, marginTop:14}}>
                {Array.from({length:105}).map((_,i) => (
                  <div key={i} style={{aspectRatio:1, background: i < 64 ? 'var(--mint-500)' : i === 64 ? 'var(--ember-500)' : 'var(--paper-200)', borderRadius:2}}/>
                ))}
              </div>
              <div style={{display:'flex', gap:8, marginTop:14}}>
                <button className="btn btn-secondary">{I.pause} Pause</button>
                <button className="btn btn-ghost">Retry failed chunks</button>
                <div style={{flex:1}}/>
                <span className="caseno">SHA256 · VERIFIED PER CHUNK</span>
              </div>
            </div>
          )}
        </div>

        {tab === 'review' && (
          <div className="card" style={{height:'fit-content', position:'sticky', top:0}}>
            <div className="card-hd"><h3>Comments</h3><span className="caseno">{comments.length}</span></div>
            <div style={{display:'grid', gap:12}}>
              {comments.map((c,i) => (
                <div key={i} onClick={() => setTime(c.t)} style={{display:'grid', gridTemplateColumns:'26px 1fr', gap:8, cursor:'pointer', padding:'6px', borderRadius:6, background: Math.abs(time - c.t) < 2 ? 'var(--ember-50)' : 'transparent'}}>
                  <div className="av" style={{background:c.c, width:22, height:22, fontSize:9}}>{c.who}</div>
                  <div>
                    <div style={{display:'flex', gap:6, alignItems:'baseline'}}>
                      <strong style={{fontSize:12}}>{c.a}</strong>
                      <span style={{font:'500 10px/1 var(--font-mono)', color:'var(--ember-700)'}}>{fmt(c.t)}</span>
                    </div>
                    <div style={{fontSize:12, lineHeight:1.4, color:'var(--fg1)', marginTop:3}}>{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <input className="input" placeholder={`Comment at ${fmt(time)}...`} style={{marginTop:12}}/>
          </div>
        )}
      </div>
    </div>
  );
}

window.DT.FilesMod = { Files, Gallery, VideoPlayer };
})();
