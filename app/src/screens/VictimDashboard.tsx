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
import { DisasterDetector } from '../services/ai/DisasterDetector';
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

  const geminiApiKey = useStore((s) => s.geminiApiKey);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [classification, setClassification] = useState<DisasterClassification | null>(null);
  const detectorRef = useRef<DisasterDetector | null>(null);

  // Build detector when API key is available
  useEffect(() => {
    if (geminiApiKey) {
      const gemini = new GeminiService(geminiApiKey);
      detectorRef.current = new DisasterDetector(gemini);
    } else {
      detectorRef.current = null;
    }
  }, [geminiApiKey]);

  // Navigate to Emergency screen when emergency is active
  useEffect(() => {
    if (activeEmergency) {
      navigation.navigate('Emergency');
    }
  }, [activeEmergency, navigation]);

  const analyzingRef = useRef(false);

  const handleCapture = useCallback(async (base64: string) => {
    const detector = detectorRef.current;
    if (!detector || analyzingRef.current) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const result = await detector.analyzeFrame(base64);
      setClassification(result);
    } catch (error) {
      console.warn('[VictimDashboard] Frame analysis failed:', error);
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
            isAnalyzing={isAnalyzing}
            classification={classification}
          />
        </View>

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
