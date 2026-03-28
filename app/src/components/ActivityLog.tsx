import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DisasterClassification } from '../types';

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  type: 'capture' | 'emergency' | 'safe' | 'alert_sent' | 'alert_cancelled';
  label: string;
}

interface ActivityLogProps {
  entries: ActivityEntry[];
}

const TYPE_CONFIG: Record<ActivityEntry['type'], { icon: string; color: string }> = {
  capture: { icon: '📸', color: '#38BDF8' },
  emergency: { icon: '🚨', color: '#FF5A4F' },
  safe: { icon: '✅', color: '#22C55E' },
  alert_sent: { icon: '📞', color: '#F59E0B' },
  alert_cancelled: { icon: '❌', color: '#94A3B8' },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>📋 Recent Activity</Text>
      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>No activity yet</Text>
          <Text style={styles.emptySubtext}>Capture or record to start detecting</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {entries.slice(0, 8).map((entry) => {
            const config = TYPE_CONFIG[entry.type];
            return (
              <View key={entry.id} style={styles.row}>
                <Text style={styles.icon}>{config.icon}</Text>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, { color: config.color }]}>{entry.label}</Text>
                  <Text style={styles.rowTime}>{formatTime(entry.timestamp)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0E1726',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#94A3B8',
    fontSize: 13,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#182336',
  },
  icon: {
    fontSize: 18,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  rowTime: {
    color: '#94A3B8',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
