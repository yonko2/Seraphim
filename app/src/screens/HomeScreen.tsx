import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import type { RootStackParamList } from '../navigation/types';
import type { AppMode } from '../types';

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const logo = require('../../assets/logo.png');

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const setMode = useStore((state) => state.setMode);

  const handleModeSelect = (mode: AppMode) => {
    setMode(mode);
    navigation.navigate('MainTabs');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D5DDE8" />
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 280,
    height: 280,
    borderRadius: 56,
    marginBottom: 28,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
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
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cardEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HomeScreen;
