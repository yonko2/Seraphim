import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useHealthData } from '../hooks/useHealthData';

type MetricStatus = 'normal' | 'warning' | 'critical';

const STATUS_COLORS: Record<MetricStatus, string> = {
  normal: '#22C55E',
  warning: '#ffd60a',
  critical: '#FF5A4F',
};

function getHeartRateStatus(hr: number): MetricStatus {
  if (hr < 40 || hr > 150) return 'critical';
  if (hr < 60 || hr > 100) return 'warning';
  return 'normal';
}

function getBloodOxygenStatus(spo2: number): MetricStatus {
  if (spo2 < 90) return 'critical';
  if (spo2 < 95) return 'warning';
  return 'normal';
}

function getBloodGlucoseStatus(bg: number): MetricStatus {
  if (bg < 54 || bg > 250) return 'critical';
  if (bg < 70 || bg > 180) return 'warning';
  return 'normal';
}

interface MetricCardProps {
  icon: string;
  label: string;
  value: number | undefined;
  unit: string;
  getStatus?: (v: number) => MetricStatus;
}

function MetricCard({ icon, label, value, unit, getStatus }: MetricCardProps) {
  const available = value != null;
  const status = available && getStatus ? getStatus(value) : 'normal';
  const color = available ? STATUS_COLORS[status] : '#475569';

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>
        {available ? value.toFixed(0) : 'N/A'}
      </Text>
      <Text style={styles.metricUnit}>{available ? unit : '—'}</Text>
    </View>
  );
}

export default function HealthMetrics() {
  const {
    healthData,
    availableProviders,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    error,
  } = useHealthData();

  const noProviders = availableProviders.length === 0;

  const handleToggle = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🩺 Health Metrics</Text>
        <View style={[styles.badge, { backgroundColor: isMonitoring ? '#22C55E33' : '#94A3B833' }]}>
          <View style={[styles.badgeDot, { backgroundColor: isMonitoring ? '#22C55E' : '#94A3B8' }]} />
          <Text style={[styles.badgeText, { color: isMonitoring ? '#22C55E' : '#94A3B8' }]}>
            {isMonitoring ? 'Connected' : 'Offline'}
          </Text>
        </View>
      </View>

      {noProviders ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⌚</Text>
          <Text style={styles.emptyTitle}>No Wearable Connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect an Apple Watch or Wear OS device to view real-time health data.
          </Text>
        </View>
      ) : (
        <>
          {/* Metrics Grid */}
          <View style={styles.grid}>
            <MetricCard
              icon="❤️"
              label="Heart Rate"
              value={healthData?.heartRate}
              unit="BPM"
              getStatus={getHeartRateStatus}
            />
            <MetricCard
              icon="🫁"
              label="Blood O₂"
              value={healthData?.bloodOxygen}
              unit="%"
              getStatus={getBloodOxygenStatus}
            />
            <MetricCard
              icon="🩸"
              label="Glucose"
              value={healthData?.bloodGlucose}
              unit="mg/dL"
              getStatus={getBloodGlucoseStatus}
            />
            <MetricCard
              icon="👟"
              label="Steps"
              value={healthData?.stepCount}
              unit="steps"
            />
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Toggle Button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: isMonitoring ? '#FF5A4F22' : '#38BDF822' },
            ]}
            onPress={handleToggle}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { color: isMonitoring ? '#FF5A4F' : '#38BDF8' }]}>
              {isMonitoring ? '■  Disconnect' : '▶  Connect Wearable'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metricCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    width: '48%',
    flexGrow: 1,
  },
  metricIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  errorBanner: {
    backgroundColor: '#FF5A4F22',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF5A4F',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
