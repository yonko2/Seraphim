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
    backgroundColor: '#F4F6F8',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEF6',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 14,
  },
  brand: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  pageBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pageText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
});
