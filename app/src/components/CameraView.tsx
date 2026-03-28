import React, { useRef } from 'react';
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

interface CameraViewProps {
  onCapture?: (base64: string) => void;
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
  isAnalyzing = false,
  classification = null,
}: CameraViewProps) {
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const isEmergency =
    classification != null &&
    classification.type !== 'none' &&
    classification.severity !== 'none';

  const handleCapture = async () => {
    if (!cameraRef.current || isAnalyzing) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });
      if (photo?.base64 && onCapture) {
        onCapture(photo.base64);
      }
    } catch {
      // silently handle camera errors
    }
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#007AFF" />
        <Text style={styles.permText}>Checking camera permissions…</Text>
      </View>
    );
  }

  // Permission denied
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎥 Live Camera</Text>
        {isAnalyzing && (
          <View style={styles.analyzingBadge}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.analyzingText}>Analyzing…</Text>
          </View>
        )}
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraWrapper}>
        <ExpoCameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        />

        {/* Classification Overlay */}
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

      {/* Capture Button */}
      <TouchableOpacity
        style={[styles.captureButton, isAnalyzing && styles.captureDisabled]}
        onPress={handleCapture}
        activeOpacity={0.7}
        disabled={isAnalyzing}
      >
        <View style={styles.captureOuter}>
          <View style={[styles.captureInner, isAnalyzing && styles.captureInnerDisabled]} />
        </View>
      </TouchableOpacity>
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
  cameraWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
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
  captureButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  captureDisabled: {
    opacity: 0.4,
  },
  captureOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#ffffff44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
  },
  captureInnerDisabled: {
    backgroundColor: '#555',
  },
  // Permission states
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
