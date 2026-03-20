'use client';

import { useEffect, useState } from 'react';
import { acceptInvite, getMeContext, loginPwa, resolveInvite, type InviteResponse } from '../../lib/api';

const ACCESS_TOKEN_KEY = 'vneclassno_pwa_access_token';

type Step = 'loading' | 'auth' | 'select-child' | 'create-child' | 'done' | 'error';

export default function InviteFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [phone, setPhone] = useState('+79990000001');
  const [otpCode, setOtpCode] = useState('1234');
  const [children, setChildren] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tg = (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (tg && botName) {
      window.location.href = `https://t.me/${botName}?startapp=invite_${token}`;
      return;
    }

    void bootstrap();
  }, [token]);

  async function bootstrap() {
    setBusy(true);
    setError('');
    try {
      const inviteData = await resolveInvite(token);
      setInvite(inviteData);

      const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
      if (!storedToken) {
        setStep('auth');
        return;
      }

      setAccessToken(storedToken);
      await loadContext(storedToken);
    } catch (e) {
      setStep('error');
      setError(e instanceof Error ? e.message : 'Не удалось открыть инвайт');
    } finally {
      setBusy(false);
    }
  }

  async function loadContext(tokenValue: string) {
    try {
      const context = await getMeContext(tokenValue);
      setChildren(context.children);
      if (context.children.length > 0) {
        setSelectedChildId(context.children[0].id);
        setStep('select-child');
      } else {
        setStep('create-child');
      }
    } catch {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      setAccessToken('');
      setStep('auth');
    }
  }

  async function handleLogin() {
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

  async function handleAcceptExistingChild() {
    if (!selectedChildId) {
      setError('Выберите ребенка');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await acceptInvite(token, accessToken, { childId: selectedChildId });
      setMessage(`Заявка отправлена. Статус: ${result.status}`);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptNewChild() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Заполните имя и фамилию ребенка');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await acceptInvite(token, accessToken, {
        newChild: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate: birthDate || undefined,
        },
      });
      setMessage(`Заявка отправлена. Статус: ${result.status}`);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card stack">
        <span className="badge">Invite onboarding</span>
        <h1>Добавление ребенка в секцию</h1>
        <p className="caption">Токен: {token}</p>
        {invite && <p className="caption">Секция: {invite.invite.sectionId}</p>}
      </div>

      {step === 'loading' && (
        <div className="card">
          <p>Загружаем данные инвайта...</p>
        </div>
      )}

      {step === 'auth' && (
        <div className="card stack">
          <h2>Вход родителя</h2>
          <p className="caption">Одноразовый вход в PWA перед принятием инвайта.</p>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
          <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Код" />
          <button disabled={busy} onClick={() => void handleLogin()}>
            {busy ? 'Входим...' : 'Войти'}
          </button>
        </div>
      )}

      {step === 'select-child' && (
        <div className="card stack">
          <h2>Выберите ребенка</h2>
          <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.firstName} {child.lastName}
              </option>
            ))}
          </select>
          <button disabled={busy} onClick={() => void handleAcceptExistingChild()}>
            {busy ? 'Отправляем...' : 'Добавить в секцию'}
          </button>
          <button className="secondary" disabled={busy} onClick={() => setStep('create-child')}>
            Создать нового ребенка
          </button>
        </div>
      )}

      {step === 'create-child' && (
        <div className="card stack">
          <h2>Создать ребенка</h2>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" />
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <button disabled={busy} onClick={() => void handleAcceptNewChild()}>
            {busy ? 'Отправляем...' : 'Создать и отправить заявку'}
          </button>
          {children.length > 0 && (
            <button className="secondary" disabled={busy} onClick={() => setStep('select-child')}>
              Назад к списку детей
            </button>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="card stack">
          <h2>Готово</h2>
          <p className="success">{message}</p>
        </div>
      )}

      {step === 'error' && (
        <div className="card stack">
          <h2>Ошибка</h2>
          <p className="error">{error || 'Не удалось обработать инвайт'}</p>
        </div>
      )}

      {error && step !== 'error' && <p className="error">{error}</p>}
    </div>
  );
}
