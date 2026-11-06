"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";
import { supabase } from "../../lib/supabase";
export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [showPassword,setShowPassword]=useState(false);
  const [emailError,setEmailError]=useState(""); const [passwordError,setPasswordError]=useState(""); const [status,setStatus]=useState(""); const [statusIsSuccess,setStatusIsSuccess]=useState(false);
  const [resetLoading,setResetLoading]=useState(false); const [loading,setLoading]=useState(false);
  async function handleLogin(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(loading)return; setEmailError("");setPasswordError("");setStatus("");setStatusIsSuccess(false);
    const normalizedEmail=email.trim().toLowerCase(); if(!normalizedEmail){setEmailError("Enter your email address.");return;} if(!password){setPasswordError("Enter your password.");return;}
    setLoading(true);
    try {
      const {data,error}=await supabase.auth.signInWithPassword({email:normalizedEmail,password}); if(error)throw error;
      if(!data.user){setPasswordError("Login could not be completed. Please try again.");return;}
      let profile:{display_name?:string|null;position?:string|null;years_pro?:number|null}|null=null;
      try {const result=await supabase.from("profiles").select("display_name,position,years_pro").eq("id",data.user.id).maybeSingle();profile=result.data;}
      catch(profileError){console.error("Could not load profile after login:",profileError);}
      const needsOnboarding=!profile?.display_name||(!profile?.position&&profile?.years_pro==null);
      setStatus("Signed in. Opening your HoopCheck workspace…");setStatusIsSuccess(true);
      window.setTimeout(()=>window.location.replace(needsOnboarding?"/onboarding":"/dashboard"),650);
    } catch(error) {
      console.error("Login failed:",error);const message=error instanceof Error?error.message:"Unable to sign in right now. Please try again.";
      if(/email|user not found/i.test(message))setEmailError(message);else setPasswordError(/password|credentials|invalid login/i.test(message)?"Email or password is incorrect. Please try again.":message);
    } finally {setLoading(false);}
  }
  async function handlePasswordReset() {
    const normalizedEmail=email.trim().toLowerCase();setEmailError("");setPasswordError("");setStatus("");
    if(!normalizedEmail){setEmailError("Enter your email address first.");return;}if(resetLoading)return;setResetLoading(true);
    try {const {error}=await supabase.auth.resetPasswordForEmail(normalizedEmail,{redirectTo:`${window.location.origin}/reset-password`});if(error)throw error;setStatus("If an account exists for that email, we sent a password reset link.");setStatusIsSuccess(true);}
    catch(error){setEmailError(error instanceof Error?error.message:"Unable to send a reset link right now. Please try again.");}
    finally{setResetLoading(false);}
  }
  return <main className="hc-auth-page hc-login-page"><section className="hc-auth-form-section">
    <div className="form hc-auth-card hc-login-card">
      <Link href="/" className="hc-auth-logo" aria-label="HoopCheck home"><Logo variant="full" size={46}/></Link>
      <div className="eyebrow">WELCOME BACK</div><h1>Sign in to HoopCheck</h1>
      <form onSubmit={handleLogin} noValidate>
        <div className="hc-login-field"><label htmlFor="email">EMAIL</label><input id="email" className="input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailError("");}} placeholder="you@example.com" autoComplete="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError?"email-error":undefined} required/>{emailError&&<p id="email-error" className="hc-login-error" role="alert">{emailError}</p>}</div>
        <div className="hc-login-field"><label htmlFor="password">PASSWORD</label><div className="hc-password-control"><input id="password" className="input" type={showPassword?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setPasswordError("");}} placeholder="Your password" autoComplete="current-password" aria-invalid={Boolean(passwordError)} aria-describedby={passwordError?"password-error":undefined} required/><button type="button" className="hc-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword}>{showPassword?"HIDE":"SHOW"}</button></div>{passwordError&&<p id="password-error" className="hc-login-error" role="alert">{passwordError}</p>}</div>
        <button type="submit" className="btn hc-login-submit" disabled={loading}>{loading?"SIGNING IN…":"SIGN IN"}<span aria-hidden="true">↗</span></button>
      </form>
      {status&&<p className={statusIsSuccess?"hc-login-status is-success":"hc-login-status"} role="status" aria-live="polite">{status}</p>}
      <button type="button" className="hc-login-forgot" onClick={handlePasswordReset} disabled={resetLoading}>{resetLoading?"Sending reset link…":"Forgot password?"}</button>
      <p className="hc-login-signup">New to HoopCheck? <Link href="/signup">Create your account</Link></p>
    </div>
  </section></main>;
}
