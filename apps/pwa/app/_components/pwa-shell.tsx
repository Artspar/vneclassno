'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMeContext, loginPwa, type MeContextResponse } from '../../lib/api';

const ACCESS_TOKEN_KEY = 'vneclassno_pwa_access_token';

type Tab = 'home' | 'schedule' | 'attendance' | 'payments' | 'profile';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Главная' },
  { id: 'schedule', label: 'Календарь' },
  { id: 'attendance', label: 'Посещения' },
  { id: 'payments', label: 'Платежи' },
  { id: 'profile', label: 'Профиль' },
];

export default function PwaShell() {
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('+79990000001');
  const [otpCode, setOtpCode] = useState('1234');
  const [accessToken, setAccessToken] = useState('');
  const [context, setContext] = useState<MeContextResponse | null>(null);
  const [activeChildId, setActiveChildId] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
    if (!stored) {
      return;
    }

    setAccessToken(stored);
    void loadContext(stored);
  }, []);

  async function loadContext(token: string) {
    setBusy(true);
    setError('');
    try {
      const nextContext = await getMeContext(token);
      setContext(nextContext);
      setActiveChildId(nextContext.activeChildId ?? nextContext.children[0]?.id ?? '');
      setActiveSectionId(nextContext.activeSectionId ?? nextContext.sections[0]?.id ?? '');
    } catch (e) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      setAccessToken('');
      setContext(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить контекст');
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setError('');
    try {
      const auth = await loginPwa(phone, otpCode);
      window.localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
      setAccessToken(auth.accessToken);
      await loadContext(auth.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken('');
    setContext(null);
    setActiveChildId('');
    setActiveSectionId('');
    setTab('home');
  }

  const activeChild = context?.children.find((child) => child.id === activeChildId) ?? context?.children[0];
  const activeSection = context?.sections.find((section) => section.id === activeSectionId) ?? context?.sections[0];

  if (!accessToken || !context) {
    return (
      <main className="app-main">
        <div className="hero-card card stack fade-in-1">
          <span className="badge">VneClassno Family</span>
          <h1>Добро пожаловать</h1>
          <p className="caption">Вход один раз. Дальше приложение открывается сразу с вашими детьми и секциями.</p>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
          <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Код" />
          <button disabled={busy} onClick={() => void login()}>
            {busy ? 'Входим...' : 'Продолжить'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="app-gradient" />
      <section className="top-context card stack fade-in-1">
        <div className="top-row">
          <span className="badge">Родитель</span>
          <button className="ghost-button" onClick={logout}>
            Выйти
          </button>
        </div>

        <div className="context-grid">
          <div className="stack">
            <p className="caption">Ребенок</p>
            <select value={activeChildId} onChange={(e) => setActiveChildId(e.target.value)}>
              {context.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.firstName} {child.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="stack">
            <p className="caption">Секция</p>
            <select value={activeSectionId} onChange={(e) => setActiveSectionId(e.target.value)}>
              {context.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="tab-screen card stack fade-in-2">
        {tab === 'home' && (
          <>
            <div className="headline-row">
              <h2>{activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : 'Ребенок не выбран'}</h2>
              <span className="status-pill live">На занятии</span>
            </div>
            <p className="caption">Секция: {activeSection?.name ?? 'не выбрана'}</p>
            <div className="metric-grid">
              <article className="metric-item metric-warm">
                <p className="caption">Баланс абонемента</p>
                <h3>8 занятий</h3>
              </article>
              <article className="metric-item metric-cool">
                <p className="caption">Ближайшее занятие</p>
                <h3>Сегодня 18:00</h3>
              </article>
              <article className="metric-item metric-fresh">
                <p className="caption">Списано за месяц</p>
                <h3>6 занятий</h3>
              </article>
            </div>
          </>
        )}

        {tab === 'schedule' && (
          <>
            <h2>Расписание</h2>
            <p className="caption">Вт 18:00, Чт 18:00, Сб 11:00</p>
            <div className="list-card">Сегодня 18:00 · Тренировка · Зал 2</div>
            <div className="list-card">Воскресенье 13:30 · Игра · Стадион А</div>
          </>
        )}

        {tab === 'attendance' && (
          <>
            <h2>Посещения</h2>
            <div className="list-card">12 мар · присутствовал</div>
            <div className="list-card">14 мар · отсутствовал (подтверждено тренером)</div>
            <div className="list-card">19 мар · присутствовал</div>
          </>
        )}

        {tab === 'payments' && (
          <>
            <h2>Платежи</h2>
            <div className="list-card">Оплачено: 4 500 ₽ · auto_link</div>
            <div className="list-card">На проверке: 2 000 ₽ · manual_transfer</div>
            <button>Оплатить по СБП</button>
          </>
        )}

        {tab === 'profile' && (
          <>
            <h2>Профиль</h2>
            <p className="caption">Телефон: {phone}</p>
            <Link href="/demo" className="link-block">
              Открыть UI Test Lab
            </Link>
          </>
        )}
      </section>

      <nav className="tabbar card fade-in-3" aria-label="Навигация">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tabbar-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
