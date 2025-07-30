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
  Linking, 
} from 'react-native';
import { getDetailedSeniorReport } from '../services/api'


interface ReportData {
  어르신_ID: string;
  요청_물품: { 물품: string; 요약: string }[];
  리포트_날짜: string;
  키워드_분석: string[];
  감정_신체_상태: {
    건강_언급: string[];
    전반적_감정: string;
  };
  식사_상태_추정: {
    감정: string;
    세부_내용: string;
    식사_시간: string;
    언급_여부: string;
  }[];
  일일_대화_요약: {
    요약: string;
    강조_키워드: string[];
    구체적_언급: string[];
    매일_묻는_질문_응답: {
      수면_상태: string;
      약_복용_상태: string;
      오늘_질문?: string;
      오늘_답변?: string;
    };
  };
  자녀를_위한_추천_대화_주제: {
    이유: string;
    주제: string;
  }[];
  인지상태_평가?: { 
    total_quizzes_count: number;
    total_correct_count: number;
    topic_summary: {
      topic: string;
      total_for_topic: number;
      correct_for_topic: number;
      incorrect_for_topic: number;
    }[];
  };
}

// props 타입
interface ReportScreenProps {
  navigation: {
    goBack: () => void;
  };
  route: {
    params: {
      userId: string;
      seniorName?: string;
    };
  };
}

const ReportScreen: React.FC<ReportScreenProps> = ({ navigation, route }) => {
  const { userId, seniorName } = route.params;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const STORE_BASE_URL = 'https://smartstore.naver.com/jeeeee/search';

  // API 에서 리포트 불러오기
  useEffect(() => {
  (async () => {
    setLoading(true);
    try {
      // 샘플 데이터 대신 실제 API 호출 활성화
      const data = await getDetailedSeniorReport(userId); // <-- 이 줄이 활성화되어야 합니다.
      setReport(data as ReportData);

      setError(null);
    } catch (e) {
      console.warn(e);
      setError('리포트를 불러오는 데 실패했습니다. API 호출 또는 서버 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  })();
}, [userId]);

  const cognitiveScore = Math.floor(Math.random() * 8) + 3;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fcecdc" />
        <Text>리포트를 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: 'red' }}>{error || '데이터가 없습니다.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={navigation.goBack}>
          <Text style={styles.backBtnText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cognitiveAssessment = report.인지상태_평가 || {
    total_quizzes_count: 0,
    total_correct_count: 0,
    topic_summary: []
  };

  // 이제 report 객체가 유효하다고 가정하고, 각 섹션을 줄글로 구성합니다.
  const dailySummary = report.일일_대화_요약?.요약 || '오늘의 대화 요약 정보가 없습니다.';
  const emphasizedKeywords = report.일일_대화_요약?.강조_키워드?.join(', ') || '강조된 키워드 없음';

  const healthMentions = report.감정_신체_상태?.건강_언급?.join(', ') || '건강 언급 없음';
  const overallEmotion = report.감정_신체_상태?.전반적_감정 || '전반적 감정 정보 없음';

  const mealStatus = report.식사_상태_추정?.map(meal => {
    return `${meal.식사_시간}: ${meal.언급_여부 === '있음' ? meal.세부_내용 || '정보 없음' : '언급 없음'} (감정: ${meal.감정})`;
  }).join('\n') || '식사 상태 정보 없음';

  const renderRequestedItems = () => {
    if (!report.요청_물품 || report.요청_물품.length === 0) {
      return <Text style={styles.text}>요청된 물품이 없습니다.</Text>;
    }

    return report.요청_물품.map((item, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => {
          // 'q' 파라미터를 사용하여 물품 이름을 검색 쿼리로 전달합니다.
          const url = `${STORE_BASE_URL}?q=${encodeURIComponent(item.물품)}`;
          Linking.openURL(url).catch(err => console.error("페이지를 로드할 수 없습니다.", err));
        }}
        style={styles.clickableItem}
      >
        <Text style={[styles.text, styles.linkText]}>{item.물품}: {item.요약}</Text>
      </TouchableOpacity>
    ));
  };

  const recommendedTopics = report.자녀를_위한_추천_대화_주제?.map((topic, index) => {
    return `${index + 1}. ${topic.주제} (이유: ${topic.이유})`;
  }).join('\n') || '추천 대화 주제가 없습니다.';

  const dailyQuestions = report.일일_대화_요약?.매일_묻는_질문_응답;
  const sleepStatus = dailyQuestions?.수면_상태 || '수면 상태 정보 없음';
  const medicineStatus = dailyQuestions?.약_복용_상태 || '약 복용 상태 정보 없음';
  const todayQuestion = dailyQuestions?.오늘_질문 || '오늘의 질문 정보 없음';
  const todayAnswer = dailyQuestions?.오늘_답변 || '오늘의 답변 정보 없음';


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f8fa" />
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>오늘의 리포트</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        {/* 리포트 날짜 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 리포트 날짜</Text>
          <Text style={styles.text}>{report.리포트_날짜}</Text>
        </View>

        {/* 1. 오늘의 대화 요약 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💬 오늘의 대화 요약</Text>
          <Text style={styles.text}>{dailySummary}</Text>
          <Text style={styles.text}>{'강조 키워드: ' + emphasizedKeywords}</Text>
        </View>

        {/* 2. 건강 및 신체 상태 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>❤️ 건강 상태</Text>
          <Text style={styles.text}>{'건강 언급: ' + healthMentions}</Text>
          <Text style={styles.text}>{'전반적 감정: ' + overallEmotion}</Text>
        </View>

        {/* 3. 식사 상태 추정 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🍽️ 식사 상태</Text>
          <Text style={styles.text}>{mealStatus}</Text>
        </View>

        {/* 4. 매일 묻는 질문 응답 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>❓ 매일 묻는 질문 응답</Text>
          <Text style={styles.text}>{'수면 상태: ' + sleepStatus}</Text>
          <Text style={styles.text}>{'약 복용 상태: ' + medicineStatus}</Text>
          <Text style={styles.text}>{'오늘의 질문: ' + todayQuestion}</Text>
          <Text style={styles.text}>{'어르신 답변: ' + todayAnswer}</Text>
        </View>

        {/* 🔥🔥🔥 5. 인지상태 - 총점 및 틀린 부분 요약 표시 🔥🔥🔥 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧠 인지상태</Text>
          
          {/* 1. 총 퀴즈 점수: X개/Y문제 */}
          <Text style={styles.text}>총 퀴즈 점수: {cognitiveAssessment.total_correct_count}개 / {cognitiveAssessment.total_quizzes_count}문제</Text>
          
          {/* 2. 어떤 부분에서 틀렸는지 알려주는 부분 */}
          {cognitiveAssessment.topic_summary && cognitiveAssessment.topic_summary.length > 0 ? (
            <View>
              <Text style={styles.text}>계산력 부분에서 어려움을 느끼셨어요:</Text>
              {cognitiveAssessment.topic_summary.map((summary, index) => (
                <Text key={index} style={styles.text}>
                  • {summary.topic}: {summary.total_for_topic}문제 중 {summary.incorrect_for_topic}개 오답
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>아직 퀴즈 데이터가 충분하지 않습니다.</Text>
          )}

          {/* 기존 진행 바는 총 퀴즈 점수를 활용하여 표시 */}
          {cognitiveAssessment.total_quizzes_count > 0 && (
             <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(cognitiveAssessment.total_correct_count / cognitiveAssessment.total_quizzes_count) * 100}%`, backgroundColor: '#4CAF50' }]} />
             </View>
          )}
        </View>

        {/* 6. 요청 물품 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛒요청물품</Text>
          {renderRequestedItems()} 
        </View>

        {/* 7. 자녀를 위한 추천 대화 주제 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💡 자녀를 위한 추천 대화 주제</Text>
          <Text style={styles.text}>{recommendedTopics}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fcf8f5' // 메인 배경색
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#ffdab9', // 헤더 배경색
    borderBottomWidth: 0, // 기본 border 제거
    elevation: 2, // 그림자 추가 (Android)
    shadowColor: '#000', // 그림자 (iOS)
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: { // 뒤로가기 버튼 영역 확장
    padding: 6,
    marginRight: 4,
  },
  backArrow: { 
    fontSize: 15, // 좀 더 크게
    marginRight: 12, 
    color: '#EA6B6B', // 메인 강조색
    fontWeight: 'bold', // 굵게
  },
  title: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#EA6B6B', // 메인 강조색
  },
  content: { 
    padding: 13,
    paddingBottom: 30, // 하단 여백 추가
  },
  card: { 
    backgroundColor: '#ffffff', // ✨ 변경: 카드 배경색 흰색
    borderRadius: 16, // 모서리 둥글게
    padding: 13, 
    marginBottom: 16, 
    elevation: 4, // 그림자 강화
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    borderWidth: 1, // 테두리 추가
    borderColor: '#fcdbc4', // 부드러운 테두리 색상
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    color: '#333', // ✨ 변경: 카드 제목 색상 검정
  },
  text: { 
    fontSize: 12, 
    lineHeight: 24, 
    color: '#333', // ✨ 변경: 본문 텍스트 색상 검정
    marginBottom: 4 
  }, 
  // tags, tag, row, emotionItem, emotionBadge, topicItem, topicNum: 현재 사용되지 않음
  tags:{ flexDirection:'row', flexWrap:'wrap', marginTop:8 },
  tag:{ backgroundColor:'#ffdab9', borderRadius:8, paddingHorizontal:8, paddingVertical:4, margin:4, color:'#333' },
  row:{ flexDirection:'row', alignItems:'center', marginVertical:4 },
  emotionItem:{ alignItems:'center', flex:1 },
  emotionBadge:{ borderRadius:12, paddingHorizontal:8, paddingVertical:4, marginTop:4 },


  progressBar: { 
    height: 10, // 높이 증가
    backgroundColor: '#fcdbc4', // 진행바 배경색 (메인 컬러 사용)
    borderRadius: 5, 
    overflow: 'hidden', 
    marginTop: 10, 
    marginBottom: 10, // 하단 여백 추가
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#EA6B6B', // 진행바 채워지는 색상 (메인 강조색)
    borderRadius: 5, // 채워지는 부분도 둥글게
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#fcf8f5' // 배경색 변경
  },
  loadingText: { // 로딩 텍스트 스타일 추가
    fontSize: 16,
    color: '#6a6a6a',
    marginTop: 10,
  },
  errorText: { // 에러 텍스트 스타일 변경
    color: '#EA6B6B', 
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 20,
  },
  backBtn: { 
    marginTop: 16, 
    backgroundColor: '#EA6B6B', // 메인 강조색
    paddingHorizontal: 25, // 패딩 증가
    paddingVertical: 12, // 패딩 증가
    borderRadius: 10, // 둥글기 증가
  },
  backBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16,
  },
  topicSummaryContainer: { // 토픽 요약 컨테이너 스타일 추가
    marginTop: 10,
    paddingLeft: 5, // 들여쓰기 효과
  },
  topicSummaryText: { // 토픽 요약 텍스트 스타일 추가
    fontSize: 14,
    lineHeight: 22,
    color: '#333', // ✨ 변경: 텍스트 색상 검정
    marginBottom: 2,
  },
  // quizResultItem 등 사용되지 않는 스타일은 그대로 유지
  quizResultItem: { 
    backgroundColor: '#fff8f2', // 따뜻한 연한 배경
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#ffdab9', // 테두리 색상
  },
  quizQuestion: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333', // ✨ 변경: 텍스트 색상 검정
  },
  quizAnswer: {
    fontSize: 14,
    color: '#666', // ✨ 변경: 텍스트 색상 약간 밝은 검정
    marginBottom: 3,
  },
  quizCorrectAnswer: {
    fontSize: 14,
    color: '#008000', // 기존 녹색 유지
    fontStyle: 'italic',
    marginBottom: 3,
  },
  quizDate: {
    fontSize: 12,
    color: '#999', // 기존 회색 유지
    textAlign: 'right',
  },
  clickableItem: {
    paddingVertical: 4, // 터치 영역 확보를 위해 수직 패딩 추가
  },
  linkText: {
    color: '#007AFF', // 링크임을 나타내는 색상 (iOS 파란색)
    textDecorationLine: 'underline', // 링크임을 나타내는 밑줄
  },
});

export default ReportScreen;