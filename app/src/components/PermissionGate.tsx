import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

interface Props {
  permissions: string[];
  children: ReactNode;
}

export default function PermissionGate({ permissions, children }: Props) {
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const checkLocation = useCallback(async () => {
    if (permissions.includes('location')) {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationStatus(status);
    }
  }, [permissions]);

  useEffect(() => {
    checkLocation().finally(() => setChecking(false));
  }, [checkLocation]);

  const needsCamera = permissions.includes('camera') && !cameraPermission?.granted;
  const needsLocation = permissions.includes('location') && locationStatus !== Location.PermissionStatus.GRANTED;

  const allGranted = !needsCamera && !needsLocation;

  const handleGrantPermissions = async () => {
    if (needsCamera) {
      const result = await requestCamera();
      if (!result.granted && !result.canAskAgain) {
        Linking.openSettings();
        return;
      }
    }
    if (needsLocation) {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status);
      if (status !== Location.PermissionStatus.GRANTED && !canAskAgain) {
        Linking.openSettings();
        return;
      }
    }
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Checking permissions…</Text>
      </View>
    );
  }

  if (allGranted) {
    return <>{children}</>;
  }

  const missing: string[] = [];
  if (needsCamera) missing.push('Camera');
  if (needsLocation) missing.push('Location');

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Permissions Required</Text>
      <Text style={styles.message}>
        Seraphim needs access to the following to work properly:
      </Text>

      {missing.map((perm) => (
        <View key={perm} style={styles.permRow}>
          <Text style={styles.permBullet}>•</Text>
          <Text style={styles.permText}>{perm}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.grantButton} onPress={handleGrantPermissions}>
        <Text style={styles.grantText}>Grant Permissions</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permBullet: {
    color: '#ff3b30',
    fontSize: 18,
    marginRight: 8,
  },
  permText: {
    color: '#ffffff',
    fontSize: 16,
  },
  grantButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  grantText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
