import { useState, type ReactNode } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function RulesDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const colors = useColors();
  return <View testID="rules-drawer" style={{ borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
    <Pressable onPress={() => setOpen((value) => !value)} testID="rules-drawer-toggle"
      accessibilityRole="button" accessibilityLabel="A few things to know"
      accessibilityState={{ expanded: open }}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 13, minHeight: 46 }}>
      <MaterialCommunityIcons name="book-open-variant" size={18} color={colors.primary} />
      <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Nunito_700Bold", fontSize: 14 }}>A few things to know</Text>
      <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
    </Pressable>
    {open && <View testID="rules-content" style={{ paddingHorizontal: 13, paddingBottom: 13 }}>{children}</View>}
  </View>;
}