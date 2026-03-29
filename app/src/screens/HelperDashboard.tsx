import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useStore } from '../store/useStore';
import { GeminiService } from '../services/ai/GeminiService';
import { DisasterDetector } from '../services/ai/DisasterDetector';
import CameraViewComponent from '../components/CameraView';
import FirstAidGuide from '../components/FirstAidGuide';
import type { DisasterClassification, EmergencyType } from '../types';
import TopNavbar from '../components/TopNavbar';

const HelperDashboard: React.FC = () => {
  const backendUrl = useStore((s) => s.backendUrl);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [classification, setClassification] = useState<DisasterClassification | null>(null);
  const [firstAidSteps, setFirstAidSteps] = useState<string[]>([]);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [isAlerting, setIsAlerting] = useState(false);

  const geminiRef = useRef<GeminiService | null>(null);
  const detectorRef = useRef<DisasterDetector | null>(null);
  const lastBase64Ref = useRef<string | null>(null);

  // Lazily create services
  const getGemini = useCallback((): GeminiService | null => {
    if (!backendUrl) return null;
    if (!geminiRef.current) {
      geminiRef.current = new GeminiService(backendUrl);
      detectorRef.current = new DisasterDetector(geminiRef.current);
    }
    return geminiRef.current;
  }, [backendUrl]);

  const handleCapture = useCallback(async (base64: string) => {
    lastBase64Ref.current = base64;
    const detector = detectorRef.current ?? (() => {
      getGemini();
      return detectorRef.current;
    })();

    if (!detector || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const result = await detector.analyzeFrame(base64);
      setClassification(result);
    } catch (error) {
      console.warn('[HelperDashboard] Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, getGemini]);

  const handleAnalyzeScene = useCallback(async () => {
    const gemini = getGemini();
    if (!gemini) {
      Alert.alert('API Key Required', 'Please set your Gemini API key in Settings.');
      return;
    }

    if (!classification || classification.type === 'none') {
      Alert.alert('No Scene Data', 'Please capture an image first using the camera.');
      return;
    }

    setIsLoadingGuide(true);
    setFirstAidSteps([]);
    try {
      // Use instructions from image analysis if available, otherwise fetch from AI
      if (classification.instructions && classification.instructions.length > 0) {
        setFirstAidSteps(classification.instructions);
      } else {
        const steps = await gemini.getFirstAidGuidance(
          classification.type,
          classification.description,
        );
        setFirstAidSteps(steps);
      }
    } catch (error) {
      console.warn('[HelperDashboard] First aid guidance failed:', error);
      setFirstAidSteps([
        'Ensure the scene is safe before approaching.',
        'Call emergency services immediately (112).',
        'Provide basic first aid if trained.',
        'Stay with the victim until help arrives.',
      ]);
    } finally {
      setIsLoadingGuide(false);
    }
  }, [classification, getGemini]);

  const handleAlertEmergency = useCallback(async () => {
    setIsAlerting(true);
    try {
      const response = await fetch(`${backendUrl}/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: Date.now() / 1000,
          emergency_type: classification?.type ?? 'unknown',
          severity: classification?.severity ?? 'medium',
          objective_description: classification?.description ?? 'Emergency reported by helper',
          recommended_actions: firstAidSteps.length > 0
            ? firstAidSteps
            : ['Call 112 immediately'],
          raw_observations: classification
            ? [`Helper observed: ${classification.description}`]
            : ['Helper triggered emergency alert'],
        }),
      });
      if (response.ok) {
        Alert.alert('Alert Sent', 'Emergency services have been notified.');
      } else {
        Alert.alert('Alert Failed', 'Could not reach emergency services. Call 112 directly.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not connect to backend. Call 112 directly.');
    } finally {
      setIsAlerting(false);
    }
  }, [backendUrl, classification, firstAidSteps]);

  const emergencyType: EmergencyType = classification?.type ?? 'unknown';
  const hasClassification = classification != null && classification.type !== 'none';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <TopNavbar currentPage="Helper" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>🤝 Helper Mode</Text>
        <Text style={styles.subtitle}>Point camera at the scene to analyze</Text>

        {/* Camera View - Full Width */}
        <CameraViewComponent
          onCapture={handleCapture}
          isAnalyzing={isAnalyzing}
          classification={classification}
        />

        {/* Analyze Button */}
        <TouchableOpacity
          style={[styles.analyzeButton, !hasClassification && styles.analyzeButtonDisabled]}
          onPress={handleAnalyzeScene}
          activeOpacity={0.7}
          disabled={isLoadingGuide}
        >
          {isLoadingGuide ? (
            <ActivityIndicator color="#2563EB" size="small" />
          ) : (
            <Text style={styles.analyzeButtonText}>
              🔍 {hasClassification ? 'Get First Aid Guidance' : 'Capture Image First'}
            </Text>
          )}
        </TouchableOpacity>

        {/* First Aid Guide */}
        {(firstAidSteps.length > 0 || isLoadingGuide) && (
          <FirstAidGuide
            emergencyType={emergencyType}
            steps={firstAidSteps}
            isLoading={isLoadingGuide}
          />
        )}

        {/* Alert Emergency Services */}
        <TouchableOpacity
          style={styles.alertButton}
          onPress={handleAlertEmergency}
          activeOpacity={0.7}
          disabled={isAlerting}
        >
          {isAlerting ? (
            <ActivityIndicator color="#F8FAFC" size="small" />
          ) : (
            <>
              <Text style={styles.alertButtonIcon}>🚨</Text>
              <Text style={styles.alertButtonText}>Alert Emergency Services</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginLeft: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 20,
    marginBottom: 12,
  },
  analyzeButton: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#2563EB22',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563EB44',
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  alertButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  alertButtonIcon: {
    fontSize: 20,
  },
  alertButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 30,
  },
});

export default HelperDashboard;
