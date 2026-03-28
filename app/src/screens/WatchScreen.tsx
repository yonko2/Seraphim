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

// ─── Health data model ───────────────────────────────────────────────
interface HealthData {
  hr: number;
  spo2: number;
  stress: number;
  bodyBattery: number;
  hrv: number;
  restingHr: number;
  temp: number;
  glucose: number;
  respRate: number;
}

// ─── Emergency simulation definitions ────────────────────────────────
interface EmergencySimulation {
  id: string;
  label: string;
  icon: string;
  emergencyType: string;
  severity: string;
  criticalValues: Partial<HealthData>;
  description: string;
  actions: string[];
  threshold: string;
}

const EMERGENCY_SIMULATIONS: EmergencySimulation[] = [
  {
    id: 'ischemic_heart',
    label: 'Ischemic Heart Disease',
    icon: '🫀',
    emergencyType: 'medical',
    severity: 'critical',
    criticalValues: { hr: 142, hrv: 11, restingHr: 112, stress: 94 },
    description: 'ST-segment elevation detected. Persistent tachycardia (HR 142bpm at rest) with critically low HRV (11ms).',
    actions: ['Call 911 immediately', 'Administer aspirin if available', 'Keep patient calm and seated', 'Prepare for CPR if needed'],
    threshold: 'HR >100bpm at rest + HRV critically low',
  },
  {
    id: 'copd_resp_failure',
    label: 'COPD / Resp. Failure',
    icon: '🫁',
    emergencyType: 'medical',
    severity: 'critical',
    criticalValues: { spo2: 82, respRate: 32, hr: 118, stress: 78 },
    description: 'Critical oxygen desaturation (SpO2 82%). Respiration rate 32 breaths/min with detected acoustic wheeze pattern.',
    actions: ['Call 911 immediately', 'Sit patient upright', 'Administer supplemental oxygen if available', 'Use rescue inhaler if prescribed'],
    threshold: 'SpO2 <88% + Respiration Rate >25/min',
  },
  {
    id: 'fall_serious',
    label: 'Serious Fall',
    icon: '🦴',
    emergencyType: 'fall',
    severity: 'critical',
    criticalValues: { hr: 125, stress: 82, spo2: 93 },
    description: 'High-impact fall detected (>3.5G force followed by stasis). Body orientation changed >45° with no subsequent movement.',
    actions: ['Do not move the victim — spinal injury possible', 'Call 911 immediately', 'Check consciousness and breathing', 'Apply pressure to visible bleeding'],
    threshold: 'Impact >3.5G + 0G stasis + tilt >45°',
  },
  {
    id: 'heat_stroke',
    label: 'Heat Stroke',
    icon: '🌡️',
    emergencyType: 'medical',
    severity: 'critical',
    criticalValues: { temp: 41.2, hr: 168, stress: 96, spo2: 91, bodyBattery: 8 },
    description: 'Estimated core temperature 41.2°C (106°F). Galvanic skin response drop-off indicates sweat failure. HR 168bpm.',
    actions: ['Call 911 — life-threatening emergency', 'Move to cool/shaded area immediately', 'Apply ice packs to neck, armpits, groin', 'Do NOT give fluids if unconscious'],
    threshold: 'Core temp >40°C + sweat failure + HR >160bpm',
  },
];

// ─── Simulated health hook with override support ─────────────────────
function useSimulatedHealth(isActive: boolean, overrides: Partial<HealthData> | null) {
  const baseRef = useRef({
    hr: 68 + Math.floor(Math.random() * 10),
    spo2: 97 + Math.floor(Math.random() * 2),
    stress: 25 + Math.floor(Math.random() * 10),
    bodyBattery: 65 + Math.floor(Math.random() * 15),
    hrv: 42 + Math.floor(Math.random() * 15),
    restingHr: 58 + Math.floor(Math.random() * 8),
    temp: 36.4 + Math.random() * 0.6,
    glucose: 85 + Math.floor(Math.random() * 20),
    respRate: 14 + Math.floor(Math.random() * 4),
  });

  const [data, setData] = useState<HealthData>({
    ...baseRef.current,
    temp: parseFloat(baseRef.current.temp.toFixed(1)),
  });

  useEffect(() => {
    if (!isActive) return;

    const jitter = (base: number, range: number, min: number, max: number) => {
      const val = base + Math.round((Math.random() - 0.5) * range);
      return Math.max(min, Math.min(max, val));
    };

    const interval = setInterval(() => {
      if (overrides) {
        // When simulating, show critical values with small jitter
        setData((prev) => ({
          hr: jitter(overrides.hr ?? prev.hr, 3, 0, 250),
          spo2: jitter(overrides.spo2 ?? prev.spo2, 1, 0, 100),
          stress: jitter(overrides.stress ?? prev.stress, 2, 0, 100),
          bodyBattery: jitter(overrides.bodyBattery ?? prev.bodyBattery, 1, 0, 100),
          hrv: jitter(overrides.hrv ?? prev.hrv, 2, 0, 100),
          restingHr: jitter(overrides.restingHr ?? prev.restingHr, 2, 0, 200),
          temp: parseFloat((overrides.temp ?? prev.temp + (Math.random() - 0.5) * 0.1).toFixed(1)),
          glucose: jitter(overrides.glucose ?? prev.glucose, 2, 0, 400),
          respRate: jitter(overrides.respRate ?? prev.respRate, 1, 8, 40),
        }));
      } else {
        const b = baseRef.current;
        setData({
          hr: jitter(b.hr, 6, 55, 100),
          spo2: jitter(b.spo2, 2, 94, 100),
          stress: jitter(b.stress, 8, 10, 60),
          bodyBattery: jitter(b.bodyBattery, 4, 30, 100),
          hrv: jitter(b.hrv, 6, 25, 80),
          restingHr: jitter(b.restingHr, 2, 50, 70),
          temp: parseFloat((36.4 + Math.random() * 0.6).toFixed(1)),
          glucose: jitter(b.glucose, 5, 75, 115),
          respRate: jitter(b.respRate, 2, 12, 20),
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, overrides]);

  // Immediately apply overrides when they change
  useEffect(() => {
    if (overrides) {
      setData((prev) => ({ ...prev, ...overrides }));
    }
  }, [overrides]);

  return data;
}

// ─── Main component ──────────────────────────────────────────────────
export default function WatchScreen() {
  const collapseMonitoring = useStore((s) => s.collapseMonitoring);
  const setCollapseMonitoring = useStore((s) => s.setCollapseMonitoring);
  const backendUrl = useStore((s) => s.backendUrl);
  const userProfile = useStore((s) => s.userProfile);

  const {
    isRunning, lastResult, collapseDetected, clearCollapse,
    liveAccel, liveGyro,
  } = useCollapseMonitor();

  // Active simulation state
  const [activeSimulation, setActiveSimulation] = useState<EmergencySimulation | null>(null);
  const activeSimRef = useRef<EmergencySimulation | null>(null);
  const healthOverrides = activeSimulation?.criticalValues ?? null;
  const health = useSimulatedHealth(true, healthOverrides);

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
    if (collapseDetected && callState === 'idle' && !activeSimulation) {
      startCountdown();
    }
  }, [collapseDetected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const triggerSimulation = useCallback((sim: EmergencySimulation) => {
    if (callState === 'countdown' || callState === 'calling') return;
    // Reset any lingering cancelled/failed/sent state
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCallState('idle');
    setCallMessage('');
    setActiveSimulation(sim);
    activeSimRef.current = sim;
    setTimeout(() => startCountdown(), 500);
  }, [callState]);

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
    setCallState('idle');
    setCallMessage('');
    setActiveSimulation(null);
    activeSimRef.current = null;
    clearCollapse();
  };

  const sendEmergencyReport = useCallback(async () => {
    setCallState('calling');
    setCallMessage('📞 Connecting to emergency services…');

    if (!backendUrl) {
      setCallState('failed');
      setCallMessage('No backend URL configured');
      setTimeout(() => { setCallState('idle'); setCallMessage(''); setActiveSimulation(null); activeSimRef.current = null; }, 5000);
      return;
    }

    try {
      const sim = activeSimRef.current;
      const emergencyType = sim?.emergencyType ?? 'fall';
      const severity = sim?.severity ?? (
        (lastResult?.confidence ?? 0.8) >= 0.8 ? 'critical' : 'high'
      );
      const description = sim?.description
        ?? `Person collapse/fall detected by phone motion sensors. ${lastResult?.reason ?? ''}`;
      const actions = sim?.actions ?? [
        'Check if victim is conscious and breathing',
        'Do not move victim if spinal injury suspected',
        'Call local emergency services',
        'Begin CPR if victim is not breathing',
      ];

      const report = {
        timestamp: Date.now() / 1000,
        emergency_type: emergencyType,
        severity,
        location: userLocation,
        sensor_data: null,
        health_data: {
          heart_rate: { current: health.hr },
          spo2: { latest: health.spo2 },
          stress: health.stress,
          temperature: health.temp,
          glucose: health.glucose,
          respiration_rate: health.respRate,
          hrv: health.hrv,
        },
        victim_profile: {
          name: userProfile.name || undefined,
          age: userProfile.age || undefined,
          blood_type: userProfile.bloodType || undefined,
          conditions: userProfile.conditions.length ? userProfile.conditions : undefined,
          allergies: userProfile.allergies.length ? userProfile.allergies : undefined,
          medications: userProfile.medications.length ? userProfile.medications : undefined,
          emergency_contact: userProfile.emergencyContact || undefined,
          notes: userProfile.notes || undefined,
        },
        objective_description: description,
        recommended_actions: actions,
        raw_observations: [
          sim ? `Simulation: ${sim.label}` : 'Detection source: accelerometer + gyroscope',
          sim ? `Threshold: ${sim.threshold}` : `Collapse confidence: ${((lastResult?.confidence ?? 0) * 100).toFixed(0)}%`,
          `Heart rate: ${health.hr} BPM`,
          `SpO2: ${health.spo2}%`,
          `Temperature: ${health.temp}°C`,
          `Glucose: ${health.glucose} mg/dL`,
          `Respiration: ${health.respRate} breaths/min`,
          ...(userProfile.conditions.length ? [`Known conditions: ${userProfile.conditions.join(', ')}`] : []),
          ...(userProfile.allergies.length ? [`Allergies: ${userProfile.allergies.join(', ')}`] : []),
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
        setActiveSimulation(null);
        activeSimRef.current = null;
        clearCollapse();
      }, 5000);
    } catch (error) {
      console.error('[WatchScreen] Emergency report failed:', error);
      setCallState('failed');
      setCallMessage(`❌ Failed: ${String(error)}`);
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
        setActiveSimulation(null);
        activeSimRef.current = null;
      }, 5000);
    }
  }, [backendUrl, lastResult, userLocation, health, clearCollapse]);

  const accelMag = liveAccel
    ? Math.sqrt(liveAccel.x ** 2 + liveAccel.y ** 2 + liveAccel.z ** 2).toFixed(2)
    : '—';
  const gyroMag = liveGyro
    ? Math.sqrt(liveGyro.x ** 2 + liveGyro.y ** 2 + liveGyro.z ** 2).toFixed(2)
    : '—';

  const isCritical = (key: keyof HealthData) => activeSimulation?.criticalValues[key] != null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D5DDE8" />
      <TopNavbar currentPage="Watch" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Active Simulation Banner */}
        {activeSimulation && callState !== 'idle' && (
          <View style={styles.simBanner}>
            <Text style={styles.simBannerIcon}>{activeSimulation.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.simBannerTitle}>{activeSimulation.label}</Text>
              <Text style={styles.simBannerThreshold}>{activeSimulation.threshold}</Text>
            </View>
          </View>
        )}

        {/* Simulated Health Data */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>❤️ Health Data</Text>
            <View style={[styles.simBadge, activeSimulation && styles.simBadgeCritical]}>
              <Text style={[styles.simBadgeText, activeSimulation && styles.simBadgeTextCritical]}>
                {activeSimulation ? '⚠ CRITICAL' : '● SIMULATED'}
              </Text>
            </View>
          </View>

          <View style={styles.healthGrid}>
            <HealthTile icon="❤️" label="Heart Rate" value={health.hr} unit="BPM" color={isCritical('hr') ? '#FF5A4F' : '#FF5A4F'} critical={isCritical('hr')} />
            <HealthTile icon="🫁" label="SpO2" value={health.spo2} unit="%" color={isCritical('spo2') ? '#FF5A4F' : '#38BDF8'} critical={isCritical('spo2')} />
            <HealthTile icon="🌡️" label="Temp" value={health.temp} unit="°C" color={isCritical('temp') ? '#FF5A4F' : '#F59E0B'} critical={isCritical('temp')} />
            <HealthTile icon="💨" label="Resp Rate" value={health.respRate} unit="/min" color={isCritical('respRate') ? '#FF5A4F' : '#38BDF8'} critical={isCritical('respRate')} />
            <HealthTile icon="💓" label="HRV" value={health.hrv} unit="ms" color={isCritical('hrv') ? '#FF5A4F' : '#A78BFA'} critical={isCritical('hrv')} />
            <HealthTile icon="😰" label="Stress" value={health.stress} unit="" color={isCritical('stress') ? '#FF5A4F' : '#F59E0B'} critical={isCritical('stress')} />
            <HealthTile icon="🔋" label="Body Battery" value={health.bodyBattery} unit="" color={isCritical('bodyBattery') ? '#FF5A4F' : '#22C55E'} critical={isCritical('bodyBattery')} />
          </View>
        </View>

        {/* Simulate Emergency Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>⚠️ Simulate Emergency</Text>
          </View>
          <Text style={styles.simDescription}>
            Trigger a simulated medical emergency with critical vital signs. Each scenario overrides health data and initiates the emergency alert flow.
          </Text>
          <View style={styles.simGrid}>
            {EMERGENCY_SIMULATIONS.map((sim) => (
              <TouchableOpacity
                key={sim.id}
                style={[
                  styles.simButton,
                  activeSimulation?.id === sim.id && styles.simButtonActive,
                ]}
                onPress={() => triggerSimulation(sim)}
                disabled={callState !== 'idle'}
                activeOpacity={0.7}
              >
                <Text style={styles.simButtonIcon}>{sim.icon}</Text>
                <Text style={styles.simButtonLabel} numberOfLines={2}>{sim.label}</Text>
              </TouchableOpacity>
            ))}
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
            Uses phone accelerometer and gyroscope combined with health vitals to detect falls and collapses in real-time.
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
        </View>

        {/* Emergency Countdown — shared by collapse + simulation */}
        {callState === 'countdown' && (
          <View style={[styles.card, styles.countdownCard]}>
            <Text style={styles.countdownIcon}>🚨</Text>
            <Text style={styles.countdownTitle}>
              {activeSimulation
                ? `${activeSimulation.icon} ${activeSimulation.label}`
                : 'Collapse Detected'}
            </Text>
            <Text style={styles.countdownTimer}>Calling emergency in {countdown}s</Text>
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
            styles.card,
            styles.callStatusPanel,
            callState === 'sent' && styles.callStatusSent,
            callState === 'failed' && styles.callStatusFailed,
            callState === 'cancelled' && styles.callStatusCancelled,
          ]}>
            <Text style={styles.callStatusText}>{callMessage}</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function HealthTile({ icon, label, value, unit, color, critical }: {
  icon: string; label: string; value: any; unit: string; color: string; critical?: boolean;
}) {
  return (
    <View style={[styles.healthTile, critical && styles.healthTileCritical]}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]}>
        {value != null ? String(value) : 'N/A'}
      </Text>
      {value != null && unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      {critical && <Text style={styles.tileCriticalBadge}>CRITICAL</Text>}
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

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D5DDE8',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#0E1726',
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

  // Simulation banner
  simBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC262630',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    gap: 12,
  },
  simBannerIcon: {
    fontSize: 28,
  },
  simBannerTitle: {
    color: '#FF5A4F',
    fontSize: 15,
    fontWeight: '800',
  },
  simBannerThreshold: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },

  // Sim badge
  simBadge: {
    backgroundColor: '#38BDF822',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  simBadgeCritical: {
    backgroundColor: '#FF5A4F22',
  },
  simBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  simBadgeTextCritical: {
    color: '#FF5A4F',
  },

  // Status badges
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

  // Health grid
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthTile: {
    backgroundColor: '#182336',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    width: '48%',
    flexGrow: 1,
  },
  healthTileCritical: {
    backgroundColor: '#FF5A4F15',
    borderWidth: 1,
    borderColor: '#FF5A4F55',
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
  tileCriticalBadge: {
    color: '#FF5A4F',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
    backgroundColor: '#FF5A4F20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Simulate emergency
  simDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  simGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  simButton: {
    backgroundColor: '#182336',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    flexGrow: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#182336',
  },
  simButtonActive: {
    borderColor: '#FF5A4F',
    backgroundColor: '#FF5A4F15',
  },
  simButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  simButtonLabel: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Sensor grid
  sensorGrid: {
    gap: 10,
  },
  sensorBlock: {
    backgroundColor: '#182336',
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

  // Collapse monitoring
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
    backgroundColor: '#182336',
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

  // Countdown
  countdownCard: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#DC262615',
    alignItems: 'center',
  },
  countdownIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  countdownTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  countdownTimer: {
    color: '#FF5A4F',
    fontSize: 22,
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
    backgroundColor: '#182336',
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
    backgroundColor: '#182336',
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

  // Call status
  callStatusPanel: {
    alignItems: 'center',
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
