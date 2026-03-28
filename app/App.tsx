import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

const seraphimTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0a0a0a',
    card: '#1a1a1a',
    text: '#ffffff',
    primary: '#ff3b30',
    border: '#333',
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer theme={seraphimTheme}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <AppNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
