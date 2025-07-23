import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationManager from '../utils/RealNotificationManager';

interface Schedule {
  id: number;
  call_time: string;
  is_enabled: boolean;
  created_at: string;
}

interface TimeOption {
  time: string;
  label: string;
}

interface SettingScreenProps {
  navigation: { 
    goBack: () => void; 
  };
  userId: string;
  apiBaseUrl: string;
}

const SettingScreen: React.FC<SettingScreenProps> = ({ navigation, userId, apiBaseUrl }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 다양한 시간 옵션들 (복수 선택 가능)
  const timeOptions: TimeOption[] = [
    { time: '07:00', label: '오전 7시 (아침 일찍)' },
    { time: '08:00', label: '오전 8시 (아침)' },
    { time: '09:00', label: '오전 9시' },
    { time: '10:00', label: '오전 10시' },
    { time: '11:00', label: '오전 11시' },
    { time: '12:40', label: '오후 12시 (점심)' },
    { time: '13:00', label: '오후 1시' },
    { time: '14:00', label: '오후 2시' },
    { time: '15:00', label: '오후 3시' },
    { time: '16:00', label: '오후 4시' },
    { time: '17:00', label: '오후 5시' },
    { time: '18:00', label: '오후 6시' },
    { time: '19:00', label: '오후 7시 (저녁)' },
    { time: '20:00', label: '오후 8시' },
    { time: '21:00', label: '오후 9시' },
  ];

  useEffect(() => {
    loadUserSchedules();
    // 알림 권한 요청
    requestNotificationPermissions();
  }, []);

  // 알림 권한 요청 및 확인
  const requestNotificationPermissions = async () => {
    try {
      // 먼저 현재 권한 상태 확인
      const hasPermission = await NotificationManager.checkPermissions();
      
      if (hasPermission) {
        console.log('✅ 알림 권한이 이미 허용됨');
        return true;
      }

      // 권한 요청
      const granted = await NotificationManager.requestPermissions();
      
      if (granted) {
        console.log('✅ 알림 권한 허용됨');
        Alert.alert(
          '권한 허용 완료',
          '이제 정시 대화 알림을 받을 수 있습니다!',
          [{ text: '확인' }]
        );
        return true;
      } else {
        console.log('❌ 알림 권한 거부됨');
        Alert.alert(
          '알림 권한 필요',
          '정시 대화 알림을 받으려면 설정에서 알림 권한을 허용해주세요.\n\n설정 > 앱 > 트리팟 > 알림',
          [
            { text: '나중에' },
            { 
              text: '설정으로 이동', 
              onPress: () => {
                // 설정 앱으로 이동하는 로직 추가 가능
                console.log('설정 앱으로 이동 필요');
              }
            }
          ]
        );
        return false;
      }
    } catch (error) {
      console.error('권한 요청 실패:', error);
      return false;
    }
  };

  // 사용자 스케줄 조회
  const loadUserSchedules = async (): Promise<void> => {
    try {
      console.log('📋 스케줄 조회 요청');
      
      const response = await fetch(`${apiBaseUrl}/api/v1/schedule/${userId}`);
      const result = await response.json();

      if (response.ok) {
        console.log('✅ 스케줄 조회 성공:', result);
        setSchedules(result.schedules);
        
        // 로컬 저장
        await AsyncStorage.setItem('userSchedules', JSON.stringify(result.schedules));
      } else {
        console.error('❌ 스케줄 조회 실패:', result);
      }
    } catch (error) {
      console.error('❌ 스케줄 조회 네트워크 오류:', error);
    }
  };

  // 시간 선택 토글 (복수 선택 가능)
  const toggleTimeSelection = (time: string): void => {
    setSelectedTimes((prev: string[]) => 
      prev.includes(time) 
        ? prev.filter((t: string) => t !== time)
        : [...prev, time].sort()
    );
  };

  // 스케줄 저장 (백엔드 + 푸시 알림)
  const handleSaveSchedule = async (): Promise<void> => {
    if (selectedTimes.length === 0) {
      Alert.alert('알림', '최소 하나의 시간을 선택해주세요.');
      return;
    }

    // 먼저 알림 권한 확인
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      Alert.alert(
        '권한 필요',
        '알림 권한이 없으면 푸시 알림을 받을 수 없습니다.\n스케줄은 저장되지만 앱 내에서만 알림이 작동합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '그래도 저장', onPress: () => saveScheduleWithoutNotification() }
        ]
      );
      return;
    }

    setIsLoading(true);
    try {
      console.log('⏰ 스케줄 설정 요청:', selectedTimes);
      
      // 1. 백엔드에 스케줄 저장
      const response = await fetch(`${apiBaseUrl}/api/v1/schedule/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id_str: userId,
          call_times: selectedTimes
        })
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ 백엔드 스케줄 설정 성공:', result);
        setSchedules(result.schedules);
        setSelectedTimes([]);
        
        // 로컬 저장
        await AsyncStorage.setItem('userSchedules', JSON.stringify(result.schedules));
        
        // 2. 푸시 알림 스케줄 설정
        try {
          NotificationManager.scheduleConversationAlarm(selectedTimes);
          console.log('✅ 푸시 알림 설정 완료');
          
          Alert.alert(
            '설정 완료! 🎉',
            `정시 대화 알림이 설정되었습니다.\n설정된 시간: ${selectedTimes.map(formatTime).join(', ')}\n\n📱 앱이 꺼져있어도 알림이 울립니다!\n🔔 전화벨 같은 큰 소리와 진동`,
            [{ text: '확인' }]
          );
        } catch (notificationError) {
          console.error('❌ 푸시 알림 설정 실패:', notificationError);
          Alert.alert('알림 설정 실패', '푸시 알림 설정에 실패했지만 스케줄은 저장되었습니다.');
        }
        
      } else {
        console.error('❌ 백엔드 스케줄 설정 실패:', result);
        Alert.alert('오류', result.detail || '스케줄 설정에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 스케줄 설정 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '스케줄을 설정할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 권한 없이 스케줄만 저장
  const saveScheduleWithoutNotification = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/schedule/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id_str: userId,
          call_times: selectedTimes
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSchedules(result.schedules);
        setSelectedTimes([]);
        await AsyncStorage.setItem('userSchedules', JSON.stringify(result.schedules));
        
        Alert.alert(
          '스케줄 저장됨',
          '백엔드 스케줄은 저장되었습니다.\n푸시 알림을 받으려면 설정에서 알림 권한을 허용해주세요.',
          [{ text: '확인' }]
        );
      }
    } catch (error) {
      Alert.alert('오류', '스케줄 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄 토글
  const toggleSchedule = async (scheduleId: number, isEnabled: boolean): Promise<void> => {
    try {
      console.log('🔄 스케줄 토글:', scheduleId, isEnabled);
      
      const response = await fetch(`${apiBaseUrl}/api/v1/schedule/${scheduleId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: isEnabled })
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ 스케줄 토글 성공');
        // 로컬 스케줄 상태 업데이트
        const updatedSchedules = schedules.map((schedule: Schedule) => 
          schedule.id === scheduleId 
            ? { ...schedule, is_enabled: isEnabled }
            : schedule
        );
        setSchedules(updatedSchedules);
        await AsyncStorage.setItem('userSchedules', JSON.stringify(updatedSchedules));
        
        // 푸시 알림도 업데이트
        const activeTimes = updatedSchedules
          .filter(s => s.is_enabled)
          .map(s => s.call_time);
        NotificationManager.scheduleConversationAlarm(activeTimes);
        
      } else {
        console.error('❌ 스케줄 토글 실패:', result);
        Alert.alert('오류', result.detail || '스케줄 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 스케줄 토글 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '스케줄을 변경할 수 없습니다.');
    }
  };

  // 모든 스케줄 제거
  const removeAllSchedules = async (): Promise<void> => {
    try {
      console.log('🗑️ 모든 스케줄 제거');
      
      const response = await fetch(`${apiBaseUrl}/api/v1/schedule/${userId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ 백엔드 스케줄 제거 성공');
        setSchedules([]);
        await AsyncStorage.removeItem('userSchedules');
        
        // 푸시 알림도 모두 취소
        NotificationManager.cancelAllNotifications();
        console.log('✅ 푸시 알림도 모두 취소됨');
        
        Alert.alert('성공', '모든 스케줄과 알림이 제거되었습니다.');
      } else {
        console.error('❌ 스케줄 제거 실패:', result);
        Alert.alert('오류', result.detail || '스케줄 제거에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 스케줄 제거 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '스케줄을 제거할 수 없습니다.');
    }
  };

  const handleRemoveAllSchedules = (): void => {
    Alert.alert(
      '스케줄 제거',
      '모든 정시 대화 시간과 알림을 제거하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '제거',
          style: 'destructive',
          onPress: removeAllSchedules
        }
      ]
    );
  };

  // 시간 형식 변환 함수
  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? '오후' : '오전';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${ampm} ${displayHour}:${minutes}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>정시 대화 설정</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 현재 설정된 스케줄 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>현재 설정된 시간</Text>
          {schedules.length > 0 ? (
            schedules.map((schedule: Schedule) => (
              <View key={schedule.id} style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>
                  {formatTime(schedule.call_time)}
                </Text>
                <Switch
                  value={schedule.is_enabled}
                  onValueChange={(value: boolean) => toggleSchedule(schedule.id, value)}
                  trackColor={{ false: '#ccc', true: '#007AFF' }}
                />
              </View>
            ))
          ) : (
            <Text style={styles.noScheduleText}>설정된 시간이 없습니다.</Text>
          )}
          
          {schedules.length > 0 && (
            <TouchableOpacity 
              style={styles.removeAllButton}
              onPress={handleRemoveAllSchedules}
            >
              <Text style={styles.removeAllButtonText}>모든 스케줄 제거</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 새 시간 추가 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>새 시간 추가</Text>
          <Text style={styles.sectionDescription}>
            말벗과 대화할 시간을 선택하세요. (복수 선택 가능)
          </Text>
          
          <View style={styles.timeGrid}>
            {timeOptions.map((option: TimeOption) => (
              <TouchableOpacity
                key={option.time}
                style={[
                  styles.timeOption,
                  selectedTimes.includes(option.time) && styles.timeOptionSelected
                ]}
                onPress={() => toggleTimeSelection(option.time)}
              >
                <Text style={[
                  styles.timeOptionText,
                  selectedTimes.includes(option.time) && styles.timeOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedTimes.length > 0 && (
            <View style={styles.selectedTimesContainer}>
              <Text style={styles.selectedTimesTitle}>선택된 시간:</Text>
              <Text style={styles.selectedTimesText}>
                {selectedTimes.map((time: string) => formatTime(time)).join(', ')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.saveButton,
              (selectedTimes.length === 0 || isLoading) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveSchedule}
            disabled={selectedTimes.length === 0 || isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? '저장 중...' : '스케줄 저장'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 안내 메시지 */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>🔔 알림 기능</Text>
          <Text style={styles.infoText}>
            • 설정한 시간에 **앱이 꺼져있어도** 알림이 울립니다{'\n'}
            • 전화벨처럼 **큰 소리와 진동**으로 알림{'\n'}
            • 알림을 터치하면 바로 대화 시작 가능{'\n'}
            • "10분 후에" 연기 기능 제공{'\n'}
            • 무음 모드에서도 알림 (중요도 높음)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  backButton: {
    fontSize: 18,
    color: '#007AFF'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  testButton: {
    fontSize: 14,
    color: '#FF9500'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333'
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8
  },
  scheduleTime: {
    fontSize: 16,
    fontWeight: '500'
  },
  noScheduleText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    padding: 32
  },
  removeAllButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    marginTop: 16
  },
  removeAllButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600'
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  timeOption: {
    width: '48%',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  timeOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#0056b3'
  },
  timeOptionText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  timeOptionTextSelected: {
    color: 'white'
  },
  selectedTimesContainer: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginTop: 16
  },
  selectedTimesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4
  },
  selectedTimesText: {
    fontSize: 14,
    color: '#1976d2'
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 24
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc'
  },
  saveButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600'
  },
  infoSection: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50'
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8
  },
  infoText: {
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20
  }
});

export default SettingScreen;