import { Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, PageTitle, Screen, Txt } from '../components/ui';
import { colors as c } from '../design/theme';
export default function DeleteAccount() {
  const contact = process.env.EXPO_PUBLIC_PRIVACY_EMAIL;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Screen>
        <PageTitle
          title="Delete your Portl account"
          subtitle="You can request deletion in the app or contact the operator."
        />
        <Txt>
          In Portl, open Account → Delete my account and confirm. Your profile, sign-in sessions,
          memberships and future bookings will be removed. Society movement and audit records may
          remain until their retention periods end. Requests are intended to be processed within 30
          days.
        </Txt>
        {contact ? (
          <Button
            title="Request deletion by email"
            onPress={() =>
              void Linking.openURL(`mailto:${contact}?subject=Portl%20account%20deletion`)
            }
          />
        ) : (
          <Txt color={c.muted}>
            This development preview has no operator contact configured and is not open for real
            registrations.
          </Txt>
        )}
        <Button title="Open Portl" onPress={() => router.replace('/sign-in')} />
        <Button
          title="Read privacy details"
          variant="outline"
          onPress={() => router.push('/privacy')}
        />
      </Screen>
    </SafeAreaView>
  );
}
