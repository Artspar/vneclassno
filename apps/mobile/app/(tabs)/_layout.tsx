import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function iconFor(route: string, focused: boolean) {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    home: focused ? 'home' : 'home-outline',
    calendar: focused ? 'calendar' : 'calendar-outline',
    attendance: focused ? 'bar-chart' : 'bar-chart-outline',
    payments: focused ? 'card' : 'card-outline',
    profile: focused ? 'person' : 'person-outline',
  };

  return map[route] ?? 'ellipse-outline';
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1383ff',
        tabBarInactiveTintColor: '#7d8599',
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: '#ffffff',
          borderTopColor: '#dbe1ed',
        },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={iconFor(route.name, focused)} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Главная' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Календарь' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Посещения' }} />
      <Tabs.Screen name="payments" options={{ title: 'Платежи' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
