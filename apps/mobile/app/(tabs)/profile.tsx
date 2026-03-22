import { SafeAreaView, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#404152' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Профиль</Text>
      </View>
    </SafeAreaView>
  );
}
