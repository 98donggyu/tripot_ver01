import React, { useState, useEffect } from 'react';
import { BackHandler, SafeAreaView, StatusBar, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import SpeakScreen from './src/screens/SpeakScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import HealthScreen from './src/screens/HealthScreen';
import PlayScreen from './src/screens/PlayScreen';
import RadioScreen from './src/screens/RadioScreen';

interface MarkedDates { [key: string]: { marked?: boolean; dotColor?: string; note?: string; }; }

// --- 백엔드 연결 설정 (새로 추가) ---
// 안드로이드 에뮬레이터에서 PC의 localhost에 접속하기 위한 주소
const WEBSOCKET_URL = 'ws://10.0.2.2:8080/api/v1/senior/ws/senior_123';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  
  // --- 백엔드 연결 상태 관리 (새로 추가) ---
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('서버 연결 중...');

  // --- 웹소켓 연결 로직 (새로 추가) ---
  useEffect(() => {
    console.log('웹소켓 연결을 시도합니다...');
    const socket = new WebSocket(WEBSOCKET_URL);

    socket.onopen = () => setConnectionStatus('✅ 연결 성공');
    socket.onclose = () => setConnectionStatus('🔌 연결 끊어짐');
    socket.onerror = (error) => setConnectionStatus(`❌ 연결 오류: ${error.message}`);
    
    // SpeakScreen으로 전달할 수 있도록 WebSocket 인스턴스를 상태에 저장합니다.
    setWs(socket);

    // 앱이 종료될 때 소켓 연결을 정리합니다.
    return () => {
      socket.close();
    };
  }, []); // 앱이 처음 실행될 때 단 한 번만 실행됩니다.


  // --- 안드로이드 뒤로 가기 버튼 처리 (기존과 동일) ---
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


  // --- AsyncStorage 데이터 로딩 (기존과 동일, 하지만 수정 제안!) ---
  // 현재는 로컬 저장소(AsyncStorage)를 사용하지만,
  // 추후에는 백엔드 API를 호출하여 가족과 공유되는 데이터를 불러오는 방식으로 변경해야 합니다.
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('calendarData');
        if (savedData !== null) { setMarkedDates(JSON.parse(savedData)); }
      } catch (e) { console.error('Failed to load data.', e); }
    };
    loadData();
  }, []);

  const saveData = async (data: MarkedDates) => {
    try {
      const stringifiedData = JSON.stringify(data);
      await AsyncStorage.setItem('calendarData', stringifiedData);
    } catch (e) { console.error('Failed to save data.', e); }
  };

  const handleUpdateEvent = (date: string, note: string) => {
    const newMarkedDates = { ...markedDates };
    if (!note.trim()) { delete newMarkedDates[date]; }
    else { newMarkedDates[date] = { marked: true, dotColor: '#50cebb', note: note }; }
    setMarkedDates(newMarkedDates);
    saveData(newMarkedDates);
  };

  const navigate = (screenName: string) => { if (screenName) { setCurrentScreen(screenName); } };
  const goBackToHome = () => { setCurrentScreen('Home'); };

  // --- 화면 렌더링 로직 (수정) ---
  // 각 스크린에 필요한 props를 전달합니다.
  const renderScreen = () => {
    switch (currentScreen) {
      case 'Speak':
        // SpeakScreen에 웹소켓 인스턴스를 전달합니다.
        return <SpeakScreen navigation={{ goBack: goBackToHome }} webSocket={ws} />;
      case 'Calendar':
        return ( <CalendarScreen navigation={{ goBack: goBackToHome }} savedDates={markedDates} onUpdateEvent={handleUpdateEvent} /> );
      case 'Health':
        // 추후 HealthScreen에도 백엔드에서 건강 데이터를 받아오는 로직이 필요합니다.
        return <HealthScreen navigation={{ goBack: goBackToHome }} />;
      case 'Play':
        return <PlayScreen navigation={{ goBack: goBackToHome }} />;
      case 'Radio':
        return <RadioScreen navigation={{ goBack: goBackToHome }} />;
      default:
        // HomeScreen에 연결 상태를 표시할 수 있도록 props를 전달합니다.
        return <HomeScreen navigation={{ navigate: navigate }} connectionStatus={connectionStatus} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
