import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
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
import type { DisasterClassification } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const VictimDashboard: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    triggerManualEmergency,
    activeEmergency,
  } = useEmergencyDetection();

  const backendUrl = useStore((s) => s.backendUrl);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [classification, setClassification] = useState<DisasterClassification | null>(null);
  const geminiRef = useRef<GeminiService | null>(null);

  useEffect(() => {
    if (backendUrl) {
      geminiRef.current = new GeminiService(backendUrl);
    } else {
      geminiRef.current = null;
    }
  }, [backendUrl]);

  // Navigate to Emergency screen when emergency is active
  useEffect(() => {
    if (activeEmergency) {
      navigation.navigate('Emergency');
    }
  }, [activeEmergency, navigation]);

  const analyzingRef = useRef(false);

  const handleCapture = useCallback(async (base64: string) => {
    const gemini = geminiRef.current;
    if (!gemini || analyzingRef.current) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);
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
                {classification.instructions && classification.instructions.length > 0 && (
                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsTitle}>⚡ Immediate Actions:</Text>
                    {classification.instructions.map((step, i) => (
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

        {/* Health Metrics */}
        <HealthMetrics />

        {/* Emergency Button */}
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={triggerManualEmergency}
          activeOpacity={0.7}
        >
          <Text style={styles.emergencyButtonIcon}>🚨</Text>
          <Text style={styles.emergencyButtonText}>EMERGENCY</Text>
          <Text style={styles.emergencyButtonSub}>Tap to trigger manual emergency</Text>
        </TouchableOpacity>

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
  emergencyButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#ff3b30',
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  emergencyButtonIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  emergencyButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
  },
  emergencyButtonSub: {
    fontSize: 12,
    color: '#ffffffaa',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 30,
  },
});

export default VictimDashboard;
