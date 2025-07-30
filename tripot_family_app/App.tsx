import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Alert, BackHandler, ActivityIndicator, View, Text, StatusBar, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from './src/screens/HomeScreen';
import FamilyFeedScreen from './src/screens/FamilyFeedScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import PhotoUploadScreen from './src/screens/PhotoUploadScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SettingScreen from './src/screens/SettingScreen';
import ReportScreen from './src/screens/ReportScreen'; // ✨ 리포트 상세 화면 추가

LogBox.ignoreLogs(['ViewPropTypes will be removed']);

const API_BASE_URL = 'http://192.168.101.67:8080';
const FAMILY_USER_ID = 'user_1752303760586_8wi64r'; // 가족 구성원 ID
const SENIOR_USER_ID = 'user_1752303760586_8wi64r'; // 어르신 ID

// 🔧 API 설정 로그
console.log('🌐 가족 앱 API 설정:', {
  apiBaseUrl: API_BASE_URL,
  familyUserId: FAMILY_USER_ID,
  seniorUserId: SENIOR_USER_ID,
  note: '가족이 어르신의 일정과 사진을 관리'
});

interface Comment { 
  id: number; 
  author_name: string; 
  comment_text: string; 
  created_at: string; 
}

interface Photo { 
  id: number; 
  uploaded_by: string; 
  created_at: string; 
  comments: Comment[]; 
}

interface Event {
  id: string;
  text: string;
  createdAt: Date;
}

interface MarkedDates { 
  [key: string]: { 
    marked?: boolean; 
    dotColor?: string; 
    events?: Event[];
  }; 
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [isLoading, setIsLoading] = useState(false);
  const [familyFeedData, setFamilyFeedData] = useState({});
  const [currentPhotoDetail, setCurrentPhotoDetail] = useState<any>(null);
  const [familyMarkedDates, setFamilyMarkedDates] = useState<MarkedDates>({});
  
  // ✨ 리포트 화면으로 전달할 파라미터 상태
  const [reportParams, setReportParams] = useState({ userId: SENIOR_USER_ID, seniorName: '어르신' });

  // ✨ 어르신 캘린더 데이터 로드 함수
  const loadSeniorCalendarData = async () => {
    try {
      console.log('📅 어르신 캘린더 데이터 로딩 시작...');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/events/${SENIOR_USER_ID}`);
      const result = await response.json();
      
      if (response.ok && result.calendar_data) {
        // 서버 형식을 프론트엔드 형식으로 변환
        const convertedData: MarkedDates = {};
        Object.keys(result.calendar_data).forEach(date => {
          const dateData = result.calendar_data[date];
          if (dateData.events) {
            convertedData[date] = {
              marked: true,
              dotColor: '#50cebb',
              events: dateData.events.map((event: any) => ({
                id: event.id,
                text: event.text,
                createdAt: new Date(event.created_at)
              }))
            };
          }
        });
        
        setFamilyMarkedDates(convertedData);
        await saveFamilyCalendarData(convertedData);
        console.log('✅ 어르신 캘린더 데이터 로딩 성공:', Object.keys(convertedData).length, '개 날짜');
      } else {
        console.log('ℹ️ 어르신 캘린더 데이터 없음');
        setFamilyMarkedDates({});
      }
    } catch (error: any) {
      console.error('❌ 어르신 캘린더 데이터 로드 실패:', error);
      // 로컬 저장된 데이터 사용
      await loadLocalCalendarData();
    }
  };

  // ✨ 로컬 캘린더 데이터 저장
  const saveFamilyCalendarData = async (data: MarkedDates) => {
    try {
      await AsyncStorage.setItem('familyCalendarData', JSON.stringify(data));
    } catch (e: any) {
      console.error('❌ 캘린더 데이터 저장 실패:', e);
    }
  };

  // ✨ 로컬 캘린더 데이터 로드
  const loadLocalCalendarData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('familyCalendarData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // createdAt을 Date 객체로 변환
        const migratedData: MarkedDates = {};
        Object.keys(parsedData).forEach(date => {
          const dateData = parsedData[date];
          if (dateData.events) {
            migratedData[date] = {
              ...dateData,
              events: dateData.events.map((event: any) => ({
                ...event,
                createdAt: typeof event.createdAt === 'string' ? new Date(event.createdAt) : event.createdAt
              }))
            };
          }
        });
        
        setFamilyMarkedDates(migratedData);
        console.log('✅ 로컬 캘린더 데이터 로드 완료');
      }
    } catch (e: any) {
      console.error('❌ 로컬 캘린더 데이터 로드 실패:', e);
    }
  };

  // ✨ 가족이 어르신 캘린더 일정 업데이트
  const handleFamilyUpdateEvent = async (date: string, events: Event[]) => {
    try {
      console.log('📅 가족이 어르신 캘린더 일정 업데이트:', date, events.length, '개');
      
      // 1. 서버에 업데이트 요청
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/events/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senior_user_id: SENIOR_USER_ID,
          family_user_id: FAMILY_USER_ID,
          date: date,
          events: events.map(event => ({
            id: event.id,
            text: event.text,
            created_at: event.createdAt.toISOString()
          }))
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        // 2. 로컬 상태 업데이트
        const newMarkedDates = { ...familyMarkedDates };
        if (!events || events.length === 0) {
          delete newMarkedDates[date];
        } else {
          newMarkedDates[date] = {
            marked: true,
            dotColor: '#50cebb',
            events: events
          };
        }
        
        setFamilyMarkedDates(newMarkedDates);
        await saveFamilyCalendarData(newMarkedDates);
        
        console.log('✅ 가족 캘린더 일정 업데이트 성공:', result.message);
        
        // 성공 메시지 (선택사항)
        // Alert.alert('성공', '어르신 일정이 업데이트되었습니다.');
        
      } else {
        throw new Error(result.detail || '일정 업데이트 실패');
      }
    } catch (error: any) {
      console.error('❌ 캘린더 업데이트 실패:', error);
      Alert.alert('오류', `일정 업데이트에 실패했습니다: ${error?.message || '알 수 없는 오류'}`);
    }
  };

  // ✨ 캘린더 업데이트 확인 (어르신이 직접 수정한 경우)
  const checkCalendarUpdates = async () => {
    try {
      console.log('🔍 어르신 캘린더 업데이트 확인...');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/check-updates/${SENIOR_USER_ID}`);
      const result = await response.json();
      
      if (response.ok && result.has_update && result.calendar_data) {
        console.log('📅 어르신이 직접 수정한 캘린더 업데이트 감지');
        
        // 서버 데이터를 프론트엔드 형식으로 변환
        const convertedData: MarkedDates = {};
        Object.keys(result.calendar_data).forEach(date => {
          const dateData = result.calendar_data[date];
          if (dateData.events) {
            convertedData[date] = {
              marked: true,
              dotColor: '#50cebb',
              events: dateData.events.map((event: any) => ({
                id: event.id,
                text: event.text,
                createdAt: new Date(event.created_at)
              }))
            };
          }
        });
        
        setFamilyMarkedDates(convertedData);
        await saveFamilyCalendarData(convertedData);
        
        console.log('✅ 어르신 직접 수정 캘린더 동기화 완료');
        
        // 업데이트 알림 (선택사항)
        Alert.alert('알림', '어르신이 일정을 수정했습니다.');
      } else {
        console.log('ℹ️ 새로운 캘린더 업데이트 없음');
      }
    } catch (error: any) {
      console.error('❌ 캘린더 업데이트 확인 실패:', error);
    }
  };

  // ✨ 가족 사진 로드
  const fetchFamilyPhotos = async () => {
    setIsLoading(true);
    try {
      console.log('📸 가족 사진 로딩 시작...');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/family/family-yard/photos?user_id_str=${SENIOR_USER_ID}`);
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        setFamilyFeedData(result.photos_by_date || {});
        console.log('✅ 가족 사진 로딩 성공:', Object.keys(result.photos_by_date || {}).length, '개 날짜');
      } else {
        console.log('⚠️ 가족 사진 API 응답 오류:', result);
        Alert.alert('오류', '사진을 불러오는데 실패했습니다.');
        setFamilyFeedData({});
      }
    } catch (error: any) {
      console.error('❌ 가족 사진 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다. Wi-Fi와 서버 상태를 확인해주세요.');
      setFamilyFeedData({});
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ 가족이 사진 업로드
  const uploadPhoto = async (imageUri: string) => {
    setIsLoading(true);
    const url = `${API_BASE_URL}/api/v1/family/family-yard/upload`;
    
    const formData = new FormData();
    formData.append('file', { 
      uri: imageUri, 
      type: 'image/jpeg', 
      name: `family_photo_${Date.now()}.jpg` 
    } as any);
    formData.append('user_id_str', SENIOR_USER_ID); // 어르신 ID로 업로드
    formData.append('uploaded_by', 'family'); // 가족이 업로드했다고 표시

    try {
      const response = await fetch(url, { 
        method: 'POST', 
        body: formData, 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      const result = await response.json();
      
      if (response.ok) {
        Alert.alert('성공', '사진을 가족마당에 등록했습니다!');
        await fetchFamilyPhotos();
        setCurrentScreen('FamilyFeed');
      } else {
        Alert.alert('오류', `사진 등록에 실패했습니다: ${result.detail || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다. Wi-Fi와 서버 상태를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ 화면 전환 함수
  const navigate = (screen: string, params?: object) => {
    console.log('📍 화면 이동:', screen, params || '');
    
    if (screen === 'FamilyFeed') {
      fetchFamilyPhotos();
    } else if (screen === 'Calendar') {
      loadSeniorCalendarData();
      // 캘린더 진입 시 업데이트도 확인
      setTimeout(checkCalendarUpdates, 1000);
    } else if (screen === 'Report' && params) {
      // 리포트 화면으로 이동 시 파라미터 저장
      setReportParams(params as { userId: string, seniorName: string });
    }
    
    setCurrentScreen(screen);
  };

  // ✨ 사진 상세 보기
  const openPhotoDetail = (photo: Photo) => {
    if (!photo || !photo.id) {
      Alert.alert("오류", "사진 정보를 여는데 실패했습니다.");
      return;
    }
    const detailData = {
      uri: `${API_BASE_URL}/api/v1/family/family-yard/photo/${photo.id}`,
      uploader: photo.uploaded_by,
      date: photo.created_at,
      comments: photo.comments,
      photoId: photo.id,
      userId: FAMILY_USER_ID,
      apiBaseUrl: API_BASE_URL,
    };
    setCurrentPhotoDetail(detailData);
    setCurrentScreen('PhotoDetail');
  };

  // ✨ 뒤로가기 버튼 처리
  useEffect(() => {
    const handleBackButton = () => {
      if (currentScreen !== 'Home') {
        setCurrentScreen('Home');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => backHandler.remove();
  }, [currentScreen]);

  // ✨ 앱 시작 시 초기화
  useEffect(() => {
    const initializeApp = async () => {
      // 1. 로컬 캘린더 데이터 로드
      await loadLocalCalendarData();
      
      // 2. 서버에서 최신 캘린더 데이터 로드
      await loadSeniorCalendarData();
      
      // 3. 어르신이 직접 수정한 업데이트 확인
      await checkCalendarUpdates();
    };
    
    initializeApp();
  }, []);

  // ✨ 주기적으로 캘린더 업데이트 확인 (30초마다)
  useEffect(() => {
    const intervalId = setInterval(checkCalendarUpdates, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // ✨ 화면 렌더링
  const renderScreen = () => {
    if (isLoading && !['FamilyFeed', 'Home'].includes(currentScreen)) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>처리 중입니다...</Text>
        </View>
      );
    }

    switch (currentScreen) {
      case 'Home':
        return (
          <HomeScreen 
            navigation={{ navigate }} 
            userId={SENIOR_USER_ID} // 홈스크린은 어르신 ID 기준
            apiBaseUrl={API_BASE_URL}
          />
        );
        
      case 'FamilyFeed':
        return (
          <FamilyFeedScreen 
            apiBaseUrl={API_BASE_URL} 
            feedData={familyFeedData} 
            isLoading={isLoading} 
            navigation={{ 
              openDetail: openPhotoDetail, 
              goBack: () => setCurrentScreen('Home'),
              navigateToPhotoUpload: () => navigate('PhotoUpload')
            }} 
            onRefresh={fetchFamilyPhotos} 
          />
        );

      // ✨ 리포트 화면
      case 'Report':
        return (
          <ReportScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }} 
            route={{ params: reportParams }} 
          />
        );
        
      case 'PhotoDetail':
        if (!currentPhotoDetail) return null;
        return (
          <PhotoDetailScreen 
            route={{ params: currentPhotoDetail }} 
            navigation={{ goBack: () => setCurrentScreen('FamilyFeed') }} 
          />
        );
        
      case 'PhotoUpload':
        return (
          <PhotoUploadScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('FamilyFeed'), 
              uploadPhoto: uploadPhoto 
            }} 
          />
        );

      case 'Calendar':
        return (
          <CalendarScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }} 
            savedDates={familyMarkedDates} 
            onUpdateEvent={handleFamilyUpdateEvent} 
          />
        );
        
      case 'Setting':
        return (
          <SettingScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }}
            familyUserId={FAMILY_USER_ID}
            seniorUserId={SENIOR_USER_ID}
            apiBaseUrl={API_BASE_URL}
          />
        );
        
      default:
        return (
          <HomeScreen 
            navigation={{ navigate }} 
            userId={SENIOR_USER_ID} 
            apiBaseUrl={API_BASE_URL} 
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16 
  }
});