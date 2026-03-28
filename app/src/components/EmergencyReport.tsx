import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import { EmergencyReport as EmergencyReportType, Severity } from '../types';

interface EmergencyReportProps {
  report: EmergencyReportType | null;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ff3b30',
  high: '#ff9500',
  medium: '#ffd60a',
  low: '#30d158',
  none: '#888',
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: '🔴 CRITICAL',
  high: '🟠 HIGH',
  medium: '🟡 MEDIUM',
  low: '🟢 LOW',
  none: '⚪ NONE',
};

const EMERGENCY_ICONS: Record<string, string> = {
  fall: '🤕',
  fire: '🔥',
  flood: '🌊',
  car_crash: '🚗',
  medical: '🏥',
  violence: '⚠️',
  unknown: '❓',
  none: '✅',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function EmergencyReport({ report }: EmergencyReportProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (report && report.severity !== 'none') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [report, pulseAnim]);

  const borderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ff3b3000', '#ff3b30ff'],
  });

  if (!report) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Active Report</Text>
          <Text style={styles.emptySubtitle}>
            Emergency reports will appear here when an incident is detected.
          </Text>
        </View>
      </View>
    );
  }

  const sevColor = SEVERITY_COLORS[report.severity] || '#888';

  return (
    <Animated.View style={[styles.card, report.severity !== 'none' && { borderWidth: 2, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Emergency Report</Text>
        <Text style={styles.timestamp}>{formatTimestamp(report.timestamp)}</Text>
      </View>

      {/* Type + Severity Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.typeBadge, { backgroundColor: sevColor + '22' }]}>
          <Text style={styles.typeIcon}>
            {EMERGENCY_ICONS[report.emergencyType] || '❓'}
          </Text>
          <Text style={[styles.typeText, { color: sevColor }]}>
            {report.emergencyType.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: sevColor + '22' }]}>
          <Text style={[styles.severityText, { color: sevColor }]}>
            {SEVERITY_LABELS[report.severity]}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} nestedScrollEnabled>
        {/* Location */}
        {report.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Location</Text>
            {report.location.address ? (
              <Text style={styles.sectionBody}>{report.location.address}</Text>
            ) : (
              <Text style={styles.sectionBody}>
                {report.location.latitude.toFixed(5)}, {report.location.longitude.toFixed(5)}
                {'\n'}
                <Text style={styles.subDetail}>
                  Accuracy: ±{report.location.accuracy.toFixed(0)}m
                </Text>
              </Text>
            )}
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Description</Text>
          <Text style={styles.sectionBody}>{report.objectiveDescription}</Text>
        </View>

        {/* Health Summary */}
        {report.healthData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🩺 Health Data</Text>
            <View style={styles.healthGrid}>
              {report.healthData.heartRate != null && (
                <Text style={styles.healthItem}>
                  ❤️ {report.healthData.heartRate} BPM
                </Text>
              )}
              {report.healthData.bloodOxygen != null && (
                <Text style={styles.healthItem}>
                  🫁 {report.healthData.bloodOxygen}% SpO₂
                </Text>
              )}
              {report.healthData.bloodGlucose != null && (
                <Text style={styles.healthItem}>
                  🩸 {report.healthData.bloodGlucose} mg/dL
                </Text>
              )}
              {report.healthData.stepCount != null && (
                <Text style={styles.healthItem}>
                  👟 {report.healthData.stepCount} steps
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Recommended Actions */}
        {report.recommendedActions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Recommended Actions</Text>
            {report.recommendedActions.map((action, idx) => (
              <View key={idx} style={styles.actionRow}>
                <View style={styles.actionNumber}>
                  <Text style={styles.actionNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    maxHeight: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  typeIcon: {
    fontSize: 16,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionBody: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  subDetail: {
    color: '#888',
    fontSize: 12,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthItem: {
    color: '#ffffff',
    fontSize: 13,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  actionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  actionNumberText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
