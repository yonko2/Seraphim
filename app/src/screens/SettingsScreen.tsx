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
import { GarminHealthProvider } from '../services/health/GarminHealthProvider';

const SettingsScreen: React.FC = () => {
  const store = useStore();

  const [backendUrl, setBackendUrl] = useState(store.backendUrl);
  const [operatorTelegramId, setOperatorTelegramId] = useState(store.operatorTelegramId);
  const [sensitivity, setSensitivity] = useState(store.detectionSensitivity);
  const [isTesting, setIsTesting] = useState(false);

  // Garmin Connect state
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminProvider, setGarminProvider] = useState<GarminHealthProvider | null>(null);
  const [garminStatus, setGarminStatus] = useState<{ available: boolean; authenticated: boolean; email?: string } | null>(null);
  const [isGarminLoading, setIsGarminLoading] = useState(false);
  const [showGarminForm, setShowGarminForm] = useState(false);

  useEffect(() => {
    setBackendUrl(store.backendUrl);
    setOperatorTelegramId(store.operatorTelegramId);
    setSensitivity(store.detectionSensitivity);
  }, [store.backendUrl, store.operatorTelegramId, store.detectionSensitivity]);

  // Initialize Garmin provider and check status
  useEffect(() => {
    const initGarmin = async () => {
      const provider = new GarminHealthProvider(store.backendUrl);
      setGarminProvider(provider);
      
      try {
        const available = await provider.isAvailable();
        if (available) {
          // Check if already authenticated
          await provider.requestPermissions();
          setGarminStatus({
            available: true,
            authenticated: provider.getAuthenticated(),
            email: provider.getEmail() || undefined,
          });
        } else {
          setGarminStatus({ available: false, authenticated: false });
        }
      } catch (error) {
        console.warn('Failed to check Garmin status:', error);
        setGarminStatus({ available: false, authenticated: false });
      }
    };

    initGarmin();
  }, [store.backendUrl]);

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

  const handleGarminConnect = async () => {
    if (!garminProvider) return;
    
    setIsGarminLoading(true);
    try {
      const success = await garminProvider.authenticate(garminEmail, garminPassword);
      if (success) {
        setGarminStatus({
          available: true,
          authenticated: true,
          email: garminEmail,
        });
        setShowGarminForm(false);
        setGarminPassword('');
        Alert.alert('Success', 'Connected to Garmin Connect!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      Alert.alert('Connection Failed', message);
    } finally {
      setIsGarminLoading(false);
    }
  };

  const handleGarminDisconnect = async () => {
    if (!garminProvider) return;
    
    setIsGarminLoading(true);
    try {
      await garminProvider.disconnect();
      setGarminStatus({ available: true, authenticated: false });
      Alert.alert('Disconnected', 'Garmin Connect has been disconnected.');
    } catch (error) {
      Alert.alert('Error', 'Failed to disconnect from Garmin.');
    } finally {
      setIsGarminLoading(false);
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

        {/* Garmin Connect Section */}
        <Text style={styles.sectionHeader}>GARMIN CONNECT</Text>
        <View style={styles.card}>
          {garminStatus === null ? (
            <ActivityIndicator color="#007AFF" />
          ) : !garminStatus.available ? (
            <View>
              <Text style={styles.garminStatusText}>⚠️ Garmin service unavailable</Text>
              <Text style={styles.helperText}>Make sure the backend is running and garminconnect is installed</Text>
            </View>
          ) : garminStatus.authenticated ? (
            <View>
              <View style={styles.garminConnectedRow}>
                <Text style={styles.garminStatusText}>✅ Connected</Text>
                <Text style={styles.garminEmail}>{garminStatus.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.garminDisconnectButton}
                onPress={handleGarminDisconnect}
                disabled={isGarminLoading}
              >
                {isGarminLoading ? (
                  <ActivityIndicator color="#ff3b30" size="small" />
                ) : (
                  <Text style={styles.garminDisconnectText}>Disconnect</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : showGarminForm ? (
            <View>
              <Text style={styles.label}>Garmin Email</Text>
              <TextInput
                style={styles.input}
                value={garminEmail}
                onChangeText={setGarminEmail}
                placeholder="your@email.com"
                placeholderTextColor="#555"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={garminPassword}
                onChangeText={setGarminPassword}
                placeholder="Your password"
                placeholderTextColor="#555"
                secureTextEntry
              />
              <View style={styles.garminButtonRow}>
                <TouchableOpacity
                  style={styles.garminCancelButton}
                  onPress={() => setShowGarminForm(false)}
                  disabled={isGarminLoading}
                >
                  <Text style={styles.garminCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.garminConnectButton}
                  onPress={handleGarminConnect}
                  disabled={isGarminLoading || !garminEmail || !garminPassword}
                >
                  {isGarminLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.garminConnectText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.garminStatusText}>📊 Not connected</Text>
              <Text style={styles.helperText}>
                Connect your Garmin account to sync health data
              </Text>
              <TouchableOpacity
                style={styles.garminConnectButton}
                onPress={() => setShowGarminForm(true)}
              >
                <Text style={styles.garminConnectText}>Connect Garmin</Text>
              </TouchableOpacity>
            </View>
          )}
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
  // Garmin Connect styles
  garminStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  garminConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  garminEmail: {
    fontSize: 14,
    color: '#888',
  },
  garminConnectButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  garminConnectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  garminDisconnectButton: {
    backgroundColor: '#ff3b3022',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  garminDisconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff3b30',
  },
  garminButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  garminCancelButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  garminCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default SettingsScreen;
