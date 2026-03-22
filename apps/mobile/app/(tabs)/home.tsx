import { SafeAreaView, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#404152' }}>
      <View style={{ padding: 20, gap: 8 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>VneClassno Mobile</Text>
        <Text style={{ color: '#d6dcef', fontSize: 15 }}>Шаг 1 миграции: базовый кроссплатформенный shell готов.</Text>
      </View>
    </SafeAreaView>
  );
}
