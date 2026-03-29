import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { EmergencyType } from '../types';

interface FirstAidGuideProps {
  emergencyType: EmergencyType;
  steps: string[];
  isLoading: boolean;
}

const EMERGENCY_CONFIG: Record<EmergencyType, { icon: string; label: string; color: string }> = {
  fall: { icon: '🤕', label: 'Fall Injury', color: '#ff9500' },
  fire: { icon: '🔥', label: 'Fire Emergency', color: '#ff3b30' },
  flood: { icon: '🌊', label: 'Flood Emergency', color: '#007AFF' },
  earthquake: { icon: '🌎', label: 'Earthquake', color: '#F59E0B' },
  car_crash: { icon: '🚗', label: 'Vehicle Accident', color: '#ff9500' },
  medical: { icon: '🏥', label: 'Medical Emergency', color: '#ff3b30' },
  violence: { icon: '⚠️', label: 'Violence / Threat', color: '#ff3b30' },
  unknown: { icon: '❓', label: 'Unknown Emergency', color: '#ffd60a' },
  none: { icon: '✅', label: 'No Emergency', color: '#30d158' },
};

function StepCard({
  index,
  text,
  completed,
  onToggle,
}: {
  index: number;
  text: string;
  completed: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.stepCard, completed && styles.stepCardCompleted]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.stepLeft}>
        <TouchableOpacity
          style={[styles.checkbox, completed && styles.checkboxDone]}
          onPress={onToggle}
          activeOpacity={0.6}
        >
          {completed && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.stepNumber}>Step {index + 1}</Text>
      </View>
      <Text style={[styles.stepText, completed && styles.stepTextCompleted]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

export default function FirstAidGuide({
  emergencyType,
  steps,
  isLoading,
}: FirstAidGuideProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const config = EMERGENCY_CONFIG[emergencyType] || EMERGENCY_CONFIG.unknown;

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const completedCount = completedSteps.size;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? completedCount / totalSteps : 0;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{config.icon}</Text>
          <View>
            <Text style={styles.title}>First Aid Guide</Text>
            <Text style={[styles.emergencyLabel, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>
        {totalSteps > 0 && !isLoading && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {completedCount}/{totalSteps}
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      {totalSteps > 0 && !isLoading && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: progress === 1 ? '#30d158' : '#007AFF',
              },
            ]}
          />
        </View>
      )}

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Generating guidance…</Text>
          <Text style={styles.loadingSubtext}>
            AI is analyzing the situation and preparing first aid steps
          </Text>
        </View>
      )}

      {/* Steps */}
      {!isLoading && steps.length > 0 && (
        <View style={styles.stepsContainer}>
          {steps.map((step, idx) => (
            <StepCard
              key={idx}
              index={idx}
              text={step}
              completed={completedSteps.has(idx)}
              onToggle={() => toggleStep(idx)}
            />
          ))}
        </View>
      )}

      {/* Empty State */}
      {!isLoading && steps.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={styles.emptyText}>
            No first aid steps available yet.
          </Text>
        </View>
      )}

      {/* Completed Banner */}
      {!isLoading && totalSteps > 0 && completedCount === totalSteps && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>
            ✅ All steps completed — wait for professional help to arrive
          </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  emergencyLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  progressBadge: {
    backgroundColor: '#007AFF22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  progressText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  stepsContainer: {
    gap: 8,
  },
  stepCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 14,
  },
  stepCardCompleted: {
    opacity: 0.6,
  },
  stepLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#30d158',
    borderColor: '#30d158',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  stepNumber: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 32,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
  },
  completedBanner: {
    backgroundColor: '#30d15822',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  completedText: {
    color: '#30d158',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
