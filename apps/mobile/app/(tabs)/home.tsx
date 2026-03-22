import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getMeContext, loginPwa, requestPwaOtp, setContextSelection } from '@/lib/mobile-api';
import type { OtpChannel } from '@/lib/types';
import { useAuthStore } from '@/state/auth-store';

const rolePhones = {
  parent: '+79990000001',
  coach: '+79990000002',
  admin: '+79990000003',
} as const;

function chip(active: boolean) {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? '#71b6ff' : '#7d8599',
    backgroundColor: active ? 'rgba(113, 182, 255, 0.24)' : 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  } as const;
}

export default function HomeScreen() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const sessionContext = useAuthStore((state) => state.context);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setContext = useAuthStore((state) => state.setContext);

  const [phone, setPhone] = useState<string>(rolePhones.parent);
  const [otpCode, setOtpCode] = useState('1234');
  const [otpRequestId, setOtpRequestId] = useState<string | undefined>();
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('sms');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const contextQuery = useQuery({
    queryKey: ['me-context', accessToken],
    queryFn: () => getMeContext(accessToken as string),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (contextQuery.data) {
      setContext(contextQuery.data);
    }
  }, [contextQuery.data, setContext]);

  const otpMutation = useMutation({
    mutationFn: () => requestPwaOtp(phone, otpChannel),
    onSuccess: (data) => {
      setOtpRequestId(data.requestId);
      setStatus(`Код отправлен через ${data.channel} (${data.destinationMasked})${data.debugCode ? ` · test: ${data.debugCode}` : ''}`);
      setError('');
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    },
  });

  const loginMutation = useMutation({
    mutationFn: () => loginPwa(phone, otpCode, otpRequestId),
    onSuccess: async (data) => {
      await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setStatus(`Вход выполнен: ${data.user.firstName}`);
      setError('');
      await contextQuery.refetch();
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    },
  });

  const context = contextQuery.data ?? sessionContext;

  const activeChildId = context?.activeChildId;
  const activeSectionId = context?.activeSectionId;

  const updateContextMutation = useMutation({
    mutationFn: (payload: { activeChildId?: string; activeSectionId?: string }) =>
      setContextSelection(accessToken as string, payload),
    onSuccess: async () => {
      await contextQuery.refetch();
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить выбор');
    },
  });

  const selectedChild = useMemo(
    () => context?.children.find((item) => item.id === activeChildId),
    [context?.children, activeChildId],
  );

  if (!hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#404152', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#404152' }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>Вход в VneClassno Mobile</Text>
          <Text style={{ color: '#d6dcef' }}>Один раз входите по телефону и коду, дальше сессия сохраняется.</Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={chip(phone === rolePhones.parent)} onPress={() => setPhone(rolePhones.parent)}>
              <Text style={{ color: '#fff' }}>Родитель</Text>
            </Pressable>
            <Pressable style={chip(phone === rolePhones.coach)} onPress={() => setPhone(rolePhones.coach)}>
              <Text style={{ color: '#fff' }}>Тренер</Text>
            </Pressable>
            <Pressable style={chip(phone === rolePhones.admin)} onPress={() => setPhone(rolePhones.admin)}>
              <Text style={{ color: '#fff' }}>Админ</Text>
            </Pressable>
          </View>

          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Телефон"
            placeholderTextColor="#9ea7bc"
            style={{ backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          />
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="Код"
            placeholderTextColor="#9ea7bc"
            style={{ backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['sms', 'telegram', 'vk'] as OtpChannel[]).map((channel) => (
              <Pressable key={channel} style={chip(otpChannel === channel)} onPress={() => setOtpChannel(channel)}>
                <Text style={{ color: '#fff' }}>{channel.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => otpMutation.mutate()}
            style={{ backgroundColor: '#1f8a56', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            disabled={otpMutation.isPending}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{otpMutation.isPending ? 'Отправляем...' : 'Получить OTP'}</Text>
          </Pressable>

          <Pressable
            onPress={() => loginMutation.mutate()}
            style={{ backgroundColor: '#1383ff', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            disabled={loginMutation.isPending}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{loginMutation.isPending ? 'Входим...' : 'Войти'}</Text>
          </Pressable>

          {status ? <Text style={{ color: '#9ce2b7' }}>{status}</Text> : null}
          {error ? <Text style={{ color: '#ffb8c1' }}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#404152' }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>Главная</Text>
        <Text style={{ color: '#d6dcef' }}>Контекст пользователя загружен с backend.</Text>

        {contextQuery.isFetching ? <ActivityIndicator color="#fff" /> : null}

        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12, gap: 6 }}>
          <Text style={{ color: '#fff' }}>Роли: {context?.roles.join(', ') || '—'}</Text>
          <Text style={{ color: '#fff' }}>Ребенок: {selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : 'не выбран'}</Text>
          <Text style={{ color: '#fff' }}>Секция: {context?.sections.find((s) => s.id === activeSectionId)?.name ?? 'не выбрана'}</Text>
        </View>

        <Text style={{ color: '#d6dcef' }}>Выбор ребенка</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {context?.children.map((child) => {
            const active = child.id === activeChildId;
            return (
              <Pressable
                key={child.id}
                style={chip(active)}
                onPress={() =>
                  updateContextMutation.mutate({
                    activeChildId: child.id,
                    activeSectionId,
                  })
                }
              >
                <Text style={{ color: '#fff' }}>{child.firstName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ color: '#d6dcef' }}>Выбор секции</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {context?.sections.map((section) => {
            const active = section.id === activeSectionId;
            return (
              <Pressable
                key={section.id}
                style={chip(active)}
                onPress={() =>
                  updateContextMutation.mutate({
                    activeChildId,
                    activeSectionId: section.id,
                  })
                }
              >
                <Text style={{ color: '#fff' }}>{section.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => void clearSession()}
          style={{ backgroundColor: '#e24852', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Выйти</Text>
        </Pressable>

        {error ? <Text style={{ color: '#ffb8c1' }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
