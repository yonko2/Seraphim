import React from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView } from 'react-native';

interface TopNavbarProps {
  currentPage: string;
}

const logo = require('../../assets/logo.png');

export default function TopNavbar({ currentPage }: TopNavbarProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <View style={styles.left}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>SERAPHIM</Text>
        </View>
        <View style={styles.pageBadge}>
          <Text style={styles.pageText}>{currentPage}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#0F172A',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  brand: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  pageBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pageText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
