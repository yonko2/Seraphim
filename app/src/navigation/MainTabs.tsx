import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useStore } from '../store/useStore';
import VictimDashboard from '../screens/VictimDashboard';
import HelperDashboard from '../screens/HelperDashboard';
import WatchScreen from '../screens/WatchScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
          backgroundColor: '#1A2538',
          borderTopColor: '#182336',
        },
        tabBarActiveTintColor: '#FF5A4F',
        tabBarInactiveTintColor: '#94A3B8',
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
        name="Watch"
        component={WatchScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⌚</Text>,
          tabBarLabel: 'Watch',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
          tabBarLabel: 'Profile',
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
