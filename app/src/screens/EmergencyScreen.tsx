import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import EmergencyReportComponent from '../components/EmergencyReport';

type CallStatus = 'connecting' | 'in_call' | 'completed' | 'failed' | 'idle';

const STATUS_CONFIG: Record<CallStatus, { label: string; color: string; icon: string }> = {
  idle: { label: 'Waiting', color: '#94A3B8', icon: '⏳' },
  connecting: { label: 'Connecting…', color: '#ffd60a', icon: '📡' },
  in_call: { label: 'In Call', color: '#22C55E', icon: '📞' },
  completed: { label: 'Call Completed', color: '#38BDF8', icon: '✅' },
  failed: { label: 'Call Failed', color: '#FF5A4F', icon: '❌' },
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const EmergencyScreen: React.FC = () => {
  const navigation = useNavigation();
  const activeEmergency = useStore((s) => s.activeEmergency);
  const setActiveEmergency = useStore((s) => s.setActiveEmergency);

  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [elapsed, setElapsed] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Pulsing header animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate call status progression
  useEffect(() => {
    const t1 = setTimeout(() => setCallStatus('in_call'), 3000);
    return () => clearTimeout(t1);
  }, []);

  // Auto-navigate back when emergency is cleared
  useEffect(() => {
    if (!activeEmergency) {
      navigation.goBack();
    }
  }, [activeEmergency, navigation]);

  const handleCancel = () => {
    setActiveEmergency(null);
  };

  const headerOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const headerScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.02],
  });

  const statusConfig = STATUS_CONFIG[callStatus];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0000" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pulsing Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: headerOpacity, transform: [{ scale: headerScale }] },
          ]}
        >
          <Text style={styles.headerIcon}>🚨</Text>
          <Text style={styles.headerText}>EMERGENCY ACTIVE</Text>
        </Animated.View>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Elapsed</Text>
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        </View>

        {/* Call Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
          <View>
            <Text style={styles.statusLabel}>Call Status</Text>
            <Text style={[styles.statusValue, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <View style={[styles.statusIndicator, { backgroundColor: statusConfig.color }]} />
        </View>

        {/* Emergency Report */}
        <EmergencyReportComponent report={activeEmergency} />

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.7}>
          <Text style={styles.cancelButtonText}>Cancel Emergency</Text>
        </TouchableOpacity>

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
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 16,
    backgroundColor: '#2a0000',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF5A4F',
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF5A4F',
    letterSpacing: 3,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timer: {
    fontSize: 42,
    fontWeight: '200',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1726',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 14,
  },
  statusIcon: {
    fontSize: 28,
  },
  statusLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#182336',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF5A4F',
  },
  bottomSpacer: {
    height: 30,
  },
});

export default EmergencyScreen;
