"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/shared/icon";
import { useAuth } from "./auth-provider";

export function LoginForm() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (!ready || !user) return;
    router.replace(user.role === "ADMIN" ? "/admin" : user.role === "NURSE" ? "/nurse/dashboard" : user.role === "SECRETARY" ? "/secretary/dashboard" : "/dashboard");
  }, [ready, user, router]);
  const canSubmit = username.trim().length > 0 && password.length > 0;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = new FormData(event.currentTarget);
    const trimmedUsername = username.trim();
    const nextErrors = { username: trimmedUsername ? undefined : "Saisissez votre nom d’utilisateur.", password: password ? undefined : "Saisissez votre mot de passe." };
    setErrors(nextErrors);
    setError("");
    if (nextErrors.username || nextErrors.password) {
      formRef.current?.querySelector<HTMLInputElement>(nextErrors.username ? "#username" : "#password")?.focus();
      return;
    }
    setLoading(true);
    try {
      await login({ username: trimmedUsername, password }, data.get("remember") === "on");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Connexion impossible. Veuillez réessayer."); }
    finally { setLoading(false); }
  }
  return <div className="login-content">
    <div className="login-titles"><h1>Connexion</h1><p>Connectez-vous à votre espace professionnel de soins.</p></div>
    <form ref={formRef} onSubmit={submit} noValidate className="login-form" aria-busy={loading}>
      <div className="form-field"><label htmlFor="username">Nom d’utilisateur</label><Input id="username" name="username" placeholder="dr.gaya" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={loading} value={username} onChange={(event) => { setUsername(event.target.value); if (errors.username) setErrors((current) => ({ ...current, username: undefined })); }} icon={<Icon name="username" />} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? "username-error" : undefined} />{errors.username && <p id="username-error" className="field-error">{errors.username}</p>}</div>
      <div className="form-field"><div className="field-label-row"><label htmlFor="password">Mot de passe</label><button type="button" className="text-button" onClick={() => setHelp(!help)} aria-expanded={help} aria-controls="password-help">Mot de passe oublié ?</button></div><Input id="password" name="password" placeholder="••••••••••••" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={loading} value={password} onChange={(event) => { setPassword(event.target.value); if (errors.password) setErrors((current) => ({ ...current, password: undefined })); }} icon={<Icon name="lock" />} trailing={<button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}><Icon name="eye" /></button>} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />{errors.password && <p id="password-error" className="field-error">{errors.password}</p>}</div>
      {help && <p id="password-help" className="help-text" role="status">Contactez l’administrateur du cabinet pour réinitialiser votre mot de passe.</p>}
      <label className="remember-device"><input type="checkbox" name="remember" defaultChecked disabled={loading} /><span>Se souvenir de cet appareil sur ce poste sécurisé</span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" className="login-submit" loading={loading} disabled={!canSubmit}>{loading ? "Connexion en cours…" : "Se connecter"}{!loading && <Icon name="arrow-right" />}</Button>
    </form>
    <div className="login-guidance"><p><strong>Première connexion ?</strong> Munissez-vous du mot de passe temporaire remis par l’administrateur.</p><p className="role-routing">Aiguillage automatique des rôles <span>·</span> Chirurgien / Soins / Facturation</p></div>
    <div className="security-notice"><span aria-hidden="true">🔒</span><p>Accès strictement réservé au personnel soignant et administratif habilité. Toute tentative d’accès non autorisé est enregistrée et soumise au secret médical (Code de la Santé).</p></div>
  </div>;
}
