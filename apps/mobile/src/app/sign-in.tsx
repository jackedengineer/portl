import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Mail } from 'lucide-react-native';
import { z } from 'zod';
import { authClient } from '../lib/auth';
import { loadProfile } from '../lib/api';
import { apiUrl, useAppStore } from '../lib/state';
import { colors as c } from '../design/theme';
import { HomeArt, PortlMark } from '../components/art';
import { Button, Card, Input, Row, Screen, Txt } from '../components/ui';
export default function SignIn() {
  const [email, setEmail] = useState(''),
    [otp, setOtp] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [resendAt, setResendAt] = useState(0),
    store = useAppStore(),
    { width } = useWindowDimensions();
  async function send() {
    setError('');
    setBusy(true);
    try {
      if (!apiUrl)
        throw new Error('A Portl server hasn’t been connected yet. Explore the demo below.');
      const valid = z.email().parse(email.trim().toLowerCase());
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: valid,
        type: 'sign-in',
      });
      if (result.error) throw new Error(result.error.message);
      setEmail(valid);
      setSent(true);
      setResendAt(Date.now() + 60000);
    } catch (e) {
      setError(e instanceof z.ZodError ? 'Enter a valid email address.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setError('');
    setBusy(true);
    try {
      const result = await authClient.signIn.emailOtp({ email, otp });
      if (result.error) throw new Error(result.error.message);
      store.setProfile(await loadProfile());
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Screen>
        <View
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 480,
            marginTop: width >= 700 ? 50 : 15,
            gap: 28,
          }}
        >
          <Row>
            <PortlMark size={35} />
            <Txt size={36} weight="bold" style={{ letterSpacing: -2 }}>
              portl
              <Txt size={36} color={c.coral}>
                .
              </Txt>
            </Txt>
          </Row>
          <View
            style={{
              backgroundColor: c.forest,
              borderRadius: 28,
              height: 235,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HomeArt size={285} />
          </View>
          <View>
            <Txt size={34} weight="semibold" style={{ letterSpacing: -1.3, lineHeight: 42 }}>
              {'Your community.\nA little closer.'}
            </Txt>
            <Txt color={c.muted} size={14} style={{ marginTop: 10 }}>
              From your front gate to your favourite shared space. Welcome to a simpler everyday.
            </Txt>
          </View>
          <Card style={{ gap: 17, padding: 23 }}>
            {sent ? (
              <>
                <Txt size={20} weight="semibold">
                  Check your inbox
                </Txt>
                <Txt size={13} color={c.muted}>
                  We sent a 6-digit code to {email}.
                </Txt>
                <Input
                  label="Verification code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  placeholder="000000"
                />
                <Button
                  title="Verify & continue"
                  loading={busy}
                  disabled={otp.length !== 6}
                  onPress={() => void verify()}
                />
                <Button
                  title="Resend code"
                  variant="outline"
                  onPress={() => {
                    if (Date.now() < resendAt)
                      setError('Please wait one minute before requesting another code.');
                    else void send();
                  }}
                />
                <Button
                  title="Use a different email"
                  variant="secondary"
                  onPress={() => {
                    setSent(false);
                    setOtp('');
                  }}
                />
              </>
            ) : (
              <>
                <Input
                  label="Your email address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <Button
                  title="Continue with email"
                  icon={Mail}
                  loading={busy}
                  onPress={() => void send()}
                />
                <Txt size={11} color={c.muted}>
                  We’ll email you a secure sign-in code. No password to remember.
                </Txt>
              </>
            )}
            {!!error && (
              <Txt size={12} color={c.danger}>
                {error}
              </Txt>
            )}
          </Card>
          {process.env.EXPO_PUBLIC_ENABLE_DEMO !== 'false' && (
            <Button
              title="Take a look around · Try the demo"
              icon={ArrowRight}
              variant="outline"
              onPress={() => {
                store.enterDemo();
                router.replace('/');
              }}
            />
          )}
          <Button
            title="Privacy & your data"
            variant="outline"
            compact
            onPress={() => router.push('/privacy')}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
