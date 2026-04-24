/* global React, UIKit */
(function(){
const { useState } = React;
const { I } = UIKit;

function DaySep({ label }) { return <div className="day-sep">{label}</div>; }

function Message({ author, time, color, initials, children, reactions = [] }) {
  return (
    <div className="msg">
      <div className="av" style={{background: color}}>{initials}</div>
      <div>
        <div className="msg-head">
          <span className="author">{author}</span>
          <span className="time">{time}</span>
        </div>
        <div className="msg-body">{children}</div>
        {reactions.length > 0 && (
          <div style={{display:'flex', gap:6, marginTop:6}}>
            {reactions.map((r,i)=>(
              <div key={i} style={{display:'flex', alignItems:'center', gap:4, padding:'2px 7px', background:'var(--paper-100)', border:'1px solid var(--border-soft)', borderRadius:999, font:'500 11px/1 var(--font-sans)', color:'var(--fg2)'}}>
                <span>{r.e}</span><span>{r.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentVideo({ name, size, duration }) {
  return (
    <div className="attach" style={{maxWidth:420}}>
      <div className="attach-preview" style={{background:'linear-gradient(135deg, #1E2247 0%, #5E3DC7 60%, #FF512E 100%)'}}>
        <div style={{width:52,height:52,borderRadius:999,background:'rgba(255,253,248,.95)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ink-900)'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div style={{position:'absolute', right:10, bottom:10, background:'rgba(14,17,48,.7)', color:'#fff', font:'500 11px/1 var(--font-mono)', padding:'4px 6px', borderRadius:4}}>{duration}</div>
      </div>
      <div className="attach-body">
        {I.film}
        <div style={{flex:1}}>
          <div className="name">{name}</div>
          <div className="sub">{size} · MP4</div>
        </div>
        <button className="btn btn-ghost" style={{padding:'4px 8px'}}>Open</button>
      </div>
    </div>
  );
}

function AttachmentFile({ name, size, kind = 'PDF', color = 'var(--blood-500)' }) {
  return (
    <div className="attach" style={{maxWidth: 380}}>
      <div className="attach-body">
        <div className="file-ico" style={{background: color}}>{kind}</div>
        <div style={{flex:1}}>
          <div className="name">{name}</div>
          <div className="sub">{size} · {kind.toLowerCase()}</div>
        </div>
        <button className="btn btn-ghost" style={{padding:'4px 8px'}}>Open</button>
      </div>
    </div>
  );
}

function ChatView({ variant, chat }) {
  // variant: 'classic' (default) | 'focused' | 'transcript'
  const bodyFont = variant === 'transcript' ? 'var(--font-mono)' : 'var(--font-sans)';
  const bodySize = variant === 'focused' ? 15 : 14;
  return (
    <div className="chat-main">
      <div className="chat-header">
        <span style={{color:'var(--fg3)'}}>{chat.type === 'lock' ? I.lock : I.hash}</span>
        <span className="title">{chat.name}</span>
        <span className="caseno">CASE · 0142 — MARKETING Q3</span>
        <div className="tabs">
          <div className="chat-tab active">Messages</div>
          <div className="chat-tab">Media</div>
          <div className="chat-tab">Files</div>
          <div className="chat-tab">Pinned</div>
        </div>
      </div>

      <div className="chat-scroll" style={{fontFamily: bodyFont, fontSize: bodySize}}>
        <DaySep label="— Tuesday · April 22 —" />

        <Message author="Rahul Shah" time="09:12" color="var(--ember-500)" initials="RS">
          Pushed the first cut. Open for review. The director wants the cold-open shorter by <span className="t-code">~6 seconds</span>.
        </Message>

        <Message author="Mia Kern" time="09:14" color="var(--lav-500)" initials="MK" reactions={[{e:'👀', n:3}, {e:'🔥', n:2}]}>
          On it. Pulling the <span className="mention">@rahul</span> alt-takes from yesterday. Checksum verified, size checks out at 842 MB.
        </Message>

        <Message author="Jae Lim" time="09:21" color="var(--mint-500)" initials="JL">
          Here's the latest cut — give it a pass when you're free.
          <AttachmentVideo name="reel-final-v4.mp4" size="842 MB" duration="2:14" />
        </Message>

        <Message author="Mia Kern" time="09:22" color="var(--lav-500)" initials="MK">
          And the one-pager for the deck:
          <AttachmentFile name="q3-narrative-v2.pdf" size="1.8 MB" kind="PDF" color="var(--blood-500)" />
        </Message>

        <DaySep label="— Today · April 24 —" />

        <Message author="You" time="11:47" color="var(--ink-500)" initials="YO">
          Reviewed. Cold-open trim looks good. Ship the <span className="tape-highlight">director's cut</span> by EOD?
        </Message>

        <Message author="Rahul Shah" time="11:49" color="var(--ember-500)" initials="RS" reactions={[{e:'✅', n:1}]}>
          Locked. Uploading the final now.
        </Message>
      </div>

      <div className="composer">
        <div className="composer-box">
          <textarea placeholder={`Message #${chat.name}`} defaultValue=""/>
          <div className="composer-tools">
            <div className="composer-tool" title="Attach">{I.paperclip}</div>
            <div className="composer-tool" title="Mention">{I.atSign}</div>
            <div className="composer-tool" title="Emoji">{I.smile}</div>
            <div className="composer-tool" title="Voice note">{I.mic}</div>
            <span style={{marginLeft:'auto', font:'500 10px/1 var(--font-mono)', color:'var(--fg3)', letterSpacing:'.1em', textTransform:'uppercase'}}>⌘↵ to send</span>
            <button className="btn btn-primary" style={{padding:'6px 12px', marginLeft: 8}}>{I.send}<span>Send</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadPanel() {
  return (
    <aside className="thread-panel">
      <div className="thread-head">
        <span className="title">Thread</span>
        <span className="sub">3 REPLIES</span>
        <button className="btn btn-ghost" style={{marginLeft:'auto', padding:4}}>{I.x}</button>
      </div>
      <div className="thread-body">
        <Message author="Jae Lim" time="09:21" color="var(--mint-500)" initials="JL">
          Here's the latest cut — give it a pass when you're free.
        </Message>
        <hr style={{border:0, borderTop:'1px solid var(--border-soft)', margin:'14px 0'}}/>
        <Message author="Rahul Shah" time="09:30" color="var(--ember-500)" initials="RS">
          Frame 00:04 feels long. Can you cut 6s from the cold-open?
        </Message>
        <Message author="Jae Lim" time="09:35" color="var(--mint-500)" initials="JL">
          Yep. Re-uploading now.
        </Message>
        <Message author="Mia Kern" time="09:42" color="var(--lav-500)" initials="MK" reactions={[{e:'🎬', n:1}]}>
          Locked version pushed. sha256 verified.
        </Message>
      </div>
    </aside>
  );
}

function MediaView() {
  const tiles = [
    { k: 'image', bg: 'linear-gradient(135deg, #FF512E, #FFCB3D)', label: 'IMG_0421.heic', meta: '2.1 MB' },
    { k: 'video', bg: 'linear-gradient(135deg, #1E2247, #5E3DC7)', label: 'reel-final-v4.mp4', meta: '842 MB' },
    { k: 'image', bg: 'linear-gradient(135deg, #2EBD82, #17885A)', label: 'moodboard-3.png', meta: '4.4 MB' },
    { k: 'video', bg: 'linear-gradient(135deg, #C8361A, #6B1708)', label: 'cold-open-alt.mp4', meta: '210 MB' },
    { k: 'image', bg: 'linear-gradient(135deg, #FFCB3D, #D49900)', label: 'type-spec.png',  meta: '900 KB' },
    { k: 'image', bg: 'linear-gradient(135deg, #8B6BF0, #2B1766)', label: 'composite-09.jpg', meta: '3.2 MB' },
  ];
  return (
    <div style={{flex:1, overflow:'auto'}}>
      <div style={{padding:'18px 24px 0', display:'flex', alignItems:'center', gap:10}}>
        <h2 style={{font:'700 24px/1 var(--font-sans)'}}>Media</h2>
        <span className="caseno">IN #Q3-CAMPAIGN</span>
        <div style={{marginLeft:'auto', display:'flex', gap:6}}>
          {['All', 'Images', 'Videos', 'Docs', 'Audio', 'Links'].map((t,i) => (
            <div key={t} className={'chat-tab ' + (i===0?'active':'')}>{t}</div>
          ))}
        </div>
      </div>
      <div className="media-grid">
        {tiles.map((t,i) => (
          <div key={i} className="media-tile">
            <div className="bg" style={{background: t.bg}}>
              {t.k === 'video' && (
                <div style={{width:44,height:44,borderRadius:999,background:'rgba(255,253,248,.92)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ink-900)'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
              )}
            </div>
            <div className="meta"><span>{t.label}</span><span>{t.meta}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesView() {
  const rows = [
    { name:'reel-final-v4.mp4', kind:'MP4', color:'var(--blood-500)', size:'842 MB', by:'Rahul', when:'2 min ago', tag:'#review' },
    { name:'q3-narrative-v2.pdf', kind:'PDF', color:'var(--blood-700)', size:'1.8 MB', by:'Mia', when:'8 min ago', tag:'#approved' },
    { name:'moodboard.fig', kind:'FIG', color:'var(--lav-500)', size:'22.3 MB', by:'Jae', when:'1 hr ago', tag:'#q3-reel' },
    { name:'campaign-budget.xlsx', kind:'XLS', color:'var(--mint-500)', size:'412 KB', by:'You', when:'Yesterday', tag:'#archive' },
    { name:'voiceover-takes.zip', kind:'ZIP', color:'var(--ink-500)', size:'218 MB', by:'Rahul', when:'2 days ago', tag:'#review' },
    { name:'type-spec.png', kind:'PNG', color:'var(--tape-700)', size:'900 KB', by:'Mia', when:'3 days ago', tag:'—' },
  ];
  return (
    <div className="files-wrap" style={{flex:1}}>
      <div className="files-head">
        <div>
          <div className="caseno">PROJECT · MARKETING</div>
          <h2 style={{font:'700 24px/1.2 var(--font-sans)', marginTop:6}}>All files</h2>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-secondary">{I.folder}<span>New folder</span></button>
          <button className="btn btn-primary">{I.plus}<span>Upload</span></button>
        </div>
      </div>
      <table className="files-table">
        <thead>
          <tr>
            <th>Name</th><th>Size</th><th>Uploader</th><th>Modified</th><th>Tag</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i}>
              <td>
                <div className="file-cell">
                  <div className="file-ico" style={{background:r.color}}>{r.kind}</div>
                  <span style={{fontWeight:600}}>{r.name}</span>
                </div>
              </td>
              <td style={{color:'var(--fg2)', fontFamily:'var(--font-mono)', fontSize:13}}>{r.size}</td>
              <td style={{color:'var(--fg2)'}}>{r.by}</td>
              <td style={{color:'var(--fg3)', fontFamily:'var(--font-mono)', fontSize:12}}>{r.when}</td>
              <td><span className="chip" style={{background:'var(--paper-100)', color:'var(--fg2)', border:'1px solid var(--border-soft)'}}>{r.tag}</span></td>
              <td style={{textAlign:'right'}}><button className="btn btn-ghost" style={{padding:4}}>{I.moreH}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadPill({ pct = 62 }) {
  return (
    <div className="upload-pill">
      <div className="upload-head">
        {I.paperclip}
        <span className="t">Uploading 1 file</span>
        <span style={{marginLeft:'auto'}} className="caseno">{pct}%</span>
      </div>
      <div className="upload-row">
        <div className="name"><span>reel-final-v4.mp4</span><span style={{color:'var(--fg3)', fontFamily:'var(--font-mono)', fontWeight:400, fontSize:11}}>522 / 842 MB</span></div>
        <div className="bar"><div className="fill" style={{width: pct + '%'}}/></div>
        <div className="meta">Chunk 64 / 105 · sha256 pending · resumable</div>
      </div>
    </div>
  );
}

window.UIKit = Object.assign(window.UIKit || {}, { ChatView, ThreadPanel, MediaView, FilesView, UploadPill });
})();
