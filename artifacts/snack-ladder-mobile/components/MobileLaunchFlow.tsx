import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export type MobilePlayMode = 'bot' | 'pass' | 'online';

export type MobileLaunchSelection = {
  name: string;
  playMode: MobilePlayMode;
};

type MobileLaunchFlowProps = {
  initialName: string;
  initialMode: MobilePlayMode | null;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onlineAvailable: boolean;
  isStarting: boolean;
  startError: string | null;
  onStart: (selection: MobileLaunchSelection) => Promise<void>;
};

type ModeOption = {
  id: MobilePlayMode;
  title: string;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const MODES: ModeOption[] = [
  {
    id: 'bot',
    title: 'Vs. Mr. Bot',
    detail: 'A clever solo rival is waiting.',
    icon: 'robot-happy-outline',
  },
  {
    id: 'pass',
    title: 'Pass & Play',
    detail: 'Take turns together on one device.',
    icon: 'account-group-outline',
  },
  {
    id: 'online',
    title: 'Online room',
    detail: 'Race friends in a shared room.',
    icon: 'web',
  },
];

export default function MobileLaunchFlow({
  initialName,
  initialMode,
  isLoading,
  loadError,
  onRetry,
  onlineAvailable,
  isStarting,
  startError,
  onStart,
}: MobileLaunchFlowProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName.slice(0, 24));
  const [step, setStep] = useState<'profile' | 'mode'>('profile');
  const [playMode, setPlayMode] = useState<MobilePlayMode | null>(initialMode);
  const [nameError, setNameError] = useState('');
  const normalizedName = name.trim();

  useEffect(() => {
    if (isLoading) return;
    setName(initialName.slice(0, 24));
    setPlayMode(initialMode);
  }, [initialName, initialMode, isLoading]);

  const goToModes = () => {
    if (!normalizedName) {
      setNameError('Add a name for your player first.');
      return;
    }
    setNameError('');
    setStep('mode');
  };

  const startAdventure = async () => {
    if (!playMode || (playMode === 'online' && !onlineAvailable) || !normalizedName) return;
    try {
      await onStart({ name: normalizedName, playMode });
    } catch {
      // The owning screen surfaces the failure through startError.
    }
  };

  const surface = {
    backgroundColor: colors.background,
  };
  const cardSurface = {
    backgroundColor: colors.card,
    borderColor: colors.border,
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered, surface]}>
        <View style={[styles.loadingMark, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Image source={require('../assets/images/icon.png')} style={styles.loadingImage} />
        </View>
        <Text style={[styles.brand, { color: colors.foreground }]}>SNAKE & LADDER</Text>
        <Text style={[styles.loadingCaption, { color: colors.mutedForeground }]}>Setting up the board…</Text>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, styles.centered, surface, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.errorIcon, { backgroundColor: colors.muted }]}>
          <MaterialCommunityIcons name="map-marker-question-outline" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>The board is taking a break</Text>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{loadError}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading"
          onPress={onRetry}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
        >
          <MaterialCommunityIcons name="refresh" size={19} color={colors.primaryForeground} />
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.root, surface]} behavior="padding" keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 14) + 10, paddingBottom: Math.max(insets.bottom, 18) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <View style={styles.brandLockup}>
            <View style={[styles.brandMark, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="ladder" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.brand, { color: colors.foreground }]}>SNAKE & LADDER</Text>
              <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>ADVENTURE BOARD</Text>
            </View>
          </View>
          <View style={[styles.stepPill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.stepPillText, { color: colors.mutedForeground }]}>{step === 'profile' ? '01 / 02' : '02 / 02'}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroArt}>
            <View style={[styles.artHalo, { backgroundColor: colors.secondary }]} />
              <View style={[styles.tile, styles.tileOne, { backgroundColor: colors.boardGreen, borderColor: colors.boardCream }]}>
              <Text style={[styles.tileNumber, { color: colors.boardInk }]}>12</Text>
            </View>
              <View style={[styles.tile, styles.tileTwo, { backgroundColor: colors.boardBlue, borderColor: colors.boardCream }]}>
              <Text style={[styles.tileNumber, { color: colors.boardInk }]}>18</Text>
            </View>
            <Image source={require('../assets/images/icon.png')} style={styles.pandaArt} resizeMode="contain" />
            <View style={[styles.crownBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <MaterialCommunityIcons name="crown" size={17} color={colors.primaryForeground} />
            </View>
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {step === 'profile' ? 'Ready, player?' : 'Pick your race'}
          </Text>
          <Text style={[styles.heroCopy, { color: colors.mutedForeground }]}>
            {step === 'profile'
              ? 'Meet your panda guide. First, what should we call you?'
              : `Looking good, ${normalizedName || 'player'}. How are we playing?`}
          </Text>
        </View>

        {step === 'profile' ? (
          <View style={[styles.profilePanel, cardSurface]}>
            <Text style={[styles.label, { color: colors.foreground }]}>PLAYER NAME</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: nameError ? colors.destructive : colors.border }]}>
              <MaterialCommunityIcons name="account-outline" size={21} color={colors.mutedForeground} />
              <TextInput
                accessibilityLabel="Player name"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={24}
                onChangeText={(value) => {
                  setName(value.slice(0, 24));
                  if (nameError) setNameError('');
                }}
                onSubmitEditing={goToModes}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="go"
                selectionColor={colors.primary}
                style={[styles.input, { color: colors.foreground }]}
                value={name}
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{name.length}/24</Text>
            </View>
            {nameError ? <Text accessibilityRole="alert" style={[styles.inlineError, { color: colors.destructive }]}>{nameError}</Text> : null}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Your name appears on the board.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={goToModes}
              style={({ pressed }) => [styles.primaryButton, styles.continueButton, { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 }]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Choose a game</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.modeArea}>
            {MODES.map((mode) => {
              const disabled = mode.id === 'online' && !onlineAvailable;
              const selected = playMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  accessibilityLabel={`${mode.title}. ${disabled ? 'Unavailable' : mode.detail}`}
                  disabled={disabled || isStarting}
                  onPress={() => setPlayMode(mode.id)}
                  style={({ pressed }) => [
                    styles.modeCard,
                    { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.48 : pressed ? 0.84 : 1 },
                    selected && { backgroundColor: colors.secondary },
                  ]}
                >
                  <View style={[styles.modeIconBox, { backgroundColor: selected ? colors.primary : colors.muted }]}>
                    <MaterialCommunityIcons name={mode.icon} size={22} color={selected ? colors.primaryForeground : colors.foreground} />
                  </View>
                  <View style={styles.modeText}>
                    <View style={styles.modeTitleRow}>
                      <Text style={[styles.modeTitle, { color: colors.foreground }]}>{mode.title}</Text>
                      {mode.id === 'online' && !onlineAvailable ? (
                        <Text style={[styles.unavailableTag, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>UNAVAILABLE</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.modeDetail, { color: colors.mutedForeground }]}>{mode.detail}</Text>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.mutedForeground }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                </Pressable>
              );
            })}

            {startError ? (
              <View style={[styles.startErrorBox, { backgroundColor: colors.muted, borderColor: colors.destructive }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={19} color={colors.destructive} />
                <Text accessibilityRole="alert" style={[styles.startErrorText, { color: colors.foreground }]}>{startError}</Text>
              </View>
            ) : null}

            <View style={styles.modeActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back to player name"
                disabled={isStarting}
                onPress={() => setStep('profile')}
                style={({ pressed }) => [styles.backButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
              >
                <MaterialCommunityIcons name="arrow-left" size={19} color={colors.foreground} />
                <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start adventure"
                accessibilityState={{ disabled: !playMode || (playMode === 'online' && !onlineAvailable) || isStarting }}
                disabled={!playMode || (playMode === 'online' && !onlineAvailable) || isStarting}
                onPress={startAdventure}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.startButton,
                  { backgroundColor: colors.primary, opacity: !playMode || isStarting ? 0.54 : pressed ? 0.84 : 1 },
                ]}
              >
                {isStarting ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <MaterialCommunityIcons name="flag-checkered" size={19} color={colors.primaryForeground} />
                )}
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{isStarting ? 'Starting…' : 'Start adventure'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <View style={[styles.footerRule, { backgroundColor: colors.border }]} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>ROLL • CLIMB • RACE TO THE CROWN</Text>
          <View style={[styles.footerRule, { backgroundColor: colors.border }]} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22 },
  loadingMark: { width: 150, height: 150, borderRadius: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  loadingImage: { width: 140, height: 140 },
  brand: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, letterSpacing: 1.1 },
  loadingCaption: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, marginTop: 8 },
  loader: { marginTop: 24 },
  errorIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  errorTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 23, textAlign: 'center' },
  errorText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, marginBottom: 22 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandSub: { fontFamily: 'Nunito_700Bold', fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  stepPill: { borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 },
  stepPillText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, letterSpacing: 1.1 },
  hero: { alignItems: 'center', marginTop: 11, marginBottom: 15 },
  heroArt: { width: 205, height: 176, alignItems: 'center', justifyContent: 'center' },
  artHalo: { position: 'absolute', width: 148, height: 148, borderRadius: 74, opacity: 0.75 },
  pandaArt: { width: 170, height: 160, zIndex: 1 },
  tile: { position: 'absolute', width: 40, height: 40, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  tileOne: { left: 9, top: 26, transform: [{ rotate: '-12deg' }] },
  tileTwo: { right: 8, bottom: 17, transform: [{ rotate: '10deg' }] },
  tileNumber: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  crownBadge: { position: 'absolute', right: 28, top: 13, zIndex: 3, width: 33, height: 33, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 29, lineHeight: 36, textAlign: 'center', marginTop: 1 },
  heroCopy: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300, marginTop: 4 },
  profilePanel: { borderWidth: 1, borderRadius: 22, padding: 16, marginTop: 2 },
  label: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  inputWrap: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 16, paddingVertical: 11 },
  charCount: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  inlineError: { fontFamily: 'Nunito_700Bold', fontSize: 12, marginTop: 6 },
  hint: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, marginTop: 8 },
  primaryButton: { minHeight: 52, paddingHorizontal: 17, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15 },
  continueButton: { marginTop: 16 },
  modeArea: { gap: 10, marginTop: 2 },
  modeCard: { borderWidth: 1, borderRadius: 17, minHeight: 74, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  modeIconBox: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modeText: { flex: 1 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  modeTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15 },
  modeDetail: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, marginTop: 2 },
  unavailableTag: { fontFamily: 'Nunito_800ExtraBold', fontSize: 8, letterSpacing: 0.7, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  radioOuter: { width: 21, height: 21, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 11, height: 11, borderRadius: 6 },
  startErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderWidth: 1, borderRadius: 12 },
  startErrorText: { flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 12, lineHeight: 17 },
  modeActions: { flexDirection: 'row', gap: 9, marginTop: 2 },
  backButton: { minHeight: 52, minWidth: 91, paddingHorizontal: 13, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 14 },
  startButton: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 9, justifyContent: 'center', marginTop: 'auto', paddingTop: 20 },
  footerRule: { height: 1, flex: 1, opacity: 0.65 },
  footerText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 8, letterSpacing: 1 },
});
