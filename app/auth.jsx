/* global React */
(function(){
const { useState } = React;
const { I } = window.DT;

// Login
function Login({ onLogin, onSignup }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div style={{height:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', background:'var(--bg)'}}>
      <div style={{padding:'60px 60px', display:'flex', flexDirection:'column', justifyContent:'space-between', background:'var(--paper-50)', borderRight:'1px solid var(--border-soft)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <img src="../assets/logo-monogram.svg" height="32"/>
          <span style={{font:'700 16px/1 var(--font-sans)'}}>Dev Thriller</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email); }} style={{maxWidth:360, width:'100%', display:'grid', gap:14}}>
          <div>
            <div className="caseno" style={{marginBottom:6}}>CASE · 0001 · LOGIN</div>
            <h1 style={{font:'400 40px/1.1 var(--font-display)', margin:0, letterSpacing:'-.01em'}}>Welcome back,<br/>detective.</h1>
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" placeholder="you@studio.dev" value={email} onChange={e => setEmail(e.target.value)} required/>
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} required/>
            <div className="hint"><a href="#" onClick={e => e.preventDefault()}>Forgot password?</a></div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{justifyContent:'center'}}>Sign in</button>
          <div style={{display:'flex', alignItems:'center', gap:10, font:'500 10px/1 var(--font-mono)', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg3)', margin:'4px 0'}}>
            <div style={{flex:1, height:1, background:'var(--border-soft)'}}/>or<div style={{flex:1, height:1, background:'var(--border-soft)'}}/>
          </div>
          <button type="button" className="btn btn-secondary btn-lg" style={{justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38"/></svg>
            Continue with Google
          </button>
          <div style={{textAlign:'center', font:'400 12px/1.4 var(--font-sans)', color:'var(--fg3)', marginTop:4}}>
            New here? <a href="#" onClick={e => { e.preventDefault(); onSignup(); }}>Create an account</a>
          </div>
        </form>
        <div style={{font:'400 11px/1 var(--font-mono)', color:'var(--fg3)'}}>© 2026 Dev Thriller · v1.4.2</div>
      </div>
      <div style={{background:'var(--ink-900)', color:'#FFFDF8', padding:60, display:'flex', flexDirection:'column', justifyContent:'center', gap:24, position:'relative', overflow:'hidden'}}>
        <div style={{font:'400 52px/1.1 var(--font-display)', letterSpacing:'-.01em', zIndex:1}}>
          The suspense of a <span style={{fontStyle:'italic'}}>thriller</span>.<br/>
          The <span style={{background:'linear-gradient(180deg, transparent 60%, rgba(255,203,61,.7) 60%, rgba(255,203,61,.7) 92%, transparent 92%)', padding:'0 4px'}}>precision</span> of a dev tool.
        </div>
        <div style={{font:'400 15px/1.5 var(--font-sans)', color:'#C8CCE8', maxWidth:440, zIndex:1}}>
          A team chat where every file is versioned, every upload resumable, every plot point traceable.
        </div>
        <div style={{position:'absolute', width:'140%', height:44, left:'-20%', transform:'rotate(-8deg)', background:'var(--ember-500)', top:'62%', zIndex:0, display:'flex', alignItems:'center', justifyContent:'space-around', font:'700 12px/1 var(--font-mono)', letterSpacing:'.3em', color:'var(--ink-900)'}}>
          <span>CASE · 0001</span><span>DO NOT CROSS</span><span>CASE · 0001</span><span>DO NOT CROSS</span><span>CASE · 0001</span>
        </div>
      </div>
    </div>
  );
}

// Sign up
function Signup({ onLogin }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ email: '', name: '', pw: '' });
  const up = (k, v) => setForm(f => ({...f, [k]: v}));
  return (
    <div style={{height:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', background:'var(--bg)'}}>
      <div style={{padding:60, display:'flex', flexDirection:'column', justifyContent:'space-between', background:'var(--paper-50)', borderRight:'1px solid var(--border-soft)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <img src="../assets/logo-monogram.svg" height="32"/>
          <span style={{font:'700 16px/1 var(--font-sans)'}}>Dev Thriller</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(form.email || 'new@studio.dev'); }} style={{maxWidth:360, width:'100%', display:'grid', gap:14}}>
          <div>
            <div className="caseno" style={{marginBottom:6}}>CASE · 0000 · NEW FILE</div>
            <h1 style={{font:'400 40px/1.1 var(--font-display)', margin:0, letterSpacing:'-.01em'}}>Open a <span style={{fontStyle:'italic'}}>new case</span>.</h1>
            <div style={{color:'var(--fg2)', marginTop:6}}>30-day free trial. No card required.</div>
          </div>
          <div className="field">
            <label>Work email</label>
            <input className="input" type="email" placeholder="you@studio.dev" value={form.email} onChange={e => up('email', e.target.value)} required/>
          </div>
          <div className="field">
            <label>Full name</label>
            <input className="input" type="text" placeholder="Jane Director" value={form.name} onChange={e => up('name', e.target.value)} required/>
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="12+ chars" value={form.pw} onChange={e => up('pw', e.target.value)} required minLength={8}/>
            <div className="hint">sha256 hashed. mTLS on the wire. read the <a href="#" onClick={e=>e.preventDefault()}>security docs</a>.</div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{justifyContent:'center'}}>Create account →</button>
          <div style={{textAlign:'center', font:'400 12px/1.4 var(--font-sans)', color:'var(--fg3)'}}>
            Already a detective? <a href="#" onClick={e => { e.preventDefault(); onLogin(''); }}>Sign in</a>
          </div>
        </form>
        <div style={{font:'400 11px/1.4 var(--font-mono)', color:'var(--fg3)', maxWidth:360}}>
          By continuing you accept the Terms and Privacy Policy. SOC 2 Type II. GDPR compliant.
        </div>
      </div>
      <div style={{background:'var(--ink-900)', color:'#FFFDF8', padding:60, display:'flex', flexDirection:'column', justifyContent:'center', gap:18}}>
        <div className="caseno" style={{color:'#7B80B0'}}>EVIDENCE · 01 · 02 · 03</div>
        <div style={{display:'grid', gap:20, marginTop:8}}>
          {[
            ['Every upload is a case file.', 'Chunked, resumable, sha256 verified. Your 4 GB render won\'t die on a reconnect.'],
            ['Every message has a chain.', 'Thread replies pin to timestamps. Finalized versions lock. Everything is traceable.'],
            ['Every case is encrypted.', 'AES-256 at rest, mTLS in flight, zero-knowledge option for legal workspaces.'],
          ].map(([t, s], i) => (
            <div key={i} style={{display:'flex', gap:14}}>
              <div style={{width:32, height:32, borderRadius:6, background:'var(--ember-500)', color:'#0E1130', font:'700 14px/32px var(--font-mono)', textAlign:'center', flexShrink:0}}>0{i+1}</div>
              <div>
                <div style={{font:'600 15px/1.3 var(--font-sans)'}}>{t}</div>
                <div style={{color:'#C8CCE8', fontSize:13, marginTop:3}}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Onboarding
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name:'Jane Director', role:'Director', avatar:'JD', workspace:'Acme Marketing', domain:'acme.dev', integrations:[], upload:0 });
  const steps = [
    { title: 'Profile', sub: 'Who are you on the credits?' },
    { title: 'Workspace', sub: 'Open your studio.' },
    { title: 'Integrations', sub: 'Wire up the usual suspects.' },
    { title: 'First upload', sub: 'Drop a file to test the chain.' },
  ];
  const up = (k, v) => setData(d => ({...d, [k]: v}));
  const next = () => step < 3 ? setStep(s => s+1) : onDone();
  const prev = () => step > 0 ? setStep(s => s-1) : null;
  const toggle = (k) => up('integrations', data.integrations.includes(k) ? data.integrations.filter(x=>x!==k) : [...data.integrations, k]);

  return (
    <div style={{height:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column'}}>
      <div style={{padding:'18px 28px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid var(--border-soft)'}}>
        <img src="../assets/logo-monogram.svg" height="24"/>
        <span style={{font:'700 14px/1 var(--font-sans)'}}>Dev Thriller</span>
        <div style={{flex:1, display:'flex', gap:8, justifyContent:'center', maxWidth:520, margin:'0 auto'}}>
          {steps.map((s, i) => (
            <div key={i} style={{flex:1, display:'flex', alignItems:'center', gap:8}}>
              <div style={{width:22, height:22, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', background: i <= step ? 'var(--ember-500)' : 'var(--paper-100)', color: i <= step ? '#fff' : 'var(--fg3)', font:'600 11px/1 var(--font-mono)', border: i === step ? '2px solid var(--ember-200)' : '0'}}>
                {i < step ? '✓' : i+1}
              </div>
              <div style={{flex:1, height:2, background: i < step ? 'var(--ember-500)' : 'var(--border-soft)', display: i === steps.length-1 ? 'none' : 'block'}}/>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={onDone}>Skip setup</button>
      </div>

      <div style={{flex:1, overflow:'auto', padding:'40px 28px'}}>
        <div style={{maxWidth:560, margin:'0 auto'}}>
          <div className="caseno" style={{marginBottom:6}}>STEP {step+1} / 4 · {steps[step].title.toUpperCase()}</div>
          <h1 style={{font:'400 40px/1.1 var(--font-display)', letterSpacing:'-.01em', margin:'0 0 8px'}}>{steps[step].sub}</h1>

          {step === 0 && (
            <div style={{marginTop:28, display:'grid', gap:18}}>
              <div style={{display:'flex', alignItems:'center', gap:16}}>
                <div className="av av-xl" style={{background:'var(--ember-500)'}}>{data.avatar}</div>
                <div>
                  <button className="btn btn-secondary">Upload photo</button>
                  <div className="hint" style={{marginTop:6}}>SVG, PNG, JPG · 1 MB max</div>
                </div>
              </div>
              <div className="field"><label>Full name</label>
                <input className="input" value={data.name} onChange={e => up('name', e.target.value)}/>
              </div>
              <div className="field"><label>Your role</label>
                <select className="input" value={data.role} onChange={e => up('role', e.target.value)}>
                  <option>Director</option><option>Editor</option><option>Producer</option><option>Engineer</option><option>Other</option>
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{marginTop:28, display:'grid', gap:18}}>
              <div className="field"><label>Workspace name</label>
                <input className="input" value={data.workspace} onChange={e => up('workspace', e.target.value)}/>
                <div className="hint">You can invite teammates later.</div>
              </div>
              <div className="field"><label>Workspace URL</label>
                <div style={{display:'flex', alignItems:'center', gap:4, border:'1px solid var(--border)', borderRadius:6, padding:'0 10px', background:'var(--paper-0)'}}>
                  <input className="input" style={{border:0, padding:'8px 0'}} value={data.domain} onChange={e => up('domain', e.target.value)}/>
                  <span style={{color:'var(--fg3)', font:'400 13px/1 var(--font-mono)'}}>.devthriller.com</span>
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10}}>
                {['0-20 people','20-100','100+'].map((t,i) => (
                  <div key={t} onClick={() => up('size', t)} style={{padding:'14px', border:`1.5px solid ${data.size===t?'var(--ember-500)':'var(--border)'}`, borderRadius:8, textAlign:'center', cursor:'pointer', background:'var(--paper-0)'}}>
                    <div style={{font:'700 15px/1 var(--font-sans)'}}>{t}</div>
                    <div className="caseno" style={{marginTop:4}}>SIZE</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{marginTop:28, display:'grid', gap:10}}>
              {[
                {k:'slack', n:'Slack', d:'Mirror chats and notifications.', c:'#4A154B'},
                {k:'github', n:'GitHub', d:'Attach commits and PRs to cases.', c:'#24292F'},
                {k:'linear', n:'Linear', d:'Sync issues with chat threads.', c:'#5E6AD2'},
                {k:'figma', n:'Figma', d:'Embed frames in threads, auto-update.', c:'#F24E1E'},
                {k:'drive', n:'Google Drive', d:'Mirror folders as case files.', c:'#4285F4'},
              ].map(it => (
                <label key={it.k} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:`1.5px solid ${data.integrations.includes(it.k) ? 'var(--ember-500)' : 'var(--border-soft)'}`, borderRadius:8, cursor:'pointer', background:'var(--paper-0)'}}>
                  <div style={{width:32, height:32, borderRadius:6, background:it.c, color:'#fff', font:'700 13px/32px var(--font-sans)', textAlign:'center'}}>{it.n[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{font:'600 14px/1 var(--font-sans)'}}>{it.n}</div>
                    <div style={{color:'var(--fg3)', fontSize:12, marginTop:3}}>{it.d}</div>
                  </div>
                  <input type="checkbox" checked={data.integrations.includes(it.k)} onChange={() => toggle(it.k)} style={{width:18, height:18, accentColor:'var(--ember-500)'}}/>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div style={{marginTop:28}}>
              <div style={{border:'2px dashed var(--border)', borderRadius:12, padding:40, textAlign:'center', background:'var(--paper-50)'}}>
                <div style={{width:56, height:56, margin:'0 auto 14px', borderRadius:14, background:'var(--ember-500)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>{I.upload}</div>
                <div style={{font:'600 16px/1.2 var(--font-sans)'}}>Drop a file here, or <a href="#" onClick={e => { e.preventDefault(); up('upload', 1); }}>browse</a></div>
                <div className="caseno" style={{marginTop:8}}>CHUNKED · RESUMABLE · SHA256 VERIFIED</div>
              </div>
              {data.upload > 0 && (
                <div className="card" style={{marginTop:14}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{width:36, height:36, borderRadius:6, background:'var(--blood-500)', color:'#fff', font:'700 10px/1 var(--font-mono)', display:'flex', alignItems:'center', justifyContent:'center'}}>MP4</div>
                    <div style={{flex:1}}>
                      <div style={{font:'600 14px/1.2 var(--font-sans)'}}>first-upload.mp4</div>
                      <div className="caseno" style={{marginTop:3, textTransform:'none', letterSpacing:0, fontFamily:'var(--font-mono)'}}>CHUNK 12 / 18 · 67%</div>
                    </div>
                    <span className="chip success"><span className="dot"/>VERIFIED</span>
                  </div>
                  <div style={{height:4, background:'var(--paper-200)', borderRadius:999, marginTop:10, overflow:'hidden'}}>
                    <div style={{width:'67%', height:'100%', background:'var(--ember-500)'}}/>
                  </div>
                </div>
              )}
              <div style={{textAlign:'center', marginTop:16, color:'var(--fg3)', fontSize:13}}>You can also <a href="#" onClick={e => { e.preventDefault(); onDone(); }}>skip and upload later</a>.</div>
            </div>
          )}
        </div>
      </div>

      <div style={{padding:'14px 28px', display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border-soft)'}}>
        <button className="btn btn-ghost" onClick={prev} disabled={step===0} style={{visibility:step===0?'hidden':'visible'}}>← Back</button>
        <button className="btn btn-primary" onClick={next}>{step===3 ? 'Enter workspace →' : 'Continue →'}</button>
      </div>
    </div>
  );
}

window.DT.Auth = { Login, Signup, Onboarding };
})();
