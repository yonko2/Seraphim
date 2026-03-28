import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useStore } from '../store/useStore';
import { BackendClient } from '../services/api/BackendClient';

const SettingsScreen: React.FC = () => {
  const store = useStore();

  const [backendUrl, setBackendUrl] = useState(store.backendUrl);
  const [operatorTelegramId, setOperatorTelegramId] = useState(store.operatorTelegramId);
  const [sensitivity, setSensitivity] = useState(store.detectionSensitivity);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setBackendUrl(store.backendUrl);
    setOperatorTelegramId(store.operatorTelegramId);
    setSensitivity(store.detectionSensitivity);
  }, [store.backendUrl, store.operatorTelegramId, store.detectionSensitivity]);

  const handleSave = () => {
    store.updateSettings({
      backendUrl: backendUrl.trim() || 'http://localhost:8000',
      operatorTelegramId: operatorTelegramId.trim(),
      detectionSensitivity: sensitivity,
    });
    Alert.alert('Settings Saved', 'Your settings have been updated.');
  };

  const handleTestCall = async () => {
    if (!backendUrl.trim()) {
      Alert.alert('Error', 'Please enter a backend URL first.');
      return;
    }
    setIsTesting(true);
    try {
      const client = new BackendClient(backendUrl.trim());
      await client.post('/test-call', {});
      Alert.alert('Success', 'Test call completed successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Test Failed', message);
    } finally {
      setIsTesting(false);
    }
  };

  const sensitivityLabel =
    sensitivity <= 0.3 ? 'Low' : sensitivity <= 0.6 ? 'Medium' : sensitivity <= 0.85 ? 'High' : 'Maximum';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>⚙️ Settings</Text>

        {/* Connection Section */}
        <Text style={styles.sectionHeader}>CONNECTION</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            style={styles.input}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://localhost:8000"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Operator Telegram ID</Text>
          <TextInput
            style={styles.input}
            value={operatorTelegramId}
            onChangeText={setOperatorTelegramId}
            placeholder="Enter Telegram ID"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numeric"
          />
        </View>

        {/* Detection Section */}
        <Text style={styles.sectionHeader}>DETECTION</Text>
        <View style={styles.card}>
          <View style={styles.sensitivityHeader}>
            <Text style={styles.label}>Detection Sensitivity</Text>
            <Text style={styles.sensitivityValue}>
              {sensitivityLabel} ({(sensitivity * 100).toFixed(0)}%)
            </Text>
          </View>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${sensitivity * 100}%` }]} />
          </View>
          <View style={styles.sliderButtons}>
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.sliderBtn, Math.abs(sensitivity - val) < 0.05 && styles.sliderBtnActive]}
                onPress={() => setSensitivity(val)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sliderBtnText, Math.abs(sensitivity - val) < 0.05 && styles.sliderBtnTextActive]}>
                  {(val * 100).toFixed(0)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions Section */}
        <Text style={styles.sectionHeader}>ACTIONS</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestCall}
            disabled={isTesting}
            activeOpacity={0.7}
          >
            {isTesting ? (
              <ActivityIndicator color="#007AFF" size="small" />
            ) : (
              <Text style={styles.testButtonText}>📞 Test Call</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Send a test call to verify backend connection
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
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
    padding: 20,
    paddingTop: 60,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  sensitivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sensitivityValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sliderBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
  },
  sliderBtnActive: {
    backgroundColor: '#007AFF22',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  sliderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  sliderBtnTextActive: {
    color: '#007AFF',
  },
  testButton: {
    backgroundColor: '#007AFF22',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default SettingsScreen;
