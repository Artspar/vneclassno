'use client';

import Link from 'next/link';
import { useState } from 'react';
import { acceptInvite, createInvite, getMeContext, loginPwa, loginTelegram } from '../../lib/api';

export default function DemoLab() {
  const [sectionId, setSectionId] = useState('section-b');
  const [coachTelegramId, setCoachTelegramId] = useState('1002');
  const [parentPhone, setParentPhone] = useState('+79990000001');
  const [parentOtpCode, setParentOtpCode] = useState('1234');

  const [coachToken, setCoachToken] = useState('');
  const [parentToken, setParentToken] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [childId, setChildId] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);

  function pushLog(message: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 12));
  }

  async function runCoachLogin() {
    setBusy(true);
    setError('');
    try {
      const auth = await loginTelegram(`id=${coachTelegramId}`);
      setCoachToken(auth.accessToken);
      pushLog(`Вход админа/тренера выполнен (${auth.user.id})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти как тренер');
    } finally {
      setBusy(false);
    }
  }

  async function runCreateInvite() {
    if (!coachToken) {
      setError('Сначала войдите как админ/тренер');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const invite = await createInvite(coachToken, sectionId);
      setInviteToken(invite.token);
      setInviteUrl(invite.pwaInviteUrl);
      pushLog(`Инвайт создан для ${sectionId}: ${invite.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать инвайт');
    } finally {
      setBusy(false);
    }
  }

  async function runParentLoginAndResolveChild() {
    setBusy(true);
    setError('');
    try {
      const auth = await loginPwa(parentPhone, parentOtpCode);
      setParentToken(auth.accessToken);
      const context = await getMeContext(auth.accessToken);
      const firstChild = context.children[0];
      if (firstChild) {
        setChildId(firstChild.id);
        pushLog(`Вход родителя выполнен, выбран ребенок ${firstChild.firstName} ${firstChild.lastName}`);
      } else {
        pushLog('Вход родителя выполнен, детей пока нет');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти как родитель');
    } finally {
      setBusy(false);
    }
  }

  async function runAcceptInvite() {
    if (!inviteToken) {
      setError('Сначала создайте инвайт');
      return;
    }
    if (!parentToken) {
      setError('Сначала выполните вход родителя');
      return;
    }
    if (!childId) {
      setError('Не найден ребенок для заявки');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await acceptInvite(inviteToken, parentToken, { childId });
      pushLog(`Инвайт принят, статус заявки: ${result.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось принять инвайт');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card stack">
        <span className="badge">UI Test Lab</span>
        <h1>Тест без терминала</h1>
        <p className="caption">Полный тест invite-флоу через кнопки в браузере.</p>
      </div>

      <div className="card stack">
        <h2>1. Параметры</h2>
        <input value={sectionId} onChange={(e) => setSectionId(e.target.value)} placeholder="sectionId" />
        <input
          value={coachTelegramId}
          onChange={(e) => setCoachTelegramId(e.target.value)}
          placeholder="telegram id тренера/админа"
        />
        <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="телефон родителя" />
        <input value={parentOtpCode} onChange={(e) => setParentOtpCode(e.target.value)} placeholder="otp код" />
      </div>

      <div className="card stack">
        <h2>2. Сценарий</h2>
        <button disabled={busy} onClick={() => void runCoachLogin()}>
          Войти как админ/тренер
        </button>
        <button disabled={busy || !coachToken} onClick={() => void runCreateInvite()}>
          Создать инвайт
        </button>
        <button disabled={busy} className="secondary" onClick={() => void runParentLoginAndResolveChild()}>
          Войти как родитель
        </button>
        <button disabled={busy || !inviteToken || !parentToken || !childId} onClick={() => void runAcceptInvite()}>
          Принять инвайт выбранным ребенком
        </button>
      </div>

      <div className="card stack">
        <h2>3. Быстрые ссылки</h2>
        <p className="caption">invite token: {inviteToken || 'еще не создан'}</p>
        <p className="caption mono">child id: {childId || 'не выбран'}</p>
        {inviteToken && (
          <Link href={`/invite/${inviteToken}`}>Открыть страницу инвайта в PWA</Link>
        )}
        {inviteUrl && (
          <a href={inviteUrl} target="_blank" rel="noreferrer">
            Открыть pwaInviteUrl в новой вкладке
          </a>
        )}
      </div>

      <div className="card stack">
        <h2>Лог</h2>
        {log.length === 0 && <p className="caption">Действий пока нет.</p>}
        {log.map((line, index) => (
          <p key={`${line}-${index}`} className="caption mono">
            {line}
          </p>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
