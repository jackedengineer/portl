import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ArrowRight, Check, CheckCircle2, Search, X, type LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as c, fonts as f, displayFont } from '../design/theme';
import { useToast } from '../lib/state';

export function Txt({
  children,
  size = 14,
  color = c.ink,
  weight = 'regular',
  display = false,
  style,
  ...props
}: {
  children?: ReactNode;
  size?: number;
  color?: string;
  weight?: keyof typeof f;
  display?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: display ? displayFont : f[weight],
          fontSize: size,
          color,
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}
export function Card({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  icon: Icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  compact = false,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'coral';
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color =
    variant === 'primary' || variant === 'coral'
      ? '#FFFFFF'
      : variant === 'danger'
        ? c.danger
        : c.forest;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 44 : 50,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          backgroundColor:
            variant === 'primary'
              ? c.forest
              : variant === 'coral'
                ? c.coral
                : variant === 'secondary'
                  ? c.sage
                  : variant === 'danger'
                    ? c.dangerSoft
                    : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: c.line,
          opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : Icon ? (
        <Icon size={18} color={color} strokeWidth={1.8} />
      ) : null}
      <Txt weight="semibold" color={color} size={13}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  onPress,
  label,
  badge = false,
  color = c.ink,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  badge?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.sage : 'transparent',
      })}
    >
      <Icon color={color} size={22} strokeWidth={1.7} />
      {badge && (
        <View
          style={{
            position: 'absolute',
            right: 10,
            top: 8,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: c.coral,
            borderWidth: 2,
            borderColor: c.background,
          }}
        />
      )}
    </Pressable>
  );
}
export function Tag({
  children,
  tone = 'sage',
}: {
  children: ReactNode;
  tone?: 'sage' | 'peach' | 'blue' | 'muted' | 'danger';
}) {
  const bg = { sage: c.sage, peach: c.peach, blue: c.blue, muted: '#F0F1ED', danger: c.dangerSoft }[
    tone
  ];
  const ink = {
    sage: c.forest,
    peach: '#A15D42',
    blue: c.blueInk,
    muted: c.muted,
    danger: c.danger,
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: 7,
        paddingHorizontal: 9,
        paddingVertical: 5,
      }}
    >
      <Txt size={10} weight="semibold" color={ink}>
        {children}
      </Txt>
    </View>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <Txt size={21} display style={{ letterSpacing: -0.3 }}>
        {title}
      </Txt>
      {!!action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 40, justifyContent: 'center' }}
        >
          <Row style={{ gap: 5 }}>
            <Txt size={12} weight="medium" color={c.forest}>
              {action}
            </Txt>
            <ArrowRight size={14} color={c.forest} />
          </Row>
        </Pressable>
      )}
    </Row>
  );
}
export function Screen({
  children,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.forest} />
        ) : undefined
      }
      contentContainerStyle={{
        padding: 22,
        paddingTop: 22,
        paddingBottom: 34,
        width: '100%',
        maxWidth: 1160,
        alignSelf: 'center',
        gap: 26,
      }}
    >
      {children}
    </ScrollView>
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && (
          <Txt
            size={10}
            color={c.muted}
            weight="semibold"
            style={{ letterSpacing: 1.5, marginBottom: 8 }}
          >
            {eyebrow.toUpperCase()}
          </Txt>
        )}
        <Txt size={30} display style={{ letterSpacing: -0.7, lineHeight: 38 }}>
          {title}
        </Txt>
        {!!subtitle && (
          <Txt color={c.muted} size={13} style={{ marginTop: 5 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {action}
    </Row>
  );
}
export function Input({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ gap: 7 }}>
      {!!label && (
        <Txt size={12} weight="semibold">
          {label}
        </Txt>
      )}
      <TextInput
        placeholderTextColor="#99A29A"
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        style={[
          {
            minHeight: 52,
            paddingHorizontal: 15,
            paddingVertical: 13,
            backgroundColor: c.background,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: error ? c.danger : c.line,
            fontFamily: f.regular,
            fontSize: 14,
            color: c.ink,
            ...(props.multiline ? { minHeight: 110, textAlignVertical: 'top' as const } : {}),
          },
          style,
        ]}
      />
      {!!error && (
        <Txt size={11} color={c.danger}>
          {error}
        </Txt>
      )}
    </View>
  );
}
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Row
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 14,
        paddingHorizontal: 14,
        gap: 10,
      }}
    >
      <Search size={18} color={c.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        value={value}
        onChangeText={onChangeText}
        style={{ flex: 1, minHeight: 50, fontFamily: f.regular, color: c.ink, fontSize: 13 }}
      />
    </Row>
  );
}
export function Choices<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          style={{
            minHeight: 44,
            paddingHorizontal: 15,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: value === o.value ? c.forest : c.line,
            backgroundColor: value === o.value ? c.forest : c.surface,
            justifyContent: 'center',
          }}
        >
          <Txt
            size={12}
            weight={value === o.value ? 'semibold' : 'medium'}
            color={value === o.value ? '#FFFFFF' : c.muted}
          >
            {o.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function Empty({
  title,
  description,
  icon: Icon = CheckCircle2,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <Card style={{ padding: 32, alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 22,
          backgroundColor: c.sage,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={26} color={c.forest} strokeWidth={1.4} />
      </View>
      <Txt size={17} weight="semibold">
        {title}
      </Txt>
      <Txt color={c.muted} size={13} style={{ textAlign: 'center', maxWidth: 310 }}>
        {description}
      </Txt>
      {action}
    </Card>
  );
}
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const toast = useToast();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#15372B77',
            justifyContent: width > 700 ? 'center' : 'flex-end',
            alignItems: 'center',
          }}
        >
          <Pressable
            accessibilityLabel="Close dialog"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom']}
            style={{
              width: '100%',
              maxWidth: 540,
              maxHeight: '92%',
              backgroundColor: c.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderBottomLeftRadius: width > 700 ? 28 : 0,
              borderBottomRightRadius: width > 700 ? 28 : 0,
            }}
          >
            <Row
              style={{
                paddingHorizontal: 24,
                paddingTop: 20,
                paddingBottom: 10,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Txt size={24} display style={{ letterSpacing: -0.4 }}>
                  {title}
                </Txt>
                {!!subtitle && (
                  <Txt size={12} color={c.muted} style={{ marginTop: 5 }}>
                    {subtitle}
                  </Txt>
                )}
              </View>
              <IconButton icon={X} onPress={onClose} label="Close" />
            </Row>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 24, paddingTop: 15, gap: 18 }}
            >
              {children}
              {!!toast.message && toast.kind === 'error' && (
                <Txt color={c.danger} size={12}>
                  {toast.message}
                </Txt>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Toast() {
  const { message, kind, clear } = useToast();
  useEffect(() => {
    if (message) {
      const timer = setTimeout(clear, 4500);
      return () => clearTimeout(timer);
    }
  }, [message, clear]);
  if (!message) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', bottom: 90, left: 20, right: 20, alignItems: 'center' }}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={clear}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 16,
          borderRadius: 16,
          backgroundColor: kind === 'error' ? c.danger : c.forest,
          maxWidth: 500,
        }}
      >
        <Check size={18} color="white" />
        <Txt size={13} color="white" style={{ flexShrink: 1 }}>
          {message}
        </Txt>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: {
    borderRadius: 20,
    borderColor: c.line,
    borderWidth: 1,
    backgroundColor: c.surface,
    padding: 20,
  },
});
