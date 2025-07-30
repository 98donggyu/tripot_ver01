import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Alert,
  RefreshControl
} from 'react-native';

// --- 타입 정의 (초기 버전) ---
interface SeniorReport {
  name: string;
  report_date: string;
  status: {
    mood: string;
    condition: string;
    last_activity: string;
    needs: string;
  };
  stats: {
    contact: number;
    visit: number;
    Youtubeed: number;
  };
  ranking: { name: string; score: number }[];
}

interface HomeScreenProps {
  navigation: {
    navigate: (screen: string, params?: object) => void;
  };
  userId: string;
  apiBaseUrl: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, userId, apiBaseUrl }) => {
  const [report, setReport] = useState<SeniorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`📊 리포트 데이터 로딩 시작... (ID: ${userId})`);
      const response = await fetch(`${apiBaseUrl}/api/v1/family/reports/${userId}`);
      
      if (!response.ok) {
          const errData = await response.json().catch(() => ({detail: "서버 응답 오류"}));
          throw new Error(errData.detail || '리포트 로딩 실패');
      }
        
      const data = await response.json();
      setReport(data);
      console.log('✅ API에서 리포트 로딩 성공');

    } catch (err: any) {
      console.error('❌ 리포트 로딩 실패:', err);
      setError(err.message || '데이터를 불러오는 데 실패했습니다.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [userId, apiBaseUrl]);

  // --- 렌더링 로직 ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f8fa" />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={fetchReportData} 
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {report ? `${report.name} 리포트` : '리포트'}
          </Text>
          {report && <Text style={styles.reportDate}>{report.report_date} 기준</Text>}
        </View>

        {loading && !report ? (
          <ActivityIndicator size="large" style={styles.centered} />
        ) : error || !report ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error || '리포트 데이터가 없습니다.'}</Text>
            <TouchableOpacity style={styles.detailButton} onPress={fetchReportData}>
              <Text style={styles.detailButtonText}>새로고침</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 프로필 카드 */}
            <View style={styles.profileCard}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{report.name}</Text>
                <Text style={styles.statusText}>기분 : {report.status.mood}</Text>
                <Text style={styles.statusText}>건강 : {report.status.condition}</Text>
                <Text style={styles.statusText}>최근 활동 : {report.status.last_activity}</Text>
                <Text style={styles.statusText}>요청 물품 : {report.status.needs}</Text>
              </View>
              
              {/* 버튼들 */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => navigation.navigate('Report', { userId: userId, seniorName: report.name })}
                >
                  <Text style={styles.detailButtonText}>자세히 보기</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => Alert.alert('알림', '리포트 생성 기능은 준비 중입니다.')}
                >
                  <Text style={styles.detailButtonText}>리포트생성</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 아이콘 메뉴 */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.iconScrollContainer}
              contentContainerStyle={styles.iconScrollContent}
            >
              <TouchableOpacity 
                style={styles.iconMenuItem} 
                onPress={() => navigation.navigate('FamilyFeed')}
              >
                <View style={[styles.iconPlaceholder, styles.familyYardIcon]}>
                  <Text style={styles.iconEmoji}>👨‍👩‍👧‍👦</Text>
                </View>
                <Text style={[styles.iconMenuText, styles.familyYardText]}>가족마당</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.iconMenuItem} 
                onPress={() => Alert.alert('알림', '구매 기능은 준비 중입니다.')}
              >
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>🛒</Text>
                </View>
                <Text style={styles.iconMenuText}>구매</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.iconMenuItem} 
                onPress={() => Alert.alert('알림', '위치 기능은 준비 중입니다.')}
              >
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>📍</Text>
                </View>
                <Text style={styles.iconMenuText}>위치</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.iconMenuItem} 
                onPress={() => navigation.navigate('Calendar')}
              >
                <View style={[styles.iconPlaceholder, styles.calendarIcon]}>
                  <Text style={styles.iconEmoji}>📅</Text>
                </View>
                <Text style={[styles.iconMenuText, styles.calendarText]}>일정</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.iconMenuItem} 
                onPress={() => navigation.navigate('Setting')}
              >
                <View style={[styles.iconPlaceholder, styles.settingIcon]}>
                  <Text style={styles.iconEmoji}>⚙️</Text>
                </View>
                <Text style={[styles.iconMenuText, styles.settingText]}>설정</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* 통계 */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                  <Text style={styles.statIconEmoji}>📞</Text>
                  <Text style={styles.statLabel}>연락</Text>
                  <Text style={styles.statValue}>{report.stats.contact}회</Text>
              </View>
              <View style={styles.statItem}>
                  <Text style={styles.statIconEmoji}>🏠</Text>
                  <Text style={styles.statLabel}>방문</Text>
                  <Text style={styles.statValue}>{report.stats.visit}회</Text>
              </View>
              <View style={styles.statItem}>
                  <Text style={styles.statIconEmoji}>❓</Text>
                  <Text style={styles.statLabel}>오늘의 질문</Text>
                  <Text style={styles.statValue}>{report.stats.Youtubeed}회</Text>
              </View>
            </View>

            {/* 랭킹 */}
            <View style={styles.rankingContainer}>
                <View style={styles.rankingHeader}>
                    <Text style={styles.trophyEmoji}>🏆</Text>
                    <Text style={styles.rankingTitle}>이달의 우리집 효도 RANKING</Text>
                </View>
                {report.ranking.map((item, index) => (
                    <View key={index} style={styles.rankItem}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                        <Text style={styles.rankName}>{item.name}</Text>
                    </View>
                ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// --- 스타일 ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f7f8fa' },
    header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    headerTitle: { fontSize: 22, fontWeight: 'bold' },
    reportDate: { fontSize: 14, color: '#6a6a6a' },
    profileCard: { 
        backgroundColor: '#ffffff', borderRadius: 16, marginHorizontal: 20, padding: 20, 
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10,
        alignItems: 'center',
    },
    avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { fontSize: 30 },
    profileInfo: { 
        alignItems: 'center',
        marginBottom: 16,
    },
    profileName: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    statusText: { fontSize: 14, color: '#6a6a6a', lineHeight: 22 },
    
    // 버튼 컨테이너 추가
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    
    detailButton: {
        marginTop: 10,
        backgroundColor: '#fff0e6',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    detailButtonText: {
        color: '#ff7a2b',
        fontWeight: 'bold',
        fontSize: 14,
    },
    
    // 아이콘 메뉴 스타일 추가
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
    calendarIcon: { 
        backgroundColor: '#E8F5E8' 
    },
    calendarText: { 
        color: '#2E7D32', 
        fontWeight: 'bold',
        fontSize: 12
    },
    settingIcon: { 
        backgroundColor: '#FFF3E0' 
    },
    settingText: { 
        color: '#F57C00', 
        fontWeight: 'bold',
        fontSize: 12
    },
    
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: 16, margin: 20, padding: 20 },
    statItem: { alignItems: 'center', flex: 1 },
    statIconEmoji: { fontSize: 30, marginBottom: 8 },
    statLabel: { fontSize: 14, color: '#6a6a6a', marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold' },
    rankingContainer: { backgroundColor: '#fff8f2', borderRadius: 16, marginHorizontal: 20, marginBottom: 20, padding: 20 },
    rankingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    trophyEmoji: { fontSize: 20, marginRight: 8 },
    rankingTitle: { fontSize: 18, fontWeight: 'bold', color: '#e56a00' },
    rankItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 10 },
    rankNumber: { fontSize: 16, fontWeight: 'bold', color: '#e56a00', marginRight: 16 },
    rankName: { fontSize: 16, fontWeight: '500' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
    errorText: { textAlign: 'center', color: 'red', fontSize: 16, marginBottom: 20 },
});

export default HomeScreen;