import { Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as c } from '../design/theme';
import { Button, Card, PageTitle, Screen, Txt } from '../components/ui';
export default function Privacy() {
  const contact = process.env.EXPO_PUBLIC_PRIVACY_EMAIL,
    operator = process.env.EXPO_PUBLIC_OPERATOR_NAME;
  const items = [
    {
      title: 'Who operates Portl',
      body: operator
        ? `${operator} operates this Portl instance. Your society administrator manages access, homes, notices and community records.`
        : 'This is a development preview. The operator’s identity and privacy contact must be configured before real residents are invited.',
    },
    {
      title: 'What we use',
      body: 'Your name and email identify your account. Society memberships and flat assignments control access. Visitor names, arrival details, decisions, bookings and notification tokens support the features you use. We do not collect Aadhaar, contact lists, background location or advertising identifiers.',
    },
    {
      title: 'Who can see it',
      body: 'Residents see their household visits. Assigned guards and society administrators can access movement records for their own society. Service contacts are visible within that society. Only share information you are authorised to provide.',
    },
    {
      title: 'Where data goes',
      body: 'The planned hosting uses Railway in Singapore and Neon Postgres in the region selected by the operator. Email is processed by the configured mail provider. Optional push delivery uses Expo, Apple and Google. Overseas hosting does not by itself prevent app-store distribution.',
    },
    {
      title: 'Retention and deletion',
      body: 'The maintenance job removes completed visitor records and expired guest passes after 90 days, notifications after 30 days, and audit events after 365 days. Open visits remain until resolved. Account deletion removes the user profile, sessions and memberships, and cancels future bookings. Requests are intended to be processed within 30 days. Hosting backups follow the operator’s provider settings.',
    },
    {
      title: 'Your choices',
      body: 'Notifications are optional. You can request account deletion in Account → Delete my account. For access, correction, grievances or deletion without the app, contact the operator using the address below. Society rules and retention must be reviewed before a real pilot.',
    },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Screen>
        <PageTitle
          eyebrow="Privacy at Portl"
          title="Your home. Your information."
          subtitle="Clear choices, with less data collected."
        />
        {items.map((i) => (
          <Card key={i.title}>
            <Txt size={18} weight="semibold">
              {i.title}
            </Txt>
            <Txt size={14} color={c.muted} style={{ marginTop: 10, lineHeight: 24 }}>
              {i.body}
            </Txt>
          </Card>
        ))}
        {contact && (
          <Button
            title={`Contact ${contact}`}
            onPress={() => void Linking.openURL(`mailto:${contact}`)}
          />
        )}
        <Button
          title="Back"
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
        />
      </Screen>
    </SafeAreaView>
  );
}
