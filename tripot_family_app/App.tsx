import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Alert, BackHandler, ActivityIndicator, View, Text, StatusBar, LogBox } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import FamilyFeedScreen from './src/screens/FamilyFeedScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import PhotoUploadScreen from './src/screens/PhotoUploadScreen';
import CalendarScreen from './src/screens/CalendarScreen'; // ✨ 캘린더 화면 추가
import SettingScreen from './src/screens/SettingScreen'; // ✨ 새로 추가

LogBox.ignoreLogs(['ViewPropTypes will be removed']);

const API_BASE_URL = 'http://192.168.101.67:8080';
const USER_ID = 'user_1752303760586_8wi64r';  // 가족 구성원 ID (같은 ID)
const SENIOR_USER_ID = 'user_1752303760586_8wi64r';  // 어르신 ID (사진이 저장된 ID)

// 🔧 API 설정 로그
console.log('🌐 가족 앱 API 설정:', {
  apiBaseUrl: API_BASE_URL,
  userId: USER_ID,
  seniorUserId: SENIOR_USER_ID,
  note: '사진은 SENIOR_USER_ID로 로딩'
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

// ✨ 캘린더 관련 인터페이스 추가
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
  // ✨ 캘린더 상태 추가
  const [familyMarkedDates, setFamilyMarkedDates] = useState<MarkedDates>({});

  // ✨ 캘린더 데이터 로드 함수 (⚡ URL만 수정됨)
  const loadSeniorCalendarData = async () => {
    try {
      console.log('📅 어르신 캘린더 데이터 로딩 시작...');
      // ⚡ 기존: /api/v1/schedule/calendar/events/${SENIOR_USER_ID}
      // ✅ 수정: /api/v1/calendar/events/${SENIOR_USER_ID}
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/events/${SENIOR_USER_ID}`);
      const result = await response.json();
      
      if (response.ok && result.calendar_data) {
        // 백엔드 형식을 프론트엔드 형식으로 변환
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
        console.log('✅ 캘린더 데이터 로딩 성공:', Object.keys(convertedData).length, '개 날짜');
      }
    } catch (error) {
      console.error('❌ 캘린더 데이터 로드 실패:', error);
    }
  };

  // ✨ 캘린더 업데이트 함수 (⚡ URL만 수정됨)
  const handleFamilyUpdateEvent = async (date: string, events: Event[]) => {
    try {
      console.log('📅 캘린더 일정 업데이트 요청:', date, events.length, '개');
      
      // ⚡ 기존: /api/v1/schedule/calendar/events/update
      // ✅ 수정: /api/v1/calendar/events/update
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/events/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senior_user_id: SENIOR_USER_ID,
          family_user_id: USER_ID,
          date: date,
          events: events.map(event => ({
            id: event.id,
            text: event.text,
            created_at: event.createdAt
          }))
        })
      });

      const result = await response.json();
      if (response.ok) {
        // 로컬 상태 업데이트
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
        console.log('✅ 캘린더 일정 업데이트 성공');
      } else {
        Alert.alert('오류', '일정 업데이트에 실패했습니다.');
        console.error('❌ 캘린더 업데이트 API 오류:', result);
      }
    } catch (error) {
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다.');
      console.error('❌ 캘린더 업데이트 네트워크 오류:', error);
    }
  };

  const fetchFamilyPhotos = async () => {
    setIsLoading(true);
    try {
      console.log('📸 가족 사진 로딩 시작...');
      // 원래 SENIOR_USER_ID로 복구 (사진이 이 ID에 저장되어 있음)
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
    } catch (error) {
      console.error('❌ 가족 사진 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다.');
      setFamilyFeedData({});
    } finally {
      setIsLoading(false);
    }
  };

  const uploadPhoto = async (imageUri: string) => {
    setIsLoading(true);
    const url = `${API_BASE_URL}/api/v1/family/family-yard/upload`;
    
    const formData = new FormData();
    formData.append('file', { 
      uri: imageUri, 
      type: 'image/jpeg', 
      name: `family_photo_${Date.now()}.jpg` 
    } as any);
    formData.append('user_id_str', SENIOR_USER_ID); // 사진 업로드도 SENIOR_USER_ID로
    formData.append('uploaded_by', 'family');

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
    } catch (error) {
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigate = (screen: string) => {
    console.log('📍 화면 이동:', screen);
    
    if (screen === 'FamilyFeed') {
      fetchFamilyPhotos();
    } else if (screen === 'Calendar') {
      // 캘린더 화면 진입 시 데이터 로드
      loadSeniorCalendarData();
    }
    
    setCurrentScreen(screen);
  };

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
      userId: USER_ID,
      apiBaseUrl: API_BASE_URL,
    };
    setCurrentPhotoDetail(detailData);
    setCurrentScreen('PhotoDetail');
  };

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

  // ✨ 앱 시작 시 캘린더 데이터 로드
  useEffect(() => {
    loadSeniorCalendarData();
  }, []);

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
            navigation={{ 
              navigate  // ✨ 통일된 navigate 함수 사용
            }} 
            userId={USER_ID}
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

      // ✨ 캘린더 화면 추가
      case 'Calendar':
        return (
          <CalendarScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }} 
            savedDates={familyMarkedDates} 
            onUpdateEvent={handleFamilyUpdateEvent} 
          />
        );
        
      case 'Setting': // ✨ 새로운 설정 화면
        return (
          <SettingScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }}
            familyUserId={USER_ID}
            seniorUserId={USER_ID}  // 같은 ID 사용
            apiBaseUrl={API_BASE_URL}
          />
        );
        
      default:
        return (
          <HomeScreen 
            navigation={{ 
              navigate
            }} 
            userId={USER_ID} 
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