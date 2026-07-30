import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

import { useVaultSession } from "../vault-session-context";

type NavigationTab = "home" | "add" | "records" | "settings";
type NavigationItem = NavigationTab | "lock";

const items: {
  activeIcon: keyof typeof Ionicons.glyphMap;
  href?: Href;
  icon: keyof typeof Ionicons.glyphMap;
  id: NavigationItem;
  label: string;
}[] = [
  {
    activeIcon: "home",
    href: "/vault",
    icon: "home-outline",
    id: "home",
    label: "Home",
  },
  {
    activeIcon: "add-circle",
    href: "/vault/add",
    icon: "add-circle-outline",
    id: "add",
    label: "Add",
  },
  {
    activeIcon: "folder-open",
    href: "/vault/records",
    icon: "folder-open-outline",
    id: "records",
    label: "Records",
  },
  {
    activeIcon: "settings",
    href: "/settings",
    icon: "settings-outline",
    id: "settings",
    label: "Settings",
  },
  {
    activeIcon: "lock-closed",
    icon: "lock-closed-outline",
    id: "lock",
    label: "Lock",
  },
];

export function VaultBottomNavigation({
  active,
}: {
  active: NavigationTab;
}) {
  const router = useRouter();
  const { lock } = useVaultSession();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        borderTopColor: colors.divider,
        borderTopWidth: 1,
        flexDirection: "row",
        justifyContent: "space-around",
        marginHorizontal: -8,
        paddingTop: 10,
      }}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        const isLock = item.id === "lock";
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole={isLock ? "button" : "tab"}
            accessibilityState={isLock ? undefined : { selected: isActive }}
            key={item.id}
            onPress={() => {
              if (isLock) {
                lock();
              } else if (!isActive && item.href) {
                router.replace(item.href);
              }
            }}
            style={({ pressed }) => ({
              alignItems: "center",
              flex: 1,
              gap: 3,
              opacity: pressed ? 0.55 : 1,
              paddingHorizontal: 2,
              paddingVertical: 4,
            })}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: isActive
                  ? colors.successSurface
                  : "transparent",
                borderRadius: 16,
                height: 30,
                justifyContent: "center",
                width: 44,
              }}
            >
              <Ionicons
                color={
                  isActive
                    ? colors.action
                    : isLock
                      ? colors.inkSoft
                      : colors.inkMuted
                }
                name={isActive ? item.activeIcon : item.icon}
                size={21}
              />
            </View>
            <Text
              style={{
                color: isActive
                  ? colors.action
                  : isLock
                    ? colors.inkSoft
                    : colors.inkMuted,
                fontFamily: isActive ? fonts.sans.semibold : fonts.sans.medium,
                fontSize: 10.5,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
