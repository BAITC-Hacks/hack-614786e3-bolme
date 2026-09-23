import type { Metadata } from "next";
import { safeNext } from "@/auth/session";
import "./login.css";

export const metadata: Metadata = { title: "Вход для жюри · АКИМ" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const failed = params.error === "1";
  const next = safeNext(params.next);
  return (
    <main className="login">
      <div className="login__backdrop" aria-hidden />
      <form className="login__card" method="post" action="/api/login">
        <p className="login__brand">
          АКИМ <span>Астана</span>
        </p>
        <h1 className="login__title">Вход для жюри</h1>
        <p className="login__lead">AI-симулятор управления городом · HackAlem, кейс «Аким на 5 часов» · команда Bolme</p>
        <input type="hidden" name="next" value={next} />
        <label className="login__field">
          <span>Логин</span>
          <input name="login" autoComplete="username" required autoFocus placeholder="reviewer" />
        </label>
        <label className="login__field">
          <span>Пароль</span>
          <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </label>
        {failed && (
          <p className="login__error" role="alert">
            Неверный логин или пароль. Данные для входа — в README репозитория.
          </p>
        )}
        <button type="submit" className="login__submit">
          Войти в симулятор
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <p className="login__hint">Логин и пароль для проверяющих указаны в README.</p>
      </form>
    </main>
  );
}
