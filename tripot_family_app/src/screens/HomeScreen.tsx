import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Alert
} from 'react-native';

interface SeniorReport {
  name: string;
  status: { mood: string; condition: string; needs: string; };
  stats: { contact: number; visit: number; question_answered: number; };
  ranking: { name: string; score: number }[];
}

interface HomeScreenProps {
  navigation: {
    navigateToFamilyFeed: () => void;
    navigateToSetting: () => void; // ✨ 설정 화면 네비게이션 추가
  };
  userId: string;
  apiBaseUrl: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, userId, apiBaseUrl }) => {
  const [report, setReport] = useState<SeniorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        console.log('📊 리포트 데이터 로딩 시작...');
        
        const response = await fetch(`${apiBaseUrl}/api/v1/family/reports/${userId}`);
        const data = await response.json();
        
        if (response.ok) {
          setReport(data);
          setError(null);
          console.log('✅ 실제 API에서 리포트 로딩 성공');
        } else {
          throw new Error(data.detail || '리포트 로딩 실패');
        }
        
      } catch (err: any) {
        console.error('❌ 리포트 로딩 실패:', err);
        setError(err.message || '데이터를 불러오는 데 실패했습니다.');
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [userId, apiBaseUrl]);

  return (
    <SafeAreaView style={homeStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f8fa" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={homeStyles.header}>
          <Text style={homeStyles.headerTitle}>
            {report ? `${report.name} 리포트` : '리포트 로딩 중...'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" style={homeStyles.centered} />
        ) : error || !report ? (
          <Text style={homeStyles.errorText}>{error || '리포트가 없습니다.'}</Text>
        ) : (
          <>
            <View style={homeStyles.profileCard}>
              <View style={homeStyles.avatarPlaceholder}>
                <Text style={homeStyles.avatarText}>👤</Text>
              </View>
              <View style={homeStyles.profileInfo}>
                <Text style={homeStyles.profileName}>{report.name}</Text>
                <Text style={homeStyles.statusText}>기분 : {report.status.mood}</Text>
                <Text style={homeStyles.statusText}>건강 : {report.status.condition}</Text>
                <Text style={homeStyles.statusText}>요청 물품 : {report.status.needs}</Text>
              </View>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={homeStyles.iconScrollContainer}
              contentContainerStyle={homeStyles.iconScrollContent}
            >
              <TouchableOpacity 
                style={homeStyles.iconMenuItem} 
                onPress={navigation.navigateToFamilyFeed}
              >
                <View style={[homeStyles.iconPlaceholder, homeStyles.familyYardIcon]}>
                  <Text style={homeStyles.iconEmoji}>👨‍👩‍👧‍👦</Text>
                </View>
                <Text style={[homeStyles.iconMenuText, homeStyles.familyYardText]}>가족마당</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={homeStyles.iconMenuItem} 
                onPress={() => Alert.alert('알림', '구매 기능은 준비 중입니다.')}
              >
                <View style={homeStyles.iconPlaceholder}>
                  <Text style={homeStyles.iconEmoji}>🛒</Text>
                </View>
                <Text style={homeStyles.iconMenuText}>구매</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={homeStyles.iconMenuItem} 
                onPress={() => Alert.alert('알림', '위치 기능은 준비 중입니다.')}
              >
                <View style={homeStyles.iconPlaceholder}>
                  <Text style={homeStyles.iconEmoji}>📍</Text>
                </View>
                <Text style={homeStyles.iconMenuText}>위치</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={homeStyles.iconMenuItem} 
                onPress={() => Alert.alert('알림', '캘린더 기능은 준비 중입니다.')}
              >
                <View style={homeStyles.iconPlaceholder}>
                  <Text style={homeStyles.iconEmoji}>📅</Text>
                </View>
                <Text style={homeStyles.iconMenuText}>캘린더</Text>
              </TouchableOpacity>
              
              {/* ✨ 설정 버튼 - 실제 기능으로 변경 */}
              <TouchableOpacity 
                style={homeStyles.iconMenuItem} 
                onPress={navigation.navigateToSetting}
              >
                <View style={[homeStyles.iconPlaceholder, homeStyles.settingIcon]}>
                  <Text style={homeStyles.iconEmoji}>⚙️</Text>
                </View>
                <Text style={[homeStyles.iconMenuText, homeStyles.settingText]}>설정</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={homeStyles.statsContainer}>
              <View style={homeStyles.statItem}>
                <Text style={homeStyles.statIconEmoji}>📞</Text>
                <Text style={homeStyles.statLabel}>연락</Text>
                <Text style={homeStyles.statValue}>{report.stats.contact}회</Text>
              </View>
              <View style={homeStyles.statItem}>
                <Text style={homeStyles.statIconEmoji}>🏠</Text>
                <Text style={homeStyles.statLabel}>방문</Text>
                <Text style={homeStyles.statValue}>{report.stats.visit}회</Text>
              </View>
              <View style={homeStyles.statItem}>
                <Text style={homeStyles.statIconEmoji}>❓</Text>
                <Text style={homeStyles.statLabel}>오늘의 질문</Text>
                <Text style={homeStyles.statValue}>{report.stats.question_answered}회</Text>
              </View>
            </View>

            <View style={homeStyles.rankingContainer}>
              <View style={homeStyles.rankingHeader}>
                <Text style={homeStyles.trophyEmoji}>🏆</Text>
                <Text style={homeStyles.rankingTitle}>이달의 우리집 효도 RANKING</Text>
              </View>
              {report.ranking.map((item, index) => (
                <View key={index} style={homeStyles.rankItem}>
                  <Text style={homeStyles.rankNumber}>{index + 1}</Text>
                  <Text style={homeStyles.rankName}>{item.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const homeStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f7f8fa' 
  },
  header: { 
    padding: 20 
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: 'bold' 
  },
  profileCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    marginHorizontal: 20, 
    padding: 20, 
    alignItems: 'center', 
    elevation: 3 
  },
  avatarPlaceholder: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#f0f0f0', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  avatarText: { 
    fontSize: 30 
  },
  profileInfo: { 
    alignItems: 'center', 
    marginBottom: 16 
  },
  profileName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 8 
  },
  statusText: { 
    fontSize: 14, 
    color: '#6a6a6a', 
    lineHeight: 20 
  },
  iconScrollContainer: { 
    marginTop: 20 
  },
  iconScrollContent: { 
    paddingHorizontal: 20, 
    alignItems: 'center' 
  },
  iconMenuItem: { 
    alignItems: 'center', 
    marginRight: 20 
  },
  iconPlaceholder: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#f0f0f0', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  iconEmoji: { 
    fontSize: 24 
  },
  iconMenuText: { 
    fontSize: 14, 
    fontWeight: '500' 
  },
  familyYardIcon: { 
    backgroundColor: '#E3F2FD' 
  },
  familyYardText: { 
    color: '#1976D2', 
    fontWeight: 'bold' 
  },
  // ✨ 설정 버튼 스타일 추가
  settingIcon: { 
    backgroundColor: '#FFF3E0' 
  },
  settingText: { 
    color: '#F57C00', 
    fontWeight: 'bold',
    fontSize: 12
  },
  statsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    margin: 20, 
    padding: 20 
  },
  statItem: { 
    alignItems: 'center', 
    flex: 1 
  },
  statIconEmoji: { 
    fontSize: 30, 
    marginBottom: 8 
  },
  statLabel: { 
    fontSize: 14, 
    color: '#6a6a6a', 
    marginBottom: 4 
  },
  statValue: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  rankingContainer: { 
    backgroundColor: '#fff8f2', 
    borderRadius: 16, 
    marginHorizontal: 20, 
    marginBottom: 20, 
    padding: 20 
  },
  rankingHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  trophyEmoji: { 
    fontSize: 20, 
    marginRight: 8 
  },
  rankingTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#e56a00' 
  },
  rankItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 10 
  },
  rankNumber: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#e56a00', 
    marginRight: 16 
  },
  rankName: { 
    fontSize: 16, 
    fontWeight: '500' 
  },
  centered: { 
    marginTop: 50, 
    alignItems: 'center' 
  },
  errorText: { 
    textAlign: 'center', 
    marginTop: 50, 
    color: 'red', 
    fontSize: 16 
  },
});

export default HomeScreen;