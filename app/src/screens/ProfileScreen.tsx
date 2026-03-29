import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import TopNavbar from '../components/TopNavbar';
import { useStore } from '../store/useStore';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMMON_CONDITIONS = [
  'Asthma',
  'Diabetes (Type 1)',
  'Diabetes (Type 2)',
  'Hypertension',
  'Heart Disease',
  'Epilepsy',
  'COPD',
  'Arrhythmia',
  'Peanut Allergy',
  'Bee Sting Allergy',
];

export default function ProfileScreen() {
  const profile = useStore((s) => s.userProfile);
  const setUserProfile = useStore((s) => s.setUserProfile);

  const [conditionInput, setConditionInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');
  const [saved, setSaved] = useState(false);

  const addCondition = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || profile.conditions.includes(trimmed)) return;
    setUserProfile({ conditions: [...profile.conditions, trimmed] });
    setConditionInput('');
  };

  const removeCondition = (c: string) => {
    setUserProfile({ conditions: profile.conditions.filter((x) => x !== c) });
  };

  const addAllergy = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || profile.allergies.includes(trimmed)) return;
    setUserProfile({ allergies: [...profile.allergies, trimmed] });
    setAllergyInput('');
  };

  const removeAllergy = (a: string) => {
    setUserProfile({ allergies: profile.allergies.filter((x) => x !== a) });
  };

  const addMedication = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || profile.medications.includes(trimmed)) return;
    setUserProfile({ medications: [...profile.medications, trimmed] });
    setMedicationInput('');
  };

  const removeMedication = (m: string) => {
    setUserProfile({ medications: profile.medications.filter((x) => x !== m) });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <TopNavbar currentPage="Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Basic Information</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={profile.name}
            onChangeText={(t) => setUserProfile({ name: t })}
            placeholder="John Doe"
            placeholderTextColor="#475569"
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={profile.age}
            onChangeText={(t) => setUserProfile({ age: t })}
            placeholder="25"
            placeholderTextColor="#475569"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Blood Type</Text>
          <View style={styles.chipRow}>
            {BLOOD_TYPES.map((bt) => (
              <TouchableOpacity
                key={bt}
                style={[styles.chip, profile.bloodType === bt && styles.chipActive]}
                onPress={() => setUserProfile({ bloodType: profile.bloodType === bt ? '' : bt })}
              >
                <Text style={[styles.chipText, profile.bloodType === bt && styles.chipTextActive]}>{bt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Emergency Contact</Text>
          <TextInput
            style={styles.input}
            value={profile.emergencyContact}
            onChangeText={(t) => setUserProfile({ emergencyContact: t })}
            placeholder="+1 555-0100"
            placeholderTextColor="#475569"
            keyboardType="phone-pad"
          />
        </View>

        {/* Medical Conditions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏥 Medical Conditions</Text>
          <Text style={styles.hint}>Conditions are included in emergency alerts so responders know your history.</Text>

          <View style={styles.chipRow}>
            {COMMON_CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, profile.conditions.includes(c) && styles.chipActive]}
                onPress={() => profile.conditions.includes(c) ? removeCondition(c) : addCondition(c)}
              >
                <Text style={[styles.chipText, profile.conditions.includes(c) && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={conditionInput}
              onChangeText={setConditionInput}
              placeholder="Add custom condition…"
              placeholderTextColor="#475569"
              onSubmitEditing={() => addCondition(conditionInput)}
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => addCondition(conditionInput)}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {profile.conditions.filter((c) => !COMMON_CONDITIONS.includes(c)).map((c) => (
            <View key={c} style={styles.tag}>
              <Text style={styles.tagText}>{c}</Text>
              <TouchableOpacity onPress={() => removeCondition(c)}>
                <Text style={styles.tagRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Allergies */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Allergies</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={allergyInput}
              onChangeText={setAllergyInput}
              placeholder="e.g. Penicillin, Latex, Shellfish…"
              placeholderTextColor="#475569"
              onSubmitEditing={() => addAllergy(allergyInput)}
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => addAllergy(allergyInput)}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tagRow}>
            {profile.allergies.map((a) => (
              <View key={a} style={styles.tag}>
                <Text style={styles.tagText}>{a}</Text>
                <TouchableOpacity onPress={() => removeAllergy(a)}>
                  <Text style={styles.tagRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Medications */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💊 Current Medications</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={medicationInput}
              onChangeText={setMedicationInput}
              placeholder="e.g. Metformin 500mg, Aspirin…"
              placeholderTextColor="#475569"
              onSubmitEditing={() => addMedication(medicationInput)}
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => addMedication(medicationInput)}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tagRow}>
            {profile.medications.map((m) => (
              <View key={m} style={styles.tag}>
                <Text style={styles.tagText}>{m}</Text>
                <TouchableOpacity onPress={() => removeMedication(m)}>
                  <Text style={styles.tagRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={profile.notes}
            onChangeText={(t) => setUserProfile({ notes: t })}
            placeholder="Anything else responders should know…"
            placeholderTextColor="#475569"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Save indicator */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>{saved ? '✅ Profile Saved' : '💾  Save Profile'}</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  hint: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  label: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F4F6F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 90,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#F4F6F8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E6EEF6',
  },
  chipActive: {
    backgroundColor: '#2563EB20',
    borderColor: '#2563EB',
  },
  chipText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#2563EB',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    marginTop: 6,
  },
  tagText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  tagRemove: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  saveBtnText: {
    color: '#D5DDE8',
    fontSize: 16,
    fontWeight: '800',
  },
});
