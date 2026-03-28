import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  CameraView as ExpoCameraView,
  useCameraPermissions,
} from 'expo-camera';
import { DisasterClassification } from '../types';

const RECORD_DURATION_MS = 10000;
const MAX_FRAMES = 100; // no practical limit — capture as many as hardware allows

interface CameraViewProps {
  onCapture?: (base64: string) => void;
  onVideoCapture?: (frames: string[]) => void;
  isAnalyzing?: boolean;
  classification?: DisasterClassification | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff3b30',
  high: '#ff9500',
  medium: '#ffd60a',
  low: '#30d158',
  none: '#888',
};

export default function CameraViewComponent({
  onCapture,
  onVideoCapture,
  isAnalyzing = false,
  classification = null,
}: CameraViewProps) {
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const recordingRef = useRef(false);
  const framesRef = useRef<string[]>([]);

  const isEmergency =
    classification != null &&
    classification.type !== 'none' &&
    classification.severity !== 'none';

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const captureFrame = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      if (photo?.base64 && onCapture) {
        onCapture(photo.base64);
      }
    } catch (err) {
      console.warn('[CameraView] Capture failed:', err);
    }
  }, [onCapture]);

  const handleCapture = async () => {
    if (isAnalyzing) return;
    await captureFrame();
  };

  const toggleRecording = () => {
    if (recording) {
      // Manual stop — send whatever frames we have
      recordingRef.current = false;
      setRecording(false);
      setRecordProgress(0);
      const collected = [...framesRef.current];
      framesRef.current = [];
      console.log(`[CameraView] Recording stopped manually, ${collected.length} frames`);
      if (collected.length > 0 && onVideoCapture) {
        onVideoCapture(collected);
      }
    } else {
      recordingRef.current = true;
      framesRef.current = [];
      setRecording(true);
      setRecordProgress(0);

      // Back-to-back capture loop — no frames skipped
      const captureLoop = async () => {
        const startTime = Date.now();
        let count = 0;

        while (recordingRef.current && count < MAX_FRAMES) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= RECORD_DURATION_MS) break;

          setRecordProgress(Math.min(elapsed / RECORD_DURATION_MS, 1));

          if (cameraRef.current) {
            try {
              const photo = await cameraRef.current.takePictureAsync({
                base64: true,
                quality: 0.2,
                skipProcessing: true,
              });
              if (photo?.base64 && recordingRef.current) {
                framesRef.current.push(photo.base64);
                count++;
                console.log(`[CameraView] Frame ${count} captured at ${elapsed}ms`);
              }
            } catch (err) {
              console.warn('[CameraView] Frame capture failed:', err);
            }
          }
        }

        // Done
        recordingRef.current = false;
        setRecording(false);
        setRecordProgress(1);
        const collected = [...framesRef.current];
        framesRef.current = [];
        console.log(`[CameraView] Recording done, ${collected.length} frames captured`);
        setTimeout(() => setRecordProgress(0), 300);
        if (collected.length > 0 && onVideoCapture) {
          onVideoCapture(collected);
        }
      };

      captureLoop();
    }
  };

  useEffect(() => {
    return () => {
      recordingRef.current = false;
    };
  }, []);

  if (!permission) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#007AFF" />
        <Text style={styles.permText}>Checking camera permissions…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.card}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSubtitle}>
          Seraphim needs camera access to detect emergencies in real time.
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission} activeOpacity={0.7}>
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.card, isEmergency && styles.emergencyBorder]}>
      <View style={styles.header}>
        <Text style={styles.title}>🎥 Live Camera</Text>
        {recording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
        {isAnalyzing && !recording && (
          <View style={styles.analyzingBadge}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.analyzingText}>Analyzing…</Text>
          </View>
        )}
      </View>

      <View style={styles.cameraWrapper}>
        <ExpoCameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />

        {classification && classification.type !== 'none' && (
          <View style={styles.overlay}>
            <View
              style={[
                styles.classificationBadge,
                { backgroundColor: (SEVERITY_COLORS[classification.severity] || '#888') + '22' },
              ]}
            >
              <View
                style={[
                  styles.severityDot,
                  { backgroundColor: SEVERITY_COLORS[classification.severity] || '#888' },
                ]}
              />
              <Text
                style={[
                  styles.classificationType,
                  { color: SEVERITY_COLORS[classification.severity] || '#888' },
                ]}
              >
                {classification.type.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.confidence}>
                {(classification.confidence * 100).toFixed(0)}%
              </Text>
            </View>
            {classification.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {classification.description}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.captureBtn, (isAnalyzing || !cameraReady || recording) && styles.captureDisabled]}
          onPress={handleCapture}
          activeOpacity={0.7}
          disabled={isAnalyzing || !cameraReady || recording}
        >
          <Text style={styles.captureBtnText}>📸 Capture</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.recordBtn,
            recording && styles.recordBtnActive,
            (!cameraReady || isAnalyzing) && styles.captureDisabled,
          ]}
          onPress={toggleRecording}
          activeOpacity={0.7}
          disabled={!cameraReady || isAnalyzing}
        >
          <Text style={styles.recordBtnText}>
            {recording ? '⏹ Stop' : '🎥 Record'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recording progress bar */}
      {recording && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${recordProgress * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  emergencyBorder: {
    borderWidth: 2,
    borderColor: '#ff3b30',
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
  analyzingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  analyzingText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff3b3022',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  recordingText: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '800',
  },
  cameraWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    height: 220,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  classificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  classificationType: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  confidence: {
    color: '#ffffffcc',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: '#ffffffcc',
    fontSize: 12,
    marginTop: 4,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captureBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  captureDisabled: {
    opacity: 0.5,
  },
  recordBtn: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ff3b30',
  },
  recordBtnActive: {
    backgroundColor: '#ff3b3033',
  },
  recordBtnText: {
    color: '#ff3b30',
    fontWeight: '700',
    fontSize: 16,
  },
  progressBarBg: {
    marginTop: 8,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ff3b30',
    borderRadius: 3,
  },
  permText: {
    color: '#888',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  permIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  permTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  permSubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  permButton: {
    backgroundColor: '#007AFF22',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
