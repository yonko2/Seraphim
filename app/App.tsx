import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

const seraphimTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#2563EB',
    background: '#F4F6F8',
    card: '#FFFFFF',
    text: '#0F172A',
    border: '#E6EEF6',
    notification: '#2563EB',
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer theme={seraphimTheme}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
        <AppNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
