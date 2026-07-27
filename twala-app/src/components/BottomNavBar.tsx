import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../theme';
import { useLanguage } from '../i18n/LanguageContext';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  iconFilled?: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'Dashboard', label: 'Dashboard', icon: 'view-dashboard-outline', iconFilled: 'view-dashboard' },
  { key: 'Goals', label: 'Goals', icon: 'flag-outline', iconFilled: 'flag' },
  { key: 'Assistant', label: 'Assistant', icon: 'robot-outline', iconFilled: 'robot' },
  { key: 'Transfer', label: 'Transfer', icon: 'bank-transfer-out', iconFilled: 'bank-transfer' },
  { key: 'History', label: 'History', icon: 'history' },
];

export type AppScreen = 'Dashboard' | 'Goals' | 'Assistant' | 'Transfer' | 'History' | 'GoalDetail' | 'Circles';

interface Props {
  activeRoute: AppScreen;
  onNavigate: (route: AppScreen) => void;
}

export default function BottomNavBar({ activeRoute, onNavigate }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      {NAV_ITEMS.map((item) => {
        const isActive = activeRoute === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.navItem, isActive && styles.activeItem]}
            onPress={() => onNavigate(item.key as AppScreen)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isActive && item.iconFilled ? item.iconFilled : item.icon}
              size={24}
              color={isActive ? Colors.onSecondaryContainer : Colors.onSurfaceVariant}
            />
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {t(item.label)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '33',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    ...{
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: BorderRadius.lg,
    minWidth: 60,
  },
  activeItem: {
    backgroundColor: Colors.secondaryContainer,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: '500',
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  activeLabel: {
    color: Colors.onSecondaryContainer,
    fontWeight: '600',
  },
});
