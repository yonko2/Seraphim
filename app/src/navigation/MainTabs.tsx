import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useStore } from '../store/useStore';
import VictimDashboard from '../screens/VictimDashboard';
import HelperDashboard from '../screens/HelperDashboard';
import SettingsScreen from '../screens/SettingsScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs: React.FC = () => {
  const mode = useStore((state) => state.mode);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
        },
        tabBarActiveTintColor: '#ff3b30',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={mode === 'victim' ? VictimDashboard : HelperDashboard}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🛡️</Text>,
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;
