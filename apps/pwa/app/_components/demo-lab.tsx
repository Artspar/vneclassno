'use client';

import Link from 'next/link';
import { useState } from 'react';
import { acceptInvite, createInvite, getMeContext, loginPwa, loginTelegram } from '../../lib/api';

type Step = 'coach' | 'invite' | 'parent' | 'accept' | 'done';

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
  const [resultStatus, setResultStatus] = useState('');

  const [step, setStep] = useState<Step>('coach');
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
      setStep('invite');
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
      setStep('parent');
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
      if (!firstChild) {
        throw new Error('У родителя нет детей в демо-данных');
      }

      setChildId(firstChild.id);
      setStep('accept');
      pushLog(`Вход родителя выполнен, выбран ребенок ${firstChild.firstName} ${firstChild.lastName}`);
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
      setResultStatus(result.status);
      setStep('done');
      pushLog(`Инвайт принят, статус заявки: ${result.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось принять инвайт');
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    setCoachToken('');
    setParentToken('');
    setInviteToken('');
    setInviteUrl('');
    setChildId('');
    setResultStatus('');
    setError('');
    setStep('coach');
    pushLog('Сценарий сброшен');
  }

  return (
    <div className="stack">
      <div className="card stack">
        <span className="badge">UI Test Lab</span>
        <h1>Тест без терминала</h1>
        <p className="caption">Пошаговый мастер invite-флоу.</p>
        <p className="caption mono">Текущий шаг: {step}</p>
      </div>

      <div className="card stack">
        <h2>Параметры</h2>
        <input value={sectionId} onChange={(e) => setSectionId(e.target.value)} placeholder="sectionId" />
        <input
          value={coachTelegramId}
          onChange={(e) => setCoachTelegramId(e.target.value)}
          placeholder="telegram id тренера/админа"
        />
        <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="телефон родителя" />
        <input value={parentOtpCode} onChange={(e) => setParentOtpCode(e.target.value)} placeholder="otp код" />
      </div>

      {step === 'coach' && (
        <div className="card stack">
          <h2>Шаг 1: Вход админа/тренера</h2>
          <button disabled={busy} onClick={() => void runCoachLogin()}>
            {busy ? 'Выполняется...' : 'Войти как админ/тренер'}
          </button>
        </div>
      )}

      {step === 'invite' && (
        <div className="card stack">
          <h2>Шаг 2: Создание инвайта</h2>
          <button disabled={busy || !coachToken} onClick={() => void runCreateInvite()}>
            {busy ? 'Выполняется...' : 'Создать инвайт'}
          </button>
        </div>
      )}

      {step === 'parent' && (
        <div className="card stack">
          <h2>Шаг 3: Вход родителя</h2>
          <button disabled={busy} className="secondary" onClick={() => void runParentLoginAndResolveChild()}>
            {busy ? 'Выполняется...' : 'Войти как родитель'}
          </button>
        </div>
      )}

      {step === 'accept' && (
        <div className="card stack">
          <h2>Шаг 4: Принятие инвайта</h2>
          <p className="caption mono">child id: {childId}</p>
          <button disabled={busy || !inviteToken || !parentToken || !childId} onClick={() => void runAcceptInvite()}>
            {busy ? 'Выполняется...' : 'Принять инвайт выбранным ребенком'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="card stack">
          <h2>Готово</h2>
          <p className="success">Сценарий завершен. Статус заявки: {resultStatus}</p>
          {inviteToken && <Link href={`/invite/${inviteToken}`}>Открыть invite-страницу для проверки UI</Link>}
          {inviteUrl && (
            <a href={inviteUrl} target="_blank" rel="noreferrer">
              Открыть pwaInviteUrl в новой вкладке
            </a>
          )}
          <button className="secondary" onClick={resetFlow}>
            Пройти сценарий заново
          </button>
        </div>
      )}

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
