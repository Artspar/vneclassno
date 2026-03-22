import { SafeAreaView, Text, View } from 'react-native';

export default function CalendarScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#404152' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Календарь</Text>
      </View>
    </SafeAreaView>
  );
}
