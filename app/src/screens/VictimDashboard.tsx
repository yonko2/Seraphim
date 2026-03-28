import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useEmergencyDetection } from '../hooks/useEmergencyDetection';
import { useStore } from '../store/useStore';
import { GeminiService } from '../services/ai/GeminiService';
import SensorMonitor from '../components/SensorMonitor';
import CameraViewComponent from '../components/CameraView';
import HealthMetrics from '../components/HealthMetrics';
import * as Location from 'expo-location';
import type { DisasterClassification } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const COUNTDOWN_SECONDS = 10;

type CallState = 'idle' | 'countdown' | 'calling' | 'sent' | 'cancelled' | 'failed';

const VictimDashboard: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    activeEmergency,
  } = useEmergencyDetection();

  const backendUrl = useStore((s) => s.backendUrl);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [classification, setClassification] = useState<DisasterClassification | null>(null);
  const geminiRef = useRef<GeminiService | null>(null);
  const [reactionSteps, setReactionSteps] = useState<string[]>([]);

  // GPS location state
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string | null;
  } | null>(null);

  // Countdown & call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [callMessage, setCallMessage] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Fetch GPS location on mount
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

  useEffect(() => {
    if (backendUrl) {
      geminiRef.current = new GeminiService(backendUrl);
    } else {
      geminiRef.current = null;
    }
  }, [backendUrl]);

  useEffect(() => {
    if (activeEmergency) {
      navigation.navigate('Emergency');
    }
  }, [activeEmergency, navigation]);

  const analyzingRef = useRef(false);

  // Start countdown when emergency is detected
  const isEmergency = classification != null &&
    classification.type !== 'none' &&
    classification.severity !== 'none';

  useEffect(() => {
    if (isEmergency && callState === 'idle') {
      startCountdown();
    }
  }, [isEmergency]);

  // Fetch reaction steps whenever an emergency is classified
  useEffect(() => {
    if (isEmergency && backendUrl && classification) {
      fetch(`${backendUrl}/api/first-aid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency_type: classification.type,
          description: classification.description || '',
        }),
      })
        .then((r) => r.json())
        .then((data) => setReactionSteps(data.steps || []))
        .catch((err) => console.warn('[VictimDashboard] First-aid fetch failed:', err));
    }
    if (!isEmergency) {
      setReactionSteps([]);
    }
  }, [classification]);

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
    setTimeout(() => {
      setCallState('idle');
      setCallMessage('');
    }, 3000);
  };

  const sendEmergencyReport = async () => {
    setCallState('calling');
    setCallMessage('📞 Connecting to emergency services…');

    if (!classification || !backendUrl) {
      setCallState('failed');
      setCallMessage('No analysis data or backend URL');
      return;
    }

    try {
      const report = {
        timestamp: Date.now() / 1000,
        emergency_type: classification.type,
        severity: classification.severity,
        location: userLocation,
        sensor_data: null,
        health_data: null,
        objective_description: classification.description || 'Emergency detected by AI vision',
        recommended_actions: classification.instructions || [],
        raw_observations: [
          `AI Confidence: ${(classification.confidence * 100).toFixed(0)}%`,
          `Detection type: ${classification.type}`,
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
      // Reset after 5s so next emergency can trigger countdown
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
        setClassification(null);
      }, 5000);
    } catch (error) {
      console.error('[VictimDashboard] Emergency report failed:', error);
      setCallState('failed');
      setCallMessage(`❌ Failed: ${String(error)}`);
      // Reset after 5s so user can retry
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
        setClassification(null);
      }, 5000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleCapture = useCallback(async (base64: string) => {
    const gemini = geminiRef.current;
    if (!gemini || analyzingRef.current) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);
    setCallState('idle');
    setCallMessage('');
    try {
      const result = await gemini.classifyImage(base64);
      setClassification(result);
    } catch (error) {
      console.warn('[VictimDashboard] Frame analysis failed:', error);
      Alert.alert('Analysis Failed', String(error));
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  const handleVideoCapture = useCallback(async (frames: string[]) => {
    const gemini = geminiRef.current;
    if (!gemini || analyzingRef.current || frames.length === 0) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);
    setCallState('idle');
    setCallMessage('');
    try {
      const result = await gemini.classifyVideo(frames);
      setClassification(result);
    } catch (error) {
      console.warn('[VictimDashboard] Video analysis failed:', error);
      Alert.alert('Analysis Failed', String(error));
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={false}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, isMonitoring ? styles.dotActive : styles.dotInactive]} />
            <Text style={styles.statusText}>
              {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.monitorToggle, isMonitoring ? styles.toggleStop : styles.toggleStart]}
            onPress={isMonitoring ? stopMonitoring : startMonitoring}
            activeOpacity={0.7}
          >
            <Text style={styles.monitorToggleText}>
              {isMonitoring ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sensor Monitor */}
        <SensorMonitor />

        {/* Camera Feed */}
        <View style={styles.cameraSection}>
          <CameraViewComponent
            onCapture={handleCapture}
            onVideoCapture={handleVideoCapture}
            isAnalyzing={isAnalyzing}
            classification={classification}
          />
        </View>

        {/* AI Analysis Result Panel */}
        {(classification || isAnalyzing) && (
          <View style={[
            styles.resultPanel,
            classification && classification.type !== 'none' && classification.severity !== 'none'
              ? styles.resultEmergency
              : styles.resultSafe,
            isAnalyzing && styles.resultAnalyzing,
          ]}>
            {isAnalyzing ? (
              <View style={styles.resultRow}>
                <Text style={styles.resultIcon}>⏳</Text>
                <Text style={styles.resultTitle}>Analyzing with AI…</Text>
              </View>
            ) : classification && classification.type !== 'none' && classification.severity !== 'none' ? (
              <>
                <View style={styles.resultRow}>
                  <Text style={styles.resultIcon}>🚨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>
                      {classification.type.replace('_', ' ').toUpperCase()} DETECTED
                    </Text>
                    <Text style={styles.resultMeta}>
                      Severity: {classification.severity} · Confidence: {(classification.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
                {classification.description ? (
                  <Text style={styles.resultDescription}>{classification.description}</Text>
                ) : null}
                {reactionSteps.length > 0 && (
                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsTitle}>⚡ What To Do:</Text>
                    {reactionSteps.map((step, i) => (
                      <Text key={i} style={styles.instructionStep}>
                        {i + 1}. {step}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            ) : classification ? (
              <View style={styles.resultRow}>
                <Text style={styles.resultIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultTitle, { color: '#30d158' }]}>NO EMERGENCY</Text>
                  {classification.description ? (
                    <Text style={styles.resultDescription}>{classification.description}</Text>
                  ) : null}
                  <Text style={styles.resultMeta}>
                    Confidence: {(classification.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Countdown / Call Status Panel */}
        {callState === 'countdown' && (
          <View style={styles.countdownPanel}>
            <Text style={styles.countdownTitle}>📞 Calling emergency in {countdown}s</Text>
            <Text style={styles.countdownSub}>
              A Telegram call and message will be sent to the operator
            </Text>
            <View style={styles.countdownBarBg}>
              <Animated.View
                style={[
                  styles.countdownBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelCountdown}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>❌ CANCEL CALL</Text>
            </TouchableOpacity>
          </View>
        )}

        {callState === 'calling' && (
          <View style={styles.callingPanel}>
            <Text style={styles.callingText}>📞 {callMessage}</Text>
          </View>
        )}

        {callState === 'sent' && (
          <View style={styles.sentPanel}>
            <Text style={styles.sentText}>{callMessage}</Text>
          </View>
        )}

        {callState === 'cancelled' && (
          <View style={styles.cancelledPanel}>
            <Text style={styles.cancelledText}>{callMessage}</Text>
          </View>
        )}

        {callState === 'failed' && (
          <View style={styles.failedPanel}>
            <Text style={styles.failedText}>{callMessage}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={sendEmergencyReport}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>🔄 Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Health Metrics */}
        <HealthMetrics />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingTop: 56,
    paddingBottom: 20,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: '#30d158',
  },
  dotInactive: {
    backgroundColor: '#666',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  monitorToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleStart: {
    backgroundColor: '#30d15822',
  },
  toggleStop: {
    backgroundColor: '#ff3b3022',
  },
  monitorToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  cameraSection: {
    maxHeight: 320,
  },
  resultPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
  },
  resultEmergency: {
    backgroundColor: '#3a1111',
    borderWidth: 2,
    borderColor: '#ff3b30',
  },
  resultSafe: {
    backgroundColor: '#112211',
    borderWidth: 2,
    borderColor: '#30d158',
  },
  resultAnalyzing: {
    backgroundColor: '#2a2200',
    borderWidth: 2,
    borderColor: '#ff9500',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultIcon: {
    fontSize: 32,
  },
  resultTitle: {
    color: '#ff3b30',
    fontSize: 18,
    fontWeight: '800',
  },
  resultMeta: {
    color: '#999',
    fontSize: 13,
    marginTop: 2,
  },
  resultDescription: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  instructionsBox: {
    marginTop: 12,
    backgroundColor: '#ffffff10',
    borderRadius: 10,
    padding: 12,
  },
  instructionsTitle: {
    color: '#ff9500',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionStep: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 2,
  },
  emergencyButton: undefined,
  emergencyButtonIcon: undefined,
  emergencyButtonText: undefined,
  emergencyButtonSub: undefined,
  bottomSpacer: {
    height: 30,
  },
  // Countdown panel
  countdownPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1a1000',
    borderWidth: 2,
    borderColor: '#ff9500',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  countdownTitle: {
    color: '#ff9500',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  countdownSub: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  countdownBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  countdownBarFill: {
    height: '100%',
    backgroundColor: '#ff9500',
    borderRadius: 4,
  },
  cancelButton: {
    backgroundColor: '#ff3b3022',
    borderWidth: 2,
    borderColor: '#ff3b30',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ff3b30',
    fontSize: 18,
    fontWeight: '800',
  },
  // Calling panel
  callingPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1a1a00',
    borderWidth: 2,
    borderColor: '#ff9500',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  callingText: {
    color: '#ff9500',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Sent panel
  sentPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#112211',
    borderWidth: 2,
    borderColor: '#30d158',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  sentText: {
    color: '#30d158',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Cancelled panel
  cancelledPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  cancelledText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Failed panel
  failedPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#3a1111',
    borderWidth: 2,
    borderColor: '#ff3b30',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  failedText: {
    color: '#ff3b30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#ff3b3022',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#ff3b30',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default VictimDashboard;
