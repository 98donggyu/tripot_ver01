import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Alert, BackHandler, ActivityIndicator, View, Text, StatusBar, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RealNotificationManager from './src/utils/RealNotificationManager'; // ✨ 추가

import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import FamilyFeedScreen from './src/screens/FamilyFeedScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import SpeakScreen from './src/screens/SpeakScreen';
import RadioScreen from './src/screens/RadioScreen';
import PlayScreen from './src/screens/PlayScreen';
import HealthScreen from './src/screens/HealthScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SettingScreen from './src/screens/SettingScreen.tsx'; // ✨ 새로 추가

LogBox.ignoreLogs(['ViewPropTypes will be removed']);

const API_BASE_URL = 'http://192.168.101.67:8080';
const USER_ID = 'user_1752303760586_8wi64r';

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

// ✨ 새로운 Event 인터페이스 추가
interface Event {
  id: string;
  text: string;
  createdAt: Date;
}

// ✨ MarkedDates 인터페이스 수정
interface MarkedDates { 
  [key: string]: { 
    marked?: boolean; 
    dotColor?: string; 
    events?: Event[];  // note에서 events로 변경
  }; 
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [isLoading, setIsLoading] = useState(false);
  const [familyFeedData, setFamilyFeedData] = useState({});
  const [currentImageUri, setCurrentImageUri] = useState<string>('');
  const [currentPhotoDetail, setCurrentPhotoDetail] = useState<any>(null);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});

  // ✨ RealNotificationManager 초기화
  useEffect(() => {
    console.log('📱 App 초기화 시작');
    
    // setCurrentScreen 함수를 RealNotificationManager에 연결
    RealNotificationManager.setScreen(setCurrentScreen);
    console.log('🔔 RealNotificationManager 초기화 완료');
  }, []);

  // ✨ 서버에서 캘린더 데이터 로드하는 함수 (새 URL 적용)
  const loadCalendarFromServer = async () => {
    try {
      console.log('📅 서버에서 캘린더 데이터 로딩 시작...');
      
      // ✅ 새로운 URL: /api/v1/calendar/events/{user_id}
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/events/${USER_ID}`);
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
        
        // 서버 데이터로 업데이트 (로컬과 병합)
        setMarkedDates(prevData => {
          const mergedData = { ...prevData, ...convertedData };
          saveCalendarData(mergedData);
          return mergedData;
        });
        
        console.log('✅ 서버에서 캘린더 데이터 로딩 성공:', Object.keys(convertedData).length, '개 날짜');
      }
    } catch (error) {
      console.error('❌ 서버 캘린더 데이터 로딩 실패:', error);
      // 서버 로딩 실패시 로컬 데이터 사용 계속
    }
  };

  // ✨ 캘린더 업데이트 확인 함수 (가족의 수정사항 확인) - 새 URL 적용
  const checkCalendarUpdates = async () => {
    try {
      console.log('🔍 가족의 캘린더 업데이트 확인...');
      
      // ✅ 새로운 URL: /api/v1/calendar/check-updates/{user_id}
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/check-updates/${USER_ID}`);
      const result = await response.json();
      
      if (response.ok && result.has_update && result.calendar_data) {
        console.log('📅 가족이 수정한 캘린더 업데이트 감지');
        
        // 백엔드 데이터를 프론트엔드 형식으로 변환
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
        
        setMarkedDates(convertedData);
        saveCalendarData(convertedData);
        
        console.log('✅ 가족이 수정한 캘린더 일정 동기화 완료');
        
        // 업데이트 알림 (선택사항)
        Alert.alert('알림', '가족이 일정을 수정했습니다.');
      }
    } catch (error) {
      console.error('❌ 캘린더 업데이트 확인 실패:', error);
    }
  };

  // ✨ 캘린더 초기화 함수
  useEffect(() => {
    const initializeCalendar = async () => {
      try {
        // 1. 먼저 로컬 데이터 로드
        console.log('📅 로컬 캘린더 데이터 로딩...');
        const savedData = await AsyncStorage.getItem('calendarData');
        if (savedData !== null) { 
          const parsedData = JSON.parse(savedData);
          
          // ✨ 기존 데이터 마이그레이션 (note -> events)
          const migratedData: MarkedDates = {};
          
          Object.keys(parsedData).forEach(date => {
            const dateData = parsedData[date];
            
            // 기존 note 형식인 경우 events로 변환
            if (dateData.note && !dateData.events) {
              migratedData[date] = {
                marked: true,
                dotColor: '#50cebb',
                events: [{
                  id: Date.now().toString(),
                  text: dateData.note,
                  createdAt: new Date()
                }]
              };
            } 
            // 이미 새로운 형식인 경우 그대로 사용
            else if (dateData.events) {
              // events의 createdAt이 문자열인 경우 Date 객체로 변환
              const events = dateData.events.map((event: any) => ({
                ...event,
                createdAt: typeof event.createdAt === 'string' ? new Date(event.createdAt) : event.createdAt
              }));
              
              migratedData[date] = {
                ...dateData,
                events: events
              };
            }
          });
          
          setMarkedDates(migratedData);
          
          // 마이그레이션된 데이터 저장
          if (Object.keys(migratedData).length > 0) {
            saveCalendarData(migratedData);
          }
        }
        
        // 2. 서버에서 최신 데이터 로드 및 병합
        await loadCalendarFromServer();
        
        // 3. 가족의 업데이트 확인
        await checkCalendarUpdates();
        
      } catch (e) { 
        console.error('캘린더 초기화 실패:', e); 
      }
    };
    
    initializeCalendar();
  }, []);

  // ✨ 앱 포그라운드 진입 시 업데이트 확인 (스케줄 방식과 동일)
  useEffect(() => {
    checkCalendarUpdates();
  }, []);

  const saveCalendarData = async (data: MarkedDates) => {
    try {
      const stringifiedData = JSON.stringify(data);
      await AsyncStorage.setItem('calendarData', stringifiedData);
    } catch (e) { 
      console.error('Failed to save calendar data.', e); 
    }
  };

  // ✨ handleUpdateEvent 함수 수정 - 서버 동기화 추가 (새 URL 적용)
  const handleUpdateEvent = async (date: string, events: Event[]) => {
    // 1. 로컬 상태 업데이트 (기존 방식)
    const newMarkedDates = { ...markedDates };
    
    if (!events || events.length === 0) { 
      // 일정이 없으면 해당 날짜 삭제
      delete newMarkedDates[date]; 
    } else { 
      // 일정이 있으면 업데이트
      newMarkedDates[date] = { 
        marked: true, 
        dotColor: '#50cebb', 
        events: events 
      }; 
    }
    
    setMarkedDates(newMarkedDates);
    saveCalendarData(newMarkedDates);
    
    // 2. 서버 동기화 추가 ✨ (새 URL 적용)
    try {
      console.log('📅 서버에 캘린더 동기화 시작:', date, events.length, '개 일정');
      
      // ✅ 새로운 URL: /api/v1/calendar/events/update
      const response = await fetch(`${API_BASE_URL}/api/v1/calendar/events/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senior_user_id: USER_ID,
          family_user_id: USER_ID, // 어르신이 직접 수정한 경우
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
        console.log('✅ 서버 동기화 성공');
      } else {
        console.error('❌ 서버 동기화 실패:', result);
        // 서버 동기화 실패해도 로컬은 유지
      }
    } catch (error) {
      console.error('❌ 서버 동기화 네트워크 오류:', error);
      // 네트워크 오류여도 로컬은 유지
    }
  };

  const fetchFamilyPhotos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/family/family-yard/photos?user_id_str=${USER_ID}`);
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setFamilyFeedData(result.photos_by_date || {});
      } else {
        Alert.alert('오류', '사진을 불러오는데 실패했습니다.');
        setFamilyFeedData({});
      }
    } catch (error) {
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다. Wi-Fi와 서버 상태를 확인해주세요.');
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
      name: `photo_${Date.now()}.jpg` 
    } as any);
    formData.append('user_id_str', USER_ID);
    formData.append('uploaded_by', 'senior');

    try {
      const response = await fetch(url, { 
        method: 'POST', 
        body: formData, 
        headers: { 
          'Content-Type': 'multipart/form-data' 
        } 
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
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다. Wi-Fi와 서버 상태를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ navigate 함수 (RealNotificationManager에서 사용)
  const navigate = (screen: string) => {
    console.log('📍 화면 이동:', screen);
    
    if (screen === 'FamilyFeed') {
      fetchFamilyPhotos();
    } else if (screen === 'Calendar') {
      // ✨ 캘린더 화면 진입 시 업데이트 확인
      checkCalendarUpdates();
    }
    
    setCurrentScreen(screen);
  };

  const navigateToPreview = (uri: string) => {
    setCurrentImageUri(uri);
    setCurrentScreen('Preview');
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

  const renderScreen = () => {
    if (isLoading && currentScreen !== 'FamilyFeed') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>처리 중입니다...</Text>
        </View>
      );
    }

    switch (currentScreen) {
      case 'Home':
        return <HomeScreen navigation={{ navigate }} />;
        
      case 'Camera':
        return (
          <CameraScreen 
            navigation={{ 
              navigateToPreview, 
              goBack: () => setCurrentScreen('Home') 
            }} 
          />
        );
        
      case 'Preview':
        return (
          <PreviewScreen 
            route={{ params: { imageUri: currentImageUri } }} 
            navigation={{ 
              goBack: () => setCurrentScreen('Camera'), 
              register: uploadPhoto 
            }} 
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
              goBack: () => setCurrentScreen('Home') 
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
        
      case 'Speak':
        return (
          <SpeakScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }}
            userId={USER_ID}
            apiBaseUrl={API_BASE_URL}
          />
        );
        
      case 'Radio':
        return <RadioScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
        
      case 'Play':
        return <PlayScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
        
      case 'Health':
        return <HealthScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
        
      case 'Calendar':
        return (
          <CalendarScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }} 
            savedDates={markedDates} 
            onUpdateEvent={handleUpdateEvent} 
          />
        );
        
      case 'Setting': // ✨ 설정 화면
        return (
          <SettingScreen 
            navigation={{ goBack: () => setCurrentScreen('Home') }}
            userId={USER_ID}
            apiBaseUrl={API_BASE_URL}
          />
        );
        
      default:
        return <HomeScreen navigation={{ navigate }} />;
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