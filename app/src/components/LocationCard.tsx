import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LocationCardProps {
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
  } | null;
}

export default function LocationCard({ location }: LocationCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>📍 Your Location</Text>
      {location ? (
        <>
          <Text style={styles.address}>
            {location.address || 'Address unavailable'}
          </Text>
          <View style={styles.coordsRow}>
            <View style={styles.coordBadge}>
              <Text style={styles.coordLabel}>LAT</Text>
              <Text style={styles.coordValue}>{location.latitude.toFixed(5)}</Text>
            </View>
            <View style={styles.coordBadge}>
              <Text style={styles.coordLabel}>LNG</Text>
              <Text style={styles.coordValue}>{location.longitude.toFixed(5)}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.statusText}>GPS Active · Location shared on emergency</Text>
          </View>
        </>
      ) : (
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>Acquiring GPS signal…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  address: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  coordBadge: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  coordLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  coordValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  statusText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
});
