import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Platform,
  LogBox,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AudioRecord from 'react-native-audio-record';
import Tts from 'react-native-tts';
import RNFS from 'react-native-fs';

LogBox.ignoreLogs([
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
]);

interface Message {
  id: number;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
}

interface SpeakScreenProps {
  navigation: {
    goBack: () => void;
  };
  userId: string;
  apiBaseUrl: string;
}

const SpeakScreen: React.FC<SpeakScreenProps> = ({ navigation, userId, apiBaseUrl }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const websocketRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const userClosedConnection = useRef<boolean>(false);

  useEffect(() => {
    initializeApp();
    return () => {
      cleanupAudio();
      if (websocketRef.current) {
        userClosedConnection.current = true;
        websocketRef.current.close();
      }
    };
  }, []);

  const initializeApp = async (): Promise<void> => {
    try {
      await requestPermissions();
      await setupTTS();
      userClosedConnection.current = false;
      connectWebSocket();
    } catch (error) {
      Alert.alert("초기화 오류", "앱을 시작하는 데 문제가 발생했습니다.");
    }
  };

  const setupTTS = async (): Promise<void> => {
    Tts.removeAllListeners('tts-start');
    Tts.removeAllListeners('tts-finish');
    Tts.removeAllListeners('tts-cancel');
    Tts.addEventListener('tts-start', () => setIsSpeaking(true));
    Tts.addEventListener('tts-finish', () => {
      setIsSpeaking(false);
      setTimeout(() => {
        if (!isRecording && !isProcessing) {
          startRecording();
        }
      }, 1000);
    });
    Tts.addEventListener('tts-cancel', () => setIsSpeaking(false));
    await Tts.setDefaultLanguage('ko-KR');
    await Tts.setDefaultRate(0.5);
  };

  const requestPermissions = async (): Promise<void> => {
    if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: '음성 인식 권한',
              message: '음성 대화를 위해 마이크 권한이 필요합니다.',
              buttonPositive: '확인',
              buttonNegative: '취소',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('권한 필요', '음성 인식을 위해 마이크 권한이 필요합니다.');
            throw new Error('Permission denied');
          }
        } catch (err) {
          console.error('권한 요청 오류:', err);
          throw err;
        }
      }
  };

  const connectWebSocket = (): void => {
    if (!userId) return;

    const wsUrl = `ws://192.168.101.67:8080/api/v1/senior/ws/${userId}`;
    console.log(`🔗 WebSocket 연결 시도: ${wsUrl}`);
    console.log(`🔗 사용자 ID: ${userId}`);
    
    try {
      websocketRef.current = new WebSocket(wsUrl);

      if (websocketRef.current) {
        websocketRef.current.onopen = (event: any) => {
          setIsConnected(true);
          console.log('✅ WebSocket 연결 성공', event);
          retryCountRef.current = 0;
        };

        websocketRef.current.onmessage = (event: any) => {
          try {
            console.log('📩 받은 메시지:', event.data);
            const data = JSON.parse(event.data);
            
            // ✨ 정시 대화 알림 처리
            if (data.type === 'scheduled_call') {
              handleScheduledCall(data);
            } else if (data.type === 'ai_message') {
              handleAIMessage(data.content);
              setIsProcessing(false);
            } else if (data.type === 'user_message') {
              handleUserMessage(data.content);
            } else if (data.type === 'system_message') {
              handleSystemMessage(data.content);
            } else if (data.type === 'error') {
              Alert.alert('처리 오류', data.content);
              setIsProcessing(false);
            }
          } catch (error) {
            console.error('❌ 메시지 파싱 오류:', error);
            setIsProcessing(false);
          }
        };

        websocketRef.current.onclose = (event: any) => {
          setIsConnected(false);
          console.log('❌ WebSocket 연결 종료. Code:', event.code, 'Reason:', event.reason);
          
          if (userClosedConnection.current) {
            console.log('사용자가 연결을 종료하여 재연결하지 않습니다.');
            return;
          }
          
          if (retryCountRef.current < 5) {
            retryCountRef.current += 1;
            console.log(`🔄 WebSocket 재연결 시도 (${retryCountRef.current}/5)`);
            setTimeout(connectWebSocket, 3000);
          } else {
            console.log('최대 재연결 횟수를 초과했습니다.');
            Alert.alert('연결 실패', '서버에 연결할 수 없습니다. 잠시 후 앱을 다시 시작해 주세요.');
          }
        };

        websocketRef.current.onerror = (error: any) => {
          console.error('❌ WebSocket 오류:', error);
          setIsConnected(false);
        };
      }
      
    } catch (error) {
      console.error('❌ WebSocket 생성 오류:', error);
      setIsConnected(false);
    }
  };

  // ✨ 정시 대화 알림 처리
  const handleScheduledCall = (data: any): void => {
    console.log('📞 정시 대화 알림 수신:', data);
    
    Alert.alert(
      '🗣️ 대화 시간이에요!',
      '말벗과 대화를 시작하시겠어요?',
      [
        {
          text: '지금 대화하기',
          onPress: () => {
            console.log('📞 정시 대화 즉시 시작');
            sendScheduledCallResponse('start_now');
          },
          style: 'default'
        },
        {
          text: '10분 후에',
          onPress: () => {
            console.log('⏰ 대화 10분 연기');
            sendScheduledCallResponse('snooze');
          },
          style: 'default'
        },
        {
          text: '오늘은 건너뛰기',
          onPress: () => {
            console.log('⏭️ 오늘 대화 건너뛰기');
            sendScheduledCallResponse('skip');
          },
          style: 'cancel'
        }
      ],
      { cancelable: false }
    );
  };

  // ✨ 정시 대화 응답 전송
  const sendScheduledCallResponse = (action: string): void => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const response = {
        type: 'scheduled_call_response',
        action: action,
        timestamp: new Date().toISOString()
      };
      websocketRef.current.send(JSON.stringify(response));
    }
  };

  const startRecording = async (): Promise<void> => {
    if (isSpeaking || isProcessing) return;
    try {
      const options = { 
        sampleRate: 16000, 
        channels: 1, 
        bitsPerSample: 16, 
        audioSource: 6, 
        wavFile: 'voice_recording.wav' 
      };
      AudioRecord.init(options);
      AudioRecord.start();
      setIsRecording(true);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecording) {
          stopRecording();
          Alert.alert('대화 종료', '음성이 감지되지 않아 대화를 종료합니다.');
        }
      }, 10000);
    } catch (error) {
      Alert.alert('녹음 오류', '음성 녹음을 시작할 수 없습니다.');
    }
  };

  const stopRecording = async (): Promise<void> => {
    if (!isRecording) return;
    try {
      setIsRecording(false);
      setIsProcessing(true);
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      const audioFile = await AudioRecord.stop();
      const audioBase64 = await RNFS.readFile(audioFile, 'base64');
      if (websocketRef.current && isConnected) {
        websocketRef.current.send(audioBase64);
      }
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('녹음 오류', '음성 처리 중 오류가 발생했습니다.');
    }
  };

  const handleUserMessage = (message: string): void => {
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      type: 'user', 
      content: message, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const handleAIMessage = (message: string): void => {
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      type: 'ai', 
      content: message, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
    speakMessage(message);
  };

  // ✨ 시스템 메시지 처리 (정시 대화 관련)
  const handleSystemMessage = (message: string): void => {
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      type: 'system', 
      content: message, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const speakMessage = async (message: string): Promise<void> => {
    try {
      await Tts.speak(message);
    } catch (error) {
      setIsSpeaking(false);
    }
  };

  const cleanupAudio = (): void => {
    try {
      AudioRecord.stop();
      Tts.stop();
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    } catch (error) {
      console.error('❌ Audio cleanup 오류:', error);
    }
  };

  const handleEndConversation = (): void => {
    console.log('--- 대화 세션 종료 ---');
    cleanupAudio(); 
    userClosedConnection.current = true;
    websocketRef.current?.close(); 
    navigation.goBack(); 
  };
  
  const getStatusText = (): string => {
    if (isSpeaking) return '🔊 AI 말하는 중...';
    if (isProcessing) return '⚙️ 음성 처리 중...';
    if (isRecording) return '🎤 녹음 중...';
    if (!isConnected) return '🔌 연결 중...';
    return '대기 중 (정시 알림 활성화)';
  };

  const getStatusColor = (): string => {
    if (isSpeaking) return '#FF9800';
    if (isProcessing) return '#2196F3';
    if (isRecording) return '#4CAF50';
    if (!isConnected) return '#F44336';
    return '#666';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI 음성 대화</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message: Message) => (
          <View key={message.id} style={[
            styles.messageContainer,
            message.type === 'user' ? styles.userMessage : 
            message.type === 'system' ? styles.systemMessage : styles.aiMessage
          ]}>
            <Text style={[
              styles.messageText,
              message.type === 'user' ? styles.userMessageText : 
              message.type === 'system' ? styles.systemMessageText : styles.aiMessageText
            ]}>
              {message.content}
            </Text>
            <Text style={styles.timestamp}>{message.timestamp}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton,
            (!isConnected || isSpeaking || isProcessing) && styles.disabledButton
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!isConnected || isSpeaking || isProcessing}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '🎤 녹음 중... (탭하면 중지)' : '🎤 녹음 시작'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndConversation}
        >
          <Text style={styles.endButtonText}>대화 종료</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 50, },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 10, },
  statusContainer: { flexDirection: 'row', alignItems: 'center', },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 10, },
  statusText: { fontSize: 16, fontWeight: '600', },
  messagesContainer: { flex: 1, padding: 20, },
  messageContainer: { marginVertical: 8, padding: 15, borderRadius: 15, maxWidth: '85%', },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#007AFF', },
  aiMessage: { alignSelf: 'flex-start', backgroundColor: '#E5E5EA', },
  systemMessage: { alignSelf: 'center', backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFEAA7', },
  messageText: { fontSize: 16, lineHeight: 22, },
  userMessageText: { color: '#fff', },
  aiMessageText: { color: '#333', },
  systemMessageText: { color: '#856404', textAlign: 'center', fontStyle: 'italic' },
  timestamp: { fontSize: 12, color: '#999', marginTop: 5, alignSelf: 'flex-end', },
  controlsContainer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', },
  recordButton: { backgroundColor: '#4CAF50', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 25, alignItems: 'center', marginBottom: 10, },
  recordingButton: { backgroundColor: '#FF9800', },
  disabledButton: { backgroundColor: '#ccc', },
  recordButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', },
  endButton: { backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 25, alignItems: 'center', },
  endButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', },
});

export default SpeakScreen;