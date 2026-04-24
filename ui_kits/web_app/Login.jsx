/* global React, UIKit */
(function(){
const { useState } = React;
const { I } = UIKit;

function LoginScreen({ variant, onLogin }) {
  // variant: 'classic' | 'ink' | 'tape'
  return (
    <div className="login">
      <div className="login-left">
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <img src="../../assets/logo-wordmark.svg" height="40" alt="Dev Thriller"/>
        </div>

        <div style={{maxWidth: 360}}>
          <div className="caseno" style={{marginBottom: 10}}>CASE · 0001 — SIGN IN</div>
          <h1 style={{font:'700 32px/1.15 var(--font-sans)', letterSpacing:'-.01em', marginBottom: 8}}>
            Welcome back.
          </h1>
          <p style={{color:'var(--fg2)', font:'400 15px/1.5 var(--font-sans)', marginBottom:24}}>
            Pick up where you left off. The case file is still open.
          </p>

          <div className="login-form">
            <button className="login-oauth">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38"/></svg>
              Continue with Google
            </button>
            <div className="login-divider">or</div>
            <div>
              <label>Email</label>
              <input defaultValue="you@devthriller.io"/>
            </div>
            <div>
              <label>Password</label>
              <input type="password" defaultValue="••••••••••"/>
            </div>
            <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:12, fontSize:14}} onClick={onLogin}>Sign in →</button>
            <div style={{display:'flex', justifyContent:'space-between', font:'400 12px/1 var(--font-sans)', color:'var(--fg3)'}}>
              <a className="t-link" href="#">Forgot password?</a>
              <a className="t-link" href="#">Use magic link instead</a>
            </div>
          </div>
        </div>

        <div className="caseno" style={{color:'var(--fg4)'}}>DEV THRILLER · v1.0.0</div>
      </div>

      <div className="login-right" style={{background: variant==='tape' ? 'var(--ember-500)' : 'var(--ink-900)'}}>
        {variant === 'tape' && <div className="login-tape" style={{background:'var(--ink-900)'}}>
          <div className="login-tape-inner" style={{color:'var(--tape-500)'}}>
            <span>CASE FILE</span><span>·</span><span>OPEN</span><span>·</span><span>CASE FILE</span><span>·</span><span>OPEN</span>
          </div>
        </div>}
        {variant !== 'tape' && <div className="login-tape">
          <div className="login-tape-inner">
            <span>EVIDENCE</span><span>·</span><span>VERIFIED</span><span>·</span><span>EVIDENCE</span><span>·</span><span>VERIFIED</span>
          </div>
        </div>}

        <div style={{position:'relative', zIndex:1}}>
          <div className="caseno" style={{color:'var(--tape-500)', marginBottom:16}}>— PITCH —</div>
          <div className="login-art">
            The <span className="t" style={{fontStyle:'italic'}}>suspense</span> of a thriller.<br/>
            The <span className="t" style={{background:'linear-gradient(180deg, transparent 60%, var(--ember-500) 60%, var(--ember-500) 92%, transparent 92%)'}}>precision</span> of a dev tool.
          </div>
          <p className="login-quote" style={{marginTop: 32}}>
            Dev Thriller is where teams talk, share evidence, and close cases. 5,000 messages. 1 GB uploads. Zero drama — except the fun kind.
          </p>
        </div>
      </div>
    </div>
  );
}

window.UIKit = Object.assign(window.UIKit || {}, { LoginScreen });
})();
