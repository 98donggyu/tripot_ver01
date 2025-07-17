import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { getSeniorReport } from '../services/api';

// --- 타입 정의 ---
interface Senior {
  id: string;
  name: string;
}

interface SeniorReport {
  name: string;
  status: { mood: string; condition: string; last_activity: string; needs: string; };
  stats: { contact: number; visit: number; question_answered: number; };
  ranking: { name: string; score: number }[];
}

const HomeScreen = () => {
  // --- 상태 관리 ---
  const [report, setReport] = useState<SeniorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [seniorList, setSeniorList] = useState<Senior[]>([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState<string | null>(null);

  // --- 데이터 로딩 ---
  useEffect(() => {
    const mockSeniorList = [
      { id: 'user_1752303760586_8wi64r', name: '라기선님' },
    ];
    setSeniorList(mockSeniorList);

    if (mockSeniorList.length > 0) {
      setSelectedSeniorId(mockSeniorList[0].id);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchReportData = async () => {
      if (!selectedSeniorId) return;

      setLoading(true);
      try {
        const data = await getSeniorReport(selectedSeniorId);
        setReport(data);
        setError(null);
      } catch (err) {
        setError('데이터를 불러오는 데 실패했습니다.');
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [selectedSeniorId]);

  // --- 렌더링 로직 ---
  if (!selectedSeniorId) {
    return <Text style={styles.centered}>돌보실 어르신을 추가해주세요.</Text>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f8fa" translucent={false} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 헤더: 어르신 이름 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {report ? report.name : seniorList.find(s => s.id === selectedSeniorId)?.name} 리포트
            </Text>
            <Text style={styles.arrowIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* 로딩 및 에러 상태에 따른 분기 처리 */}
        {loading ? (
          <ActivityIndicator size="large" style={styles.centered} />
        ) : error || !report ? (
          <Text style={styles.errorText}>{error || '리포트가 없습니다.'}</Text>
        ) : (
          <>
            {/* 프로필 카드 - 이미지 문제 해결 */}
            <View style={styles.profileCard}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{report.name}</Text>
                <Text style={styles.statusText}>기분 : {report.status.mood}</Text>
                <Text style={styles.statusText}>건강 : {report.status.condition}</Text>
                <Text style={styles.statusText}>요청 물품 : {report.status.needs}</Text>
              </View>
              <TouchableOpacity style={styles.detailButton}>
                <Text style={styles.detailButtonText}>자세히 보기</Text>
              </TouchableOpacity>
            </View>
            
            {/* 아이콘 메뉴 - 가로 스크롤 가능한 5개 아이콘 */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.iconScrollContainer}
              contentContainerStyle={styles.iconScrollContent}
            >
              <TouchableOpacity style={styles.iconMenuItem}>
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>👨‍👩‍👧‍👦</Text>
                </View>
                <Text style={styles.iconMenuText}>가족마당</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconMenuItem}>
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>🛒</Text>
                </View>
                <Text style={styles.iconMenuText}>구매</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconMenuItem}>
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>📍</Text>
                </View>
                <Text style={styles.iconMenuText}>위치</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconMenuItem}>
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>📅</Text>
                </View>
                <Text style={styles.iconMenuText}>캘린더</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconMenuItem}>
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconEmoji}>⚙️</Text>
                </View>
                <Text style={styles.iconMenuText}>설정</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* 통계 - 아이콘을 이모지로 대체 */}
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
                <Text style={styles.statValue}>{report.stats.question_answered}회</Text>
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
    </View>
  );
};

// --- 스타일 정의 (수정) ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f7f8fa',
    paddingTop: 20, // 상단 여백 추가
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1c1c1c',
  },
  arrowIcon: {
    fontSize: 16,
    marginLeft: 8,
    color: '#1c1c1c',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  // 이미지 대신 플레이스홀더 사용
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 30,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1c1c',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#6a6a6a',
    lineHeight: 20,
  },
  detailButton: {
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
  // 가로 스크롤 아이콘 메뉴 스타일
  iconScrollContainer: {
    marginTop: 20,
  },
  iconScrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconMenuItem: {
    alignItems: 'center',
    marginRight: 30, // 아이콘 간 간격
    width: 80, // 고정 너비로 일정한 간격 유지
  },
  iconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconEmoji: {
    fontSize: 24,
  },
  iconMenuText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    margin: 20,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6a6a6a',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1c',
  },
  rankingContainer: {
    backgroundColor: '#fff8f2',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  trophyEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e56a00',
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e56a00',
    marginRight: 16,
  },
  rankName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', fontSize: 16 },
  errorText: { textAlign: 'center', marginTop: 50, color: 'red', fontSize: 16 },
});

export default HomeScreen;