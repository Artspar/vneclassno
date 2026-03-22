import { SafeAreaView, Text, View, Pressable } from 'react-native';
import { useAuthStore } from '@/state/auth-store';

export default function ProfileScreen() {
  const context = useAuthStore((state) => state.context);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#404152' }}>
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Профиль</Text>
        <Text style={{ color: '#d6dcef' }}>Telegram: {context?.hasLinkedTelegram ? 'привязан' : 'не привязан'}</Text>
        <Text style={{ color: '#d6dcef' }}>Телефон: {context?.hasLinkedPhone ? 'привязан' : 'не привязан'}</Text>

        <Pressable
          onPress={() => void clearSession()}
          style={{ backgroundColor: '#e24852', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Выйти</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
