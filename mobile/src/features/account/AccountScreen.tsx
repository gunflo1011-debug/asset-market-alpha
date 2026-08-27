import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  currentEmail: string | null | undefined;
  accountEmail: string;
  accountPassword: string;
  accountPasswordConfirm: string;
  message: string | null;
  onAccountEmailChange: (value: string) => void;
  onAccountPasswordChange: (value: string) => void;
  onAccountPasswordConfirmChange: (value: string) => void;
  onSaveEmail: () => void;
  onSavePassword: () => void;
  onSignOut: () => void;
  onDone: () => void;
};

export function AccountScreen(props: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
            <Text style={styles.pageTitle}>Settings</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={props.onDone}><Text style={styles.headerButtonText}>Done</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Email</Text>
          <Text style={styles.helper}>{props.currentEmail}</Text>
          <TextInput value={props.accountEmail} onChangeText={props.onAccountEmailChange} placeholder="New email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TouchableOpacity style={styles.secondaryButton} onPress={props.onSaveEmail}><Text style={styles.secondaryButtonText}>Change email</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Password</Text>
          <TextInput value={props.accountPassword} onChangeText={props.onAccountPasswordChange} placeholder="New password" secureTextEntry style={styles.input} />
          <TextInput value={props.accountPasswordConfirm} onChangeText={props.onAccountPasswordConfirmChange} placeholder="Confirm password" secureTextEntry style={styles.input} />
          <TouchableOpacity style={styles.primaryButton} onPress={props.onSavePassword}><Text style={styles.primaryButtonText}>Update password</Text></TouchableOpacity>
        </View>

        {props.message ? <Text style={styles.notice}>{props.message}</Text> : null}
        <TouchableOpacity style={styles.secondaryButton} onPress={props.onSignOut}><Text style={styles.secondaryButtonText}>Sign out</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  container: { padding: 20, paddingTop: 24, paddingBottom: 52, gap: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#667085', marginBottom: 4 },
  pageTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7, color: '#101828' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E7EAF0' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828' },
  helper: { fontSize: 14, lineHeight: 20, color: '#667085' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#101828', backgroundColor: '#FFFFFF' },
  primaryButton: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#344054', fontWeight: '700', fontSize: 15 },
  headerButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  headerButtonText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  notice: { fontSize: 14, lineHeight: 20, color: '#344054', backgroundColor: '#EEF4FF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D1E0FF' },
});