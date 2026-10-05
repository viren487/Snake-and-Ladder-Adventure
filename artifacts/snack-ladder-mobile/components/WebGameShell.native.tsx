import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebGameShell } from '@/hooks/useWebGameShell';
import { useColors } from '@/hooks/useColors';

export default function WebGameShell() {
  const shell = useWebGameShell();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <View style={[styles.root, { backgroundColor: colors.background,
      paddingTop: insets.top, paddingBottom: insets.bottom,
      paddingLeft: insets.left, paddingRight: insets.right }]}>
      {shell.loadError || failed ? <View style={styles.message}>
        <Text style={[styles.text, { color: colors.foreground }]}>The game could not be opened. Your saved round has not been replaced.</Text>
        <Pressable testID="retry-mobile-game" onPress={() => {
          setFailed(false); setRevision((value) => value + 1); shell.retryLoad();
        }} style={[styles.retry, { backgroundColor: colors.secondary }]}><Text style={[styles.text, { color: colors.foreground }]}>Retry</Text></Pressable>
      </View> : shell.html ? <>
        {shell.saveError && <View style={[styles.warning, { backgroundColor: colors.destructive }]}>
          <Text style={[styles.text, { color: colors.destructiveForeground }]}>Could not save. Keep the app open.</Text>
          <Pressable onPress={shell.retrySave}><Text style={[styles.text, { color: colors.destructiveForeground }]}>Retry save</Text></Pressable>
        </View>}
        <WebView key={revision} testID="shared-web-game" style={[styles.game, { backgroundColor: colors.background }]}
          source={{ html: shell.html, baseUrl: shell.apiOrigin ? `${shell.apiOrigin}/` : 'https://snack-ladder.local/' }}
          originWhitelist={['https://snack-ladder.local', 'about:blank', ...(shell.apiOrigin ? [shell.apiOrigin] : [])]}
          javaScriptEnabled domStorageEnabled mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback bounces={false} setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) =>
            request.url === 'about:blank' ||
            request.url.startsWith('https://snack-ladder.local/') ||
            (!!shell.apiOrigin && (request.url === shell.apiOrigin || request.url.startsWith(`${shell.apiOrigin}/`)))}
          onMessage={(event) => {
            try { shell.persist(JSON.parse(event.nativeEvent.data)); }
            catch { /* Ignore non-storage messages from the embedded document. */ }
          }}
          onError={() => setFailed(true)}
          onContentProcessDidTerminate={() => setFailed(true)}
          onRenderProcessGone={() => setFailed(true)} />
      </> : <View style={styles.message}><ActivityIndicator color={colors.tint} />
        <Text style={[styles.text, { color: colors.foreground }]}>Loading your saved round…</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  game: { flex: 1 },
  message: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  text: { fontSize: 14, textAlign: 'center' },
  retry: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12 },
  warning: { padding: 10, gap: 6 },
});