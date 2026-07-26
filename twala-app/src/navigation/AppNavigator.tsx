import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeDashboard from '../screens/HomeDashboard';
import Goals from '../screens/Goals';
import AIAssistant from '../screens/AIAssistant';
import SmartTransfer from '../screens/SmartTransfer';
import GoalDetail from '../screens/GoalDetail';
import History from '../screens/History';
import ProfileScreen from '../screens/ProfileScreen';
import BottomNavBar, { AppScreen } from '../components/BottomNavBar';
import { Colors } from '../theme';
import { setApiAccessToken } from '../services/api';

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  accessToken?: string;
}

export default function AppNavigator() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('Dashboard');
  const [navHistory, setNavHistory] = useState<AppScreen[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);
  useEffect(() => { setApiAccessToken(user?.accessToken || null); }, [user]);
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ProfileScreen onProfileReady={(p) => setUser(p)} />
      </SafeAreaView>
    );
  }

  const navigate = (screen: AppScreen) => {
    if (screen === 'GoalDetail') {
      setNavHistory((prev) => [...prev, currentScreen]);
      setCurrentScreen('GoalDetail');
    } else if (screen === 'Dashboard') {
      setCurrentScreen('Dashboard');
      setNavHistory([]);
    } else {
      setCurrentScreen(screen);
    }
  };

  const navigateToGoal = (id: string) => {
    setGoalId(id);
    setNavHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen('GoalDetail');
  };

  const handleBack = () => {
    setGoalId(null);
    const prev = navHistory[navHistory.length - 1];
    if (prev) {
      setNavHistory((prevH) => prevH.slice(0, -1));
      setCurrentScreen(prev);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Dashboard':
        return <HomeDashboard onNavigate={navigate} onNavigateGoal={navigateToGoal} user={user} />;
      case 'Goals':
        return <Goals onNavigateGoal={navigateToGoal} />;
      case 'Assistant':
        return <AIAssistant onNavigate={(s) => navigate(s as AppScreen)} onNavigateGoal={navigateToGoal} userName={user.name} userPhone={user.phone} />;
      case 'Transfer':
        return <SmartTransfer user={user} />;
      case 'GoalDetail':
        return <GoalDetail goalId={goalId} onBack={handleBack} onNavigate={navigate} />;
      case 'History':
        return <History />;
      default:
        return <HomeDashboard onNavigate={navigate} onNavigateGoal={navigateToGoal} user={user} />;
    }
  };

  const showBottomNav = currentScreen !== 'GoalDetail';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      {showBottomNav && (
        <BottomNavBar activeRoute={currentScreen} onNavigate={navigate} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
});
