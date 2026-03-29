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
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useEmergencyDetection } from '../hooks/useEmergencyDetection';
import { useStore } from '../store/useStore';
import { GeminiService } from '../services/ai/GeminiService';
import CameraViewComponent from '../components/CameraView';
import TopNavbar from '../components/TopNavbar';
import LocationCard from '../components/LocationCard';
import ActivityLog from '../components/ActivityLog';
import type { ActivityEntry } from '../components/ActivityLog';
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
  const userProfile = useStore((s) => s.userProfile);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [classification, setClassification] = useState<DisasterClassification | null>(null);
  const geminiRef = useRef<GeminiService | null>(null);
  const [reactionSteps, setReactionSteps] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [showResultPanel, setShowResultPanel] = useState(true);

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
  let nextActivityId = useRef(0);

  const addActivity = useCallback((type: ActivityEntry['type'], label: string) => {
    nextActivityId.current += 1;
    setActivityLog((prev) => [
      { id: String(nextActivityId.current), timestamp: new Date(), type, label },
      ...prev,
    ]);
  }, []);

  // Start countdown when emergency is detected
  // Show result panel whenever a new classification arrives
  useEffect(() => {
    if (classification) {
      setShowResultPanel(true);
    }
  }, [classification]);

  const isEmergency = classification != null &&
    classification.type !== 'none' &&
    classification.severity !== 'none';

  useEffect(() => {
    if (isEmergency && callState === 'idle') {
      startCountdown();
    }
  }, [classification]);

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
    addActivity('alert_cancelled', 'Emergency call cancelled');
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
        objective_description: classification.description || 'Emergency detected by AI vision',
        recommended_actions: classification.instructions || [],
        raw_observations: [
          `AI Confidence: ${(classification.confidence * 100).toFixed(0)}%`,
          `Detection type: ${classification.type}`,
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
      addActivity('alert_sent', `Alert sent (${classification.type})`);
      // Reset after 5s so next emergency can trigger countdown
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
      }, 5000);
    } catch (error) {
      console.error('[VictimDashboard] Emergency report failed:', error);
      setCallState('failed');
      setCallMessage(`❌ Failed: ${String(error)}`);
      // Reset after 5s so user can retry
      setTimeout(() => {
        setCallState('idle');
        setCallMessage('');
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

    setCapturedImage(`data:image/jpeg;base64,${base64}`);
    addActivity('capture', 'Photo captured');
    analyzingRef.current = true;
    setIsAnalyzing(true);
    setCallState('idle');
    setCallMessage('');
    try {
      const result = await gemini.classifyImage(base64);
      setClassification(result);
      if (result.type !== 'none' && result.severity !== 'none') {
        addActivity('emergency', `${result.type.replace('_', ' ')} detected (${result.severity})`);
      } else {
        addActivity('safe', 'No emergency detected');
      }
    } catch (error) {
      console.warn('[VictimDashboard] Frame analysis failed:', error);
      Alert.alert('Analysis Failed', String(error));
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [addActivity]);

  const handleVideoCapture = useCallback(async (frames: string[]) => {
    const gemini = geminiRef.current;
    if (!gemini || analyzingRef.current || frames.length === 0) return;

    addActivity('capture', `Video recorded (${frames.length} frames)`);
    analyzingRef.current = true;
    setIsAnalyzing(true);
    setCallState('idle');
    setCallMessage('');
    try {
      const result = await gemini.classifyVideo(frames);
      setClassification(result);
      if (result.type !== 'none' && result.severity !== 'none') {
        addActivity('emergency', `${result.type.replace('_', ' ')} detected (${result.severity})`);
      } else {
        addActivity('safe', 'No emergency detected');
      }
    } catch (error) {
      console.warn('[VictimDashboard] Video analysis failed:', error);
      Alert.alert('Analysis Failed', String(error));
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [addActivity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <TopNavbar currentPage="Dashboard" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={false}>
        {/* Camera Feed */}
        <View style={styles.cameraSection}>
          <CameraViewComponent
            onCapture={handleCapture}
            onVideoCapture={handleVideoCapture}
            isAnalyzing={isAnalyzing}
            classification={classification}
          />
        </View>

        {/* Captured Image Preview */}
        {capturedImage && (
          <View style={styles.capturedImagePanel}>
            <Text style={styles.capturedImageLabel}>📸 Captured Image</Text>
            <Image
              source={{ uri: capturedImage }}
              style={styles.capturedImage as any}
              resizeMode="cover"
            />
          </View>
        )}

        {/* AI Analysis Result Panel */}
        {showResultPanel && (classification || isAnalyzing) && (
          <View style={[
            styles.resultPanel,
            classification && classification.type !== 'none' && classification.severity !== 'none'
              ? styles.resultEmergency
              : styles.resultSafe,
            isAnalyzing && styles.resultAnalyzing,
          ]}>
            {!isAnalyzing && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => { setShowResultPanel(false); setCapturedImage(null); }}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            )}
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
                  <Text style={[styles.resultTitle, { color: '#22C55E' }]}>NO EMERGENCY</Text>
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

        {/* Location Card */}
        <LocationCard location={userLocation} />

        {/* Recent Activity */}
        <ActivityLog entries={activityLog} />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D5DDE8',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  cameraSection: {
  },
  capturedImagePanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  capturedImageLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  capturedImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: '#F4F6F8',
  },
  resultPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC22',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  resultEmergency: {
    backgroundColor: '#1C1117',
    borderWidth: 2,
    borderColor: '#FF5A4F',
  },
  resultSafe: {
    backgroundColor: '#111C16',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  resultAnalyzing: {
    backgroundColor: '#1C1A0F',
    borderWidth: 2,
    borderColor: '#F59E0B',
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
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '800',
  },
  resultMeta: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  resultDescription: {
    color: '#0F172A',
    fontSize: 14,
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  instructionsBox: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
  },
  instructionsTitle: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionStep: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 2,
  },
  emergencyButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  emergencyButtonIcon: {
    fontSize: 18,
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  emergencyButtonSub: {
    color: '#6B7280',
    fontSize: 12,
  },
  bottomSpacer: {
    height: 30,
  },
  // Countdown panel
  countdownPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1C1A0F',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  countdownTitle: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  countdownSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  countdownBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#182336',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  countdownBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  cancelButton: {
    backgroundColor: '#FF5A4F22',
    borderWidth: 2,
    borderColor: '#FF5A4F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF5A4F',
    fontSize: 18,
    fontWeight: '800',
  },
  // Calling panel
  callingPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1C1A0F',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  callingText: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Sent panel
  sentPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#111C16',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  sentText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Cancelled panel
  cancelledPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#0E1726',
    borderWidth: 2,
    borderColor: '#94A3B8',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  cancelledText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Failed panel
  failedPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1C1117',
    borderWidth: 2,
    borderColor: '#FF5A4F',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  failedText: {
    color: '#FF5A4F',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#FF5A4F22',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#FF5A4F',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default VictimDashboard;
