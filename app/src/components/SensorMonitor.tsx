import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSensors } from '../hooks/useSensors';

function getMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function getMagnitudeStatus(magnitude: number, fallDetected: boolean): 'normal' | 'elevated' | 'fall' {
  if (fallDetected) return 'fall';
  if (magnitude > 15) return 'elevated';
  return 'normal';
}

const STATUS_COLORS = {
  normal: '#22C55E',
  elevated: '#ffd60a',
  fall: '#FF5A4F',
} as const;

export default function SensorMonitor() {
  const {
    isActive,
    currentReading,
    startMonitoring,
    stopMonitoring,
    fallDetected,
  } = useSensors();

  const accel = currentReading?.accelerometer;
  const gyro = currentReading?.gyroscope;
  const baro = currentReading?.barometer;

  const magnitude = accel ? getMagnitude(accel.x, accel.y, accel.z) : 0;
  const status = getMagnitudeStatus(magnitude, !!fallDetected);
  const statusColor = STATUS_COLORS[status];

  const handleToggle = () => {
    if (isActive) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  return (
    <View style={[styles.card, { borderColor: statusColor, borderWidth: fallDetected ? 2 : 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📡 Sensor Monitor</Text>
        <View style={[styles.badge, { backgroundColor: isActive ? '#22C55E33' : '#94A3B833' }]}>
          <View style={[styles.badgeDot, { backgroundColor: isActive ? '#22C55E' : '#94A3B8' }]} />
          <Text style={[styles.badgeText, { color: isActive ? '#22C55E' : '#94A3B8' }]}>
            {isActive ? 'Monitoring' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Accelerometer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accelerometer</Text>
        {accel ? (
          <>
            <View style={styles.row}>
              <AxisValue label="X" value={accel.x} />
              <AxisValue label="Y" value={accel.y} />
              <AxisValue label="Z" value={accel.z} />
            </View>
            <View style={styles.magnitudeRow}>
              <Text style={styles.magnitudeLabel}>Magnitude</Text>
              <View style={styles.magnitudeBarBg}>
                <View
                  style={[
                    styles.magnitudeBarFill,
                    {
                      width: `${Math.min((magnitude / 30) * 100, 100)}%`,
                      backgroundColor: statusColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.magnitudeValue, { color: statusColor }]}>
                {magnitude.toFixed(1)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.noData}>No data</Text>
        )}
      </View>

      {/* Gyroscope */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gyroscope</Text>
        {gyro ? (
          <View style={styles.row}>
            <AxisValue label="α" value={gyro.x} unit="°/s" />
            <AxisValue label="β" value={gyro.y} unit="°/s" />
            <AxisValue label="γ" value={gyro.z} unit="°/s" />
          </View>
        ) : (
          <Text style={styles.noData}>No data</Text>
        )}
      </View>

      {/* Barometer */}
      {baro && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Barometer</Text>
          <View style={styles.baroRow}>
            <Text style={styles.baroValue}>{baro.pressure.toFixed(1)}</Text>
            <Text style={styles.baroUnit}>hPa</Text>
          </View>
        </View>
      )}

      {/* Fall Alert */}
      {fallDetected && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>⚠️ FALL DETECTED</Text>
        </View>
      )}

      {/* Toggle Button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: isActive ? '#FF5A4F22' : '#38BDF822' }]}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, { color: isActive ? '#FF5A4F' : '#38BDF8' }]}>
          {isActive ? '■  Stop Monitoring' : '▶  Start Monitoring'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function AxisValue({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <View style={styles.axisItem}>
      <Text style={styles.axisLabel}>{label}</Text>
      <Text style={styles.axisValue}>{value.toFixed(2)}</Text>
      {unit && <Text style={styles.axisUnit}>{unit}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0E1726',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  axisItem: {
    alignItems: 'center',
    flex: 1,
  },
  axisLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  axisValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  axisUnit: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  magnitudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  magnitudeLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    width: 68,
  },
  magnitudeBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#182336',
    borderRadius: 3,
    overflow: 'hidden',
  },
  magnitudeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  magnitudeValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    width: 40,
    textAlign: 'right',
  },
  baroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  baroValue: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  baroUnit: {
    color: '#94A3B8',
    fontSize: 13,
  },
  noData: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 4,
  },
  alertBanner: {
    backgroundColor: '#FF5A4F22',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  alertText: {
    color: '#FF5A4F',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
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
