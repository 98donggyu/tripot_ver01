import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Alert, BackHandler, ActivityIndicator, View, Text, StatusBar, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

LogBox.ignoreLogs(['ViewPropTypes will be removed']);

const API_BASE_URL = 'http://192.168.101.67:8080';
const USER_ID = 'user_1752303760586_8wi64r';

interface Comment { id: number; author_name: string; comment_text: string; created_at: string; }
interface Photo { id: number; uploaded_by: string; created_at: string; comments: Comment[]; }
interface MarkedDates { [key: string]: { marked?: boolean; dotColor?: string; note?: string; }; }

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [isLoading, setIsLoading] = useState(false);
  const [familyFeedData, setFamilyFeedData] = useState({});
  const [currentImageUri, setCurrentImageUri] = useState<string>('');
  const [currentPhotoDetail, setCurrentPhotoDetail] = useState<any>(null);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});

  useEffect(() => {
    const loadCalendarData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('calendarData');
        if (savedData !== null) { setMarkedDates(JSON.parse(savedData)); }
      } catch (e) { console.error('Failed to load calendar data.', e); }
    };
    loadCalendarData();
  }, []);

  const saveCalendarData = async (data: MarkedDates) => {
    try {
      const stringifiedData = JSON.stringify(data);
      await AsyncStorage.setItem('calendarData', stringifiedData);
    } catch (e) { console.error('Failed to save calendar data.', e); }
  };

  const handleUpdateEvent = (date: string, note: string) => {
    const newMarkedDates = { ...markedDates };
    if (!note.trim()) { delete newMarkedDates[date]; } 
    else { newMarkedDates[date] = { marked: true, dotColor: '#50cebb', note: note }; }
    setMarkedDates(newMarkedDates);
    saveCalendarData(newMarkedDates);
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
    formData.append('file', { uri: imageUri, type: 'image/jpeg', name: `photo_${Date.now()}.jpg` });
    formData.append('user_id_str', USER_ID);
    formData.append('uploaded_by', 'senior');

    try {
      const response = await fetch(url, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
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

  const navigate = (screen: string) => {
    if (screen === 'FamilyFeed') {
      fetchFamilyPhotos();
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
        return <CameraScreen navigation={{ navigateToPreview, goBack: () => setCurrentScreen('Home') }} />;
      case 'Preview':
        return <PreviewScreen route={{ params: { imageUri: currentImageUri } }} navigation={{ goBack: () => setCurrentScreen('Camera'), register: uploadPhoto }} />;
      case 'FamilyFeed':
        return <FamilyFeedScreen apiBaseUrl={API_BASE_URL} feedData={familyFeedData} isLoading={isLoading} navigation={{ openDetail: openPhotoDetail, goBack: () => setCurrentScreen('Home') }} onRefresh={fetchFamilyPhotos} />;
      case 'PhotoDetail':
        if (!currentPhotoDetail) return null;
        return <PhotoDetailScreen route={{ params: currentPhotoDetail }} navigation={{ goBack: () => setCurrentScreen('FamilyFeed') }} />;
      case 'Speak':
        return <SpeakScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
      case 'Radio':
        return <RadioScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
      case 'Play':
        return <PlayScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
      case 'Health':
        return <HealthScreen navigation={{ goBack: () => setCurrentScreen('Home') }} />;
      case 'Calendar':
        return <CalendarScreen navigation={{ goBack: () => setCurrentScreen('Home') }} savedDates={markedDates} onUpdateEvent={handleUpdateEvent} />;
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 }
});