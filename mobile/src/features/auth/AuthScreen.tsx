import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';

type Props = {
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  busy: boolean;
  message: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticate: (mode: 'signin' | 'signup') => void;
  onSendPasswordReset: () => void;
  onFinishPasswordRecovery: () => void;
};

export function AuthScreen(props: Props) {
  const {
    mode,
    email,
    password,
    confirmPassword,
    busy,
    message,
    onEmailChange,
    onPasswordChange,
    onConfirmPasswordChange,
    onModeChange,
    onAuthenticate,
    onSendPasswordReset,
    onFinishPasswordRecovery,
  } = props;

  if (mode === 'recovery') {
    const disabled = busy || password.length < 8 || password !== confirmPassword;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.brand}>Things</Text>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>Use at least 8 characters.</Text>
          <View style={styles.card}>
            <TextInput value={password} onChangeText={onPasswordChange} placeholder="New password" secureTextEntry style={styles.input} />
            <TextInput value={confirmPassword} onChangeText={onConfirmPasswordChange} placeholder="Confirm password" secureTextEntry style={styles.input} />
            <TouchableOpacity style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onFinishPasswordRecovery}>
              <Text style={styles.primaryButtonText}>{busy ? 'Updating…' : 'Update password'}</Text>
            </TouchableOpacity>
            {message ? <Text style={styles.notice}>{message}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Everything you own, in one place';
  const subtitle = mode === 'signup'
    ? 'Start a private inventory you control.'
    : mode === 'forgot'
      ? 'We’ll send a secure reset link to your email.'
      : 'Sign in to see and manage your private inventory.';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.authContainer}>
        <Text style={styles.brand}>Things</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.card}>
          <TextInput value={email} onChangeText={onEmailChange} placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} />
          {mode !== 'forgot' ? <TextInput value={password} onChangeText={onPasswordChange} placeholder="Password" secureTextEntry autoComplete="password" style={styles.input} /> : null}

          {mode === 'signin' ? (
            <>
              <TouchableOpacity style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => onAuthenticate('signin')}>
                <Text style={styles.primaryButtonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={() => onModeChange('forgot')}><Text style={styles.linkCentered}>Forgot password?</Text></TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.secondaryButton} onPress={() => onModeChange('signup')}><Text style={styles.secondaryButtonText}>Create account</Text></TouchableOpacity>
            </>
          ) : null}

          {mode === 'signup' ? (
            <>
              <Text style={styles.helper}>We’ll email you a confirmation link before your first sign-in.</Text>
              <TouchableOpacity style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => onAuthenticate('signup')}>
                <Text style={styles.primaryButtonText}>{busy ? 'Creating account…' : 'Create account'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => onModeChange('signin')}><Text style={styles.secondaryButtonText}>Back to sign in</Text></TouchableOpacity>
            </>
          ) : null}

          {mode === 'forgot' ? (
            <>
              <TouchableOpacity style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={onSendPasswordReset}>
                <Text style={styles.primaryButtonText}>{busy ? 'Sending…' : 'Send reset link'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => onModeChange('signin')}><Text style={styles.secondaryButtonText}>Back to sign in</Text></TouchableOpacity>
            </>
          ) : null}

          {message ? <Text style={styles.notice}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  container: { padding: 24, paddingTop: 48, gap: 18 },
  authContainer: { padding: 24, paddingTop: 64, gap: 18 },
  brand: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: '#101828' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8, color: '#101828' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#667085', marginTop: 3 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E7EAF0' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#101828', backgroundColor: '#FFFFFF' },
  primaryButton: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#344054', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },
  helper: { fontSize: 14, lineHeight: 20, color: '#667085' },
  notice: { fontSize: 14, lineHeight: 20, color: '#344054', backgroundColor: '#EEF4FF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D1E0FF' },
  linkCentered: { fontSize: 14, fontWeight: '700', color: '#344054', textAlign: 'center', paddingVertical: 6 },
  divider: { height: 1, backgroundColor: '#EAECF0', marginVertical: 2 },
});