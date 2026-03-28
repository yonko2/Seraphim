import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Animated,
} from 'react-native';
import * as Location from 'expo-location';
import TopNavbar from '../components/TopNavbar';
import { useStore } from '../store/useStore';
import { useCollapseMonitor } from '../hooks/useCollapseMonitor';

const COUNTDOWN_SECONDS = 10;
type CallState = 'idle' | 'countdown' | 'calling' | 'sent' | 'cancelled' | 'failed';

// Simulate realistic health data with small fluctuations
function useSimulatedHealth(isActive: boolean) {
  const baseRef = useRef({
    hr: 68 + Math.floor(Math.random() * 10),
    spo2: 97 + Math.floor(Math.random() * 2),
    stress: 25 + Math.floor(Math.random() * 10),
    bodyBattery: 65 + Math.floor(Math.random() * 15),
    hrv: 42 + Math.floor(Math.random() * 15),
    restingHr: 58 + Math.floor(Math.random() * 8),
  });

  const [data, setData] = useState(baseRef.current);

  useEffect(() => {
    if (!isActive) return;

    const jitter = (base: number, range: number, min: number, max: number) => {
      const val = base + Math.round((Math.random() - 0.5) * range);
      return Math.max(min, Math.min(max, val));
    };

    const interval = setInterval(() => {
      const b = baseRef.current;
      setData({
        hr: jitter(b.hr, 6, 55, 100),
        spo2: jitter(b.spo2, 2, 94, 100),
        stress: jitter(b.stress, 8, 10, 60),
        bodyBattery: jitter(b.bodyBattery, 4, 30, 100),
        hrv: jitter(b.hrv, 6, 25, 80),
        restingHr: jitter(b.restingHr, 2, 50, 70),
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive]);

  return data;
}

export default function WatchScreen() {
  const collapseMonitoring = useStore((s) => s.collapseMonitoring);
  const setCollapseMonitoring = useStore((s) => s.setCollapseMonitoring);
  const backendUrl = useStore((s) => s.backendUrl);

  const {
    isRunning, lastResult, collapseDetected, clearCollapse,
    liveAccel, liveGyro,
  } = useCollapseMonitor();

  const health = useSimulatedHealth(true);

  // Countdown & emergency call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [callMessage, setCallMessage] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // GPS location
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude, longitude } = loc.coords;
        let address: string | null = null;
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geo) {
            const parts = [geo.street, geo.city, geo.region, geo.country].filter(Boolean);
            address = parts.join(', ') || null;
          }
        } catch {}
        setUserLocation({ latitude, longitude, address });
      } catch {}
    })();
  }, []);

  // Trigger countdown when collapse is detected
  useEffect(() => {
    if (collapseDetected && callState === 'idle') {
      startCountdown();
    }
  }, [collapseDetected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCallState('countdown');
    setCountdown(COUNTDOWN_SECONDS);
    progressAnim.setValue(1);

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: COUNTDOWN_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        sendEmergencyReport();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    progressAnim.stopAnimation();
    setCallState('cancelled');
    setCallMessage('Emergency call cancelled');
    clearCollapse();
    setTimeout(() => {
      setCallState('idle');
      setCallMessage('');
    }, 3000);
  };

  const sendEmergencyReport = useCallback(async () => {
    setCallState('calling');
    setCallMessage('📞 Connecting to emergency services…');

    if (!backendUrl) {
      setCallState('failed');
      setCallMessage('No backend URL configured');
      setTimeout(() => { setCallState('idle'); setCallMessage(''); }, 5000);
      return;
    }

    try {
      const confidence = lastResult?.confidence ?? 0.8;
      const reason = lastResult?.reason ?? 'Fall/collapse detected via motion sensors';

      const report = {
        timestamp: Date.now() / 1000,
        emergency_type: 'fall',
        severity: confidence >= 0.8 ? 'critical' : confidence >= 0.6 ? 'high' : 'medium',
        location: userLocation,
        sensor_data: null,
        health_data: {
          heart_rate: { current: health.hr },
          spo2: { latest: health.spo2 },
          stress: health.stress,
        },
        objective_description: `Person collapse/fall detected by phone motion sensors. ${reason}`,
        recommended_actions: [
          'Check if victim is conscious and breathing',
          'Do not move victim if spinal injury suspected',
          'Call local emergency services',
          'Begin CPR if victim is not breathing',
        ],
        raw_observations: [
          `Collapse confidence: ${(confidence * 100).toFixed(0)}%`,
          `Detection source: accelerometer + gyroscope`,
          `Heart rate: ${health.hr} BPM`,
          `SpO2: ${health.spo2}%`,
        ],
      };

      const response = await fetch(`${backendUrl}/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(errText);
      }

      const result = await response.json();
      setCallState('sent');
      setCallMessage(`✅ Emergency alert sent! Call ID: ${result.call_id || 'N/A'}`);
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
        clearCollapse();
      }, 5000);
    } catch (error) {
      console.error('[WatchScreen] Emergency report failed:', error);
      setCallState('failed');
      setCallMessage(`❌ Failed: ${String(error)}`);
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
      }, 5000);
    }
  }, [backendUrl, lastResult, userLocation, health, clearCollapse]);

  const accelMag = liveAccel
    ? Math.sqrt(liveAccel.x ** 2 + liveAccel.y ** 2 + liveAccel.z ** 2).toFixed(2)
    : '—';
  const gyroMag = liveGyro
    ? Math.sqrt(liveGyro.x ** 2 + liveGyro.y ** 2 + liveGyro.z ** 2).toFixed(2)
    : '—';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <TopNavbar currentPage="Watch" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Simulated Health Data */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>❤️ Health Data</Text>
            <View style={styles.simBadge}>
              <Text style={styles.simBadgeText}>● SIMULATED</Text>
            </View>
          </View>

          <View style={styles.healthGrid}>
            <HealthTile icon="❤️" label="Heart Rate" value={health.hr} unit="BPM" color="#FF5A4F" />
            <HealthTile icon="🫁" label="SpO2" value={health.spo2} unit="%" color="#38BDF8" />
            <HealthTile icon="😰" label="Stress" value={health.stress} unit="" color="#F59E0B" />
            <HealthTile icon="🔋" label="Body Battery" value={health.bodyBattery} unit="" color="#22C55E" />
            <HealthTile icon="💓" label="HRV" value={health.hrv} unit="ms" color="#A78BFA" />
            <HealthTile icon="❤️" label="Resting HR" value={health.restingHr} unit="BPM" color="#FB7185" />
          </View>
        </View>

        {/* Live Sensor Data */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📱 Phone Sensors</Text>
            <View style={[styles.statusBadge, isRunning ? styles.badgeActive : styles.badgeInactive]}>
              <View style={[styles.statusDot, { backgroundColor: isRunning ? '#22C55E' : '#94A3B8' }]} />
              <Text style={[styles.statusText, { color: isRunning ? '#22C55E' : '#94A3B8' }]}>
                {isRunning ? 'Reading' : 'Off'}
              </Text>
            </View>
          </View>

          {isRunning && liveAccel && liveGyro ? (
            <View style={styles.sensorGrid}>
              <View style={styles.sensorBlock}>
                <Text style={styles.sensorTitle}>Accelerometer (g)</Text>
                <View style={styles.axisRow}>
                  <AxisValue label="X" value={liveAccel.x} />
                  <AxisValue label="Y" value={liveAccel.y} />
                  <AxisValue label="Z" value={liveAccel.z} />
                </View>
                <Text style={styles.magText}>|mag| = {accelMag} g</Text>
              </View>
              <View style={styles.sensorBlock}>
                <Text style={styles.sensorTitle}>Gyroscope (rad/s)</Text>
                <View style={styles.axisRow}>
                  <AxisValue label="X" value={liveGyro.x} />
                  <AxisValue label="Y" value={liveGyro.y} />
                  <AxisValue label="Z" value={liveGyro.z} />
                </View>
                <Text style={styles.magText}>|mag| = {gyroMag} rad/s</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.sensorHint}>Start monitoring to see live sensor data</Text>
          )}
        </View>

        {/* Collapse Monitoring */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🛡️ Collapse Detection</Text>
            <View style={[styles.statusBadge, isRunning ? styles.badgeActive : styles.badgeInactive]}>
              <View style={[styles.statusDot, { backgroundColor: isRunning ? '#22C55E' : '#94A3B8' }]} />
              <Text style={[styles.statusText, { color: isRunning ? '#22C55E' : '#94A3B8' }]}>
                {isRunning ? 'Active' : 'Off'}
              </Text>
            </View>
          </View>

          <Text style={styles.monitorDescription}>
            Uses phone accelerometer and gyroscope combined with simulated health vitals to detect falls and collapses in real-time.
          </Text>

          <TouchableOpacity
            style={[styles.monitorToggle, collapseMonitoring && styles.monitorToggleActive]}
            onPress={() => setCollapseMonitoring(!collapseMonitoring)}
            activeOpacity={0.7}
          >
            <Text style={[styles.monitorToggleText, collapseMonitoring && styles.monitorToggleTextActive]}>
              {collapseMonitoring ? '■  Stop Monitoring' : '▶  Start Monitoring'}
            </Text>
          </TouchableOpacity>

          {lastResult && (
            <View style={[styles.resultCard, lastResult.collapsed ? styles.resultDanger : styles.resultOk]}>
              <Text style={styles.resultLabel}>
                {lastResult.collapsed ? '🚨 COLLAPSE DETECTED' : '✅ Status Normal'}
              </Text>
              <Text style={styles.resultDetail}>
                Confidence: {(lastResult.confidence * 100).toFixed(0)}%
              </Text>
              {lastResult.reason && (
                <Text style={styles.resultReason}>{lastResult.reason}</Text>
              )}
              {lastResult.details && (
                <View style={styles.scoresRow}>
                  <ScoreBadge label="Impact" value={lastResult.details.impact} />
                  <ScoreBadge label="Gyro" value={lastResult.details.gyro} />
                  <ScoreBadge label="HR" value={lastResult.details.hr} />
                  <ScoreBadge label="Pattern" value={lastResult.details.pattern} />
                </View>
              )}
            </View>
          )}

          {collapseDetected && callState === 'idle' && (
            <TouchableOpacity style={styles.clearCollapseBtn} onPress={clearCollapse} activeOpacity={0.7}>
              <Text style={styles.clearCollapseBtnText}>Dismiss Collapse Alert</Text>
            </TouchableOpacity>
          )}

          {/* Emergency Countdown */}
          {callState === 'countdown' && (
            <View style={styles.countdownPanel}>
              <Text style={styles.countdownIcon}>🚨</Text>
              <Text style={styles.countdownTitle}>Calling emergency in {countdown}s</Text>
              <Text style={styles.countdownSubtitle}>
                A Telegram call and message will be sent to the operator
              </Text>
              <View style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelCountdown} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>✕  Cancel Emergency Call</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Calling / Sent / Failed status */}
          {(callState === 'calling' || callState === 'sent' || callState === 'failed' || callState === 'cancelled') && (
            <View style={[
              styles.callStatusPanel,
              callState === 'sent' && styles.callStatusSent,
              callState === 'failed' && styles.callStatusFailed,
              callState === 'cancelled' && styles.callStatusCancelled,
            ]}>
              <Text style={styles.callStatusText}>{callMessage}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function HealthTile({ icon, label, value, unit, color }: {
  icon: string; label: string; value: any; unit: string; color: string;
}) {
  return (
    <View style={styles.healthTile}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]}>
        {value != null ? String(value) : 'N/A'}
      </Text>
      {value != null && unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
    </View>
  );
}

function AxisValue({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.axisItem}>
      <Text style={styles.axisLabel}>{label}</Text>
      <Text style={styles.axisValue}>{value.toFixed(3)}</Text>
    </View>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct > 50 ? '#FF5A4F' : pct > 25 ? '#F59E0B' : '#22C55E';
  return (
    <View style={styles.scoreBadge}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  simBadge: {
    backgroundColor: '#38BDF822',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  simBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  badgeActive: {
    backgroundColor: '#22C55E22',
  },
  badgeInactive: {
    backgroundColor: '#94A3B822',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthTile: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    width: '48%',
    flexGrow: 1,
  },
  tileIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tileLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tileValue: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  tileUnit: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  sensorGrid: {
    gap: 10,
  },
  sensorBlock: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
  },
  sensorTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  axisItem: {
    alignItems: 'center',
  },
  axisLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  axisValue: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  magText: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
  sensorHint: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  monitorDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  monitorToggle: {
    backgroundColor: '#38BDF822',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  monitorToggleActive: {
    backgroundColor: '#FF5A4F22',
  },
  monitorToggleText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '700',
  },
  monitorToggleTextActive: {
    color: '#FF5A4F',
  },
  resultCard: {
    marginTop: 14,
    borderRadius: 10,
    padding: 12,
  },
  resultDanger: {
    backgroundColor: '#FF5A4F18',
    borderWidth: 1,
    borderColor: '#FF5A4F',
  },
  resultOk: {
    backgroundColor: '#22C55E12',
    borderWidth: 1,
    borderColor: '#22C55E44',
  },
  resultLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultDetail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  resultReason: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  scoreBadge: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  clearCollapseBtn: {
    marginTop: 10,
    backgroundColor: '#FF5A4F',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearCollapseBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  countdownPanel: {
    marginTop: 14,
    backgroundColor: '#DC262620',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  countdownIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  countdownTitle: {
    color: '#FF5A4F',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  countdownSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF5A4F',
    borderRadius: 3,
  },
  cancelBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  callStatusPanel: {
    marginTop: 14,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#38BDF822',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  callStatusSent: {
    backgroundColor: '#22C55E18',
    borderColor: '#22C55E',
  },
  callStatusFailed: {
    backgroundColor: '#DC262620',
    borderColor: '#DC2626',
  },
  callStatusCancelled: {
    backgroundColor: '#F59E0B18',
    borderColor: '#F59E0B',
  },
  callStatusText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
