import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import type { RootStackParamList } from '../navigation/types';
import type { AppMode } from '../types';

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const setMode = useStore((state) => state.setMode);

  const handleModeSelect = (mode: AppMode) => {
    setMode(mode);
    navigation.navigate('MainTabs');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.header}>
        <Text style={styles.title}>SERAPHIM</Text>
        <Text style={styles.subtitle}>Emergency Assistant</Text>
      </View>
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={[styles.card, styles.victimCard]}
          onPress={() => handleModeSelect('victim')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardEmoji}>🆘</Text>
          <Text style={styles.cardTitle}>I need help</Text>
          <Text style={styles.cardDescription}>
            Activate emergency monitoring and get immediate assistance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.card, styles.helperCard]}
          onPress={() => handleModeSelect('helper')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardEmoji}>🤝</Text>
          <Text style={styles.cardTitle}>I can help</Text>
          <Text style={styles.cardDescription}>
            Respond to nearby emergencies and provide assistance
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
    letterSpacing: 2,
  },
  cardContainer: {
    gap: 20,
  },
  card: {
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  victimCard: {
    backgroundColor: '#1a0a0a',
    borderWidth: 1,
    borderColor: '#FF5A4F',
  },
  helperCard: {
    backgroundColor: '#0a0a1a',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  cardEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HomeScreen;
